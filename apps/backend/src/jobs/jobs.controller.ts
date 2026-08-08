import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { AlertsScheduler } from '../alerts/alerts.scheduler';
import { WeatherScheduler } from '../weather/weather.scheduler';
import { CronSecretGuard } from './cron-secret.guard';
import { JobLeaseService } from './job-lease.service';

@ApiExcludeController()
@SkipThrottle()
@UseGuards(CronSecretGuard)
@Controller('internal/jobs')
export class JobsController {
  constructor(
    private readonly jobLease: JobLeaseService,
    private readonly weatherScheduler: WeatherScheduler,
    private readonly alertsScheduler: AlertsScheduler,
  ) {}

  @Post('weather-refresh')
  @HttpCode(HttpStatus.OK)
  async refreshWeather() {
    const result = await this.jobLease.runExclusive('weather-refresh', () =>
      this.weatherScheduler.refreshSnapshots(),
    );

    return result.acquired
      ? { status: 'completed' }
      : { status: 'skipped_locked' };
  }

  @Post('alerts-evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluateAlerts() {
    const result = await this.jobLease.runExclusive('alerts-evaluate', () =>
      this.alertsScheduler.evaluateRules(),
    );

    return result.acquired
      ? { status: 'completed' }
      : { status: 'skipped_locked' };
  }
}
