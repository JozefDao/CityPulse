import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CityDashboardResponseDto } from './dto/city-dashboard.dto';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller('cities')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get(':cityId/dashboard')
  @ApiOkResponse({ type: CityDashboardResponseDto })
  async dashboard(@Param('cityId') cityId: string) {
    return this.weatherService.getDashboard(cityId);
  }
}
