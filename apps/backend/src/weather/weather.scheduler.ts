import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherService } from './weather.service';

@Injectable()
export class WeatherScheduler {
  private readonly logger = new Logger(WeatherScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherService: WeatherService,
  ) {}

  async refreshSnapshots() {
    const watchedCities = await this.prisma.userCity.findMany({
      distinct: ['cityId'],
      select: { cityId: true },
    });

    for (const entry of watchedCities) {
      try {
        await this.weatherService.refreshCitySnapshots(entry.cityId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Scheduler refresh failed for city ${entry.cityId}: ${message}`,
        );
      }
    }
  }
}
