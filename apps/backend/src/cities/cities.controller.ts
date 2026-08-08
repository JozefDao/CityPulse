import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CitiesService } from './cities.service';
import { CitySearchResultDto } from './dto/city-search-result.dto';
import { ResolveCityDto } from './dto/resolve-city.dto';

@ApiTags('cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get('search')
  async search(@Query('q') query: string): Promise<CitySearchResultDto[]> {
    return this.citiesService.search(query);
  }

  @Post('resolve')
  async resolve(@Body() dto: ResolveCityDto) {
    return this.citiesService.resolve(dto);
  }
}
