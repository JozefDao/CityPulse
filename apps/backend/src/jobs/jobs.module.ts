import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { WeatherModule } from '../weather/weather.module';
import { CronSecretGuard } from './cron-secret.guard';
import { JobLeaseService } from './job-lease.service';
import { JobsController } from './jobs.controller';

@Module({
  imports: [WeatherModule, AlertsModule],
  controllers: [JobsController],
  providers: [JobLeaseService, CronSecretGuard],
})
export class JobsModule {}
