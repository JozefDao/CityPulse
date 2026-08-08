import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, SnapshotType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { getOpenMeteoTimeoutMs } from '../common/open-meteo-timeout';
import { CityDashboardResponseDto } from './dto/city-dashboard.dto';
import {
  mapAir,
  mapCurrent,
  mapDaily,
  mapHourly,
} from './mappers/open-meteo.mapper';

type OpenMeteoForecastResponse = {
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
  timezone?: string;
};

type OpenMeteoAirQualityResponse = {
  hourly?: Record<string, unknown>;
  timezone?: string;
};

type SnapshotResult = {
  data: unknown;
  fetchedAt: Date;
  isStale: boolean;
};

const TTL_MS: Record<SnapshotType, number> = {
  CURRENT: 10 * 60 * 1000,
  HOURLY: 10 * 60 * 1000,
  DAILY: 60 * 60 * 1000,
  AIR_QUALITY: 20 * 60 * 1000,
};

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  async getDashboard(cityId: string): Promise<CityDashboardResponseDto> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      throw new NotFoundException('City not found');
    }

    const [current, hourly, daily, air] = await Promise.all([
      this.getSnapshotSafe(city.id, SnapshotType.CURRENT, city),
      this.getSnapshotSafe(city.id, SnapshotType.HOURLY, city),
      this.getSnapshotSafe(city.id, SnapshotType.DAILY, city),
      this.getSnapshotSafe(city.id, SnapshotType.AIR_QUALITY, city),
    ]);

    const lastUpdated = this.getLastUpdated([current, hourly, daily, air]);
    const isStale =
      this.hasStale([current, hourly, daily, air]) ||
      this.anyExpired([
        current ? { ...current, type: SnapshotType.CURRENT } : null,
        hourly ? { ...hourly, type: SnapshotType.HOURLY } : null,
        daily ? { ...daily, type: SnapshotType.DAILY } : null,
        air ? { ...air, type: SnapshotType.AIR_QUALITY } : null,
      ]);

    return {
      city,
      current: mapCurrent(current?.data),
      hourly: mapHourly(hourly?.data),
      daily: mapDaily(daily?.data),
      airQuality: mapAir(air?.data),
      meta: {
        lastUpdated: lastUpdated?.toISOString() ?? new Date(0).toISOString(),
        isStale,
        sources: {
          current: Boolean(current?.data),
          hourly: Boolean(hourly?.data),
          daily: Boolean(daily?.data),
          airQuality: Boolean(air?.data),
        },
      },
    };
  }

  async refreshCitySnapshots(cityId: string): Promise<void> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      return;
    }

    for (const type of Object.values(SnapshotType)) {
      try {
        await this.getSnapshotWithRefresh(city.id, type, city);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Snapshot refresh failed for ${city.name} (${type}): ${message}`,
        );
      }
    }
  }

  private async getSnapshotWithRefresh(
    cityId: string,
    type: SnapshotType,
    city: { lat: number; lon: number; timezone: string },
  ): Promise<SnapshotResult> {
    const latest = await this.prisma.weatherSnapshot.findFirst({
      where: { cityId, type },
      orderBy: { fetchedAt: 'desc' },
    });

    const ttl = TTL_MS[type];
    const expired = !latest || Date.now() - latest.fetchedAt.getTime() > ttl;

    if (expired) {
      try {
        const data = await this.fetchSnapshot(type, city);
        const snapshot = await this.prisma.weatherSnapshot.create({
          data: {
            cityId,
            type,
            payloadJson: data as Prisma.InputJsonValue,
            fetchedAt: new Date(),
          },
        });
        return {
          data: snapshot.payloadJson,
          fetchedAt: snapshot.fetchedAt,
          isStale: false,
        };
      } catch {
        if (latest) {
          return {
            data: latest.payloadJson,
            fetchedAt: latest.fetchedAt,
            isStale: true,
          };
        }
        throw new ServiceUnavailableException('Upstream unavailable');
      }
    }

    return {
      data: latest.payloadJson,
      fetchedAt: latest.fetchedAt,
      isStale: false,
    };
  }

  private async getSnapshotSafe(
    cityId: string,
    type: SnapshotType,
    city: { lat: number; lon: number; timezone: string },
  ): Promise<SnapshotResult | null> {
    try {
      return await this.getSnapshotWithRefresh(cityId, type, city);
    } catch {
      return null;
    }
  }

  private getLastUpdated(
    snapshots: Array<{ fetchedAt: Date } | null>,
  ): Date | null {
    const dates = snapshots
      .map((snap) => snap?.fetchedAt)
      .filter((value): value is Date => Boolean(value));
    if (dates.length === 0) {
      return null;
    }
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  private hasStale(snapshots: Array<{ isStale: boolean } | null>): boolean {
    return snapshots.some((snap) => snap?.isStale);
  }

  private anyExpired(
    snapshots: Array<{ fetchedAt: Date; type: SnapshotType } | null>,
  ): boolean {
    return snapshots.some((snap) => {
      if (!snap?.fetchedAt || !snap?.type) {
        return false;
      }
      const ttl = TTL_MS[snap.type];
      return Date.now() - snap.fetchedAt.getTime() > ttl;
    });
  }

  private async fetchSnapshot(
    type: SnapshotType,
    city: { lat: number; lon: number; timezone: string },
  ): Promise<OpenMeteoForecastResponse | OpenMeteoAirQualityResponse> {
    if (type === SnapshotType.AIR_QUALITY) {
      const response = await firstValueFrom(
        this.http.get<OpenMeteoAirQualityResponse>(
          'https://air-quality-api.open-meteo.com/v1/air-quality',
          {
            timeout: getOpenMeteoTimeoutMs(),
            params: {
              latitude: city.lat,
              longitude: city.lon,
              hourly: 'pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone',
              timezone: city.timezone,
            },
          },
        ),
      );
      return response.data;
    }

    const params: Record<string, string | number> = {
      latitude: city.lat,
      longitude: city.lon,
      timezone: city.timezone,
    };

    if (type === SnapshotType.CURRENT) {
      params.current =
        'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover,wind_gusts_10m';
    }

    if (type === SnapshotType.HOURLY) {
      params.hourly =
        'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,weather_code';
      params.forecast_hours = 48;
    }

    if (type === SnapshotType.DAILY) {
      params.daily =
        'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset';
      params.forecast_days = 7;
    }

    const response = await firstValueFrom(
      this.http.get<OpenMeteoForecastResponse>(
        'https://api.open-meteo.com/v1/forecast',
        { params, timeout: getOpenMeteoTimeoutMs() },
      ),
    );
    return response.data;
  }
}
