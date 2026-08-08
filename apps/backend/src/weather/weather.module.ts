import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { WeatherScheduler } from './weather.scheduler';

@Module({
  imports: [HttpModule],
  controllers: [WeatherController],
  providers: [WeatherService, WeatherScheduler],
  exports: [WeatherService, WeatherScheduler],
})
export class WeatherModule {}
