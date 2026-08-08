import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getOpenMeteoTimeoutMs } from '../common/open-meteo-timeout';
import { PrismaService } from '../prisma/prisma.service';
import { CitySearchResultDto } from './dto/city-search-result.dto';
import { ResolveCityDto } from './dto/resolve-city.dto';

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name: string;
    country_code?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

@Injectable()
export class CitiesService {
  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async search(query?: string): Promise<CitySearchResultDto[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const response = await firstValueFrom(
      this.http.get<OpenMeteoGeocodingResponse>(
        'https://geocoding-api.open-meteo.com/v1/search',
        {
          timeout: getOpenMeteoTimeoutMs(),
          params: {
            name: query.trim(),
            count: 10,
            language: 'en',
            format: 'json',
          },
        },
      ),
    );

    const results = response.data?.results ?? [];
    return results.map((item) => ({
      name: item.name,
      countryCode: item.country_code,
      lat: item.latitude,
      lon: item.longitude,
      timezone: item.timezone,
    }));
  }

  async resolve(dto: ResolveCityDto) {
    const existing = await this.prisma.city.findFirst({
      where: {
        name: dto.name,
        lat: dto.lat,
        lon: dto.lon,
        timezone: dto.timezone,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.city.create({
      data: {
        name: dto.name,
        countryCode: dto.countryCode,
        lat: dto.lat,
        lon: dto.lon,
        timezone: dto.timezone,
      },
    });
  }
}
