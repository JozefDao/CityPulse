import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CityDashboardCityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  countryCode?: string | null;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;

  @ApiProperty()
  timezone: string;
}

export class CityDashboardCurrentDto {
  @ApiPropertyOptional()
  time?: string;

  @ApiPropertyOptional()
  temperature?: number;

  @ApiPropertyOptional()
  apparentTemperature?: number;

  @ApiPropertyOptional()
  humidity?: number;

  @ApiPropertyOptional()
  precipitation?: number;

  @ApiPropertyOptional()
  windSpeed?: number;

  @ApiPropertyOptional()
  windGusts?: number;

  @ApiPropertyOptional()
  windDirection?: number;

  @ApiPropertyOptional()
  weatherCode?: number;
}

export class CityDashboardHourlyDto {
  @ApiProperty({ type: [String] })
  times: string[];

  @ApiPropertyOptional({ type: [Number] })
  temperature?: number[];

  @ApiPropertyOptional({ type: [Number] })
  precipitation?: number[];

  @ApiPropertyOptional({ type: [Number] })
  windSpeed?: number[];

  @ApiPropertyOptional({ type: [Number] })
  windGusts?: number[];

  @ApiPropertyOptional({ type: [Number] })
  humidity?: number[];

  @ApiPropertyOptional({ type: [Number] })
  weatherCode?: number[];
}

export class CityDashboardDailyDto {
  @ApiProperty({ type: [String] })
  dates: string[];

  @ApiPropertyOptional({ type: [Number] })
  tempMin?: number[];

  @ApiPropertyOptional({ type: [Number] })
  tempMax?: number[];

  @ApiPropertyOptional({ type: [Number] })
  precipitationSum?: number[];

  @ApiPropertyOptional({ type: [Number] })
  windMax?: number[];

  @ApiPropertyOptional({ type: [String] })
  sunrise?: string[];

  @ApiPropertyOptional({ type: [String] })
  sunset?: string[];
}

export class CityDashboardAirQualityDto {
  @ApiProperty({ type: [String] })
  times: string[];

  @ApiPropertyOptional({ type: [Number] })
  pm25?: number[];

  @ApiPropertyOptional({ type: [Number] })
  pm10?: number[];

  @ApiPropertyOptional({ type: [Number] })
  no2?: number[];

  @ApiPropertyOptional({ type: [Number] })
  o3?: number[];
}

export class CityDashboardMetaDto {
  @ApiProperty()
  lastUpdated: string;

  @ApiProperty()
  isStale: boolean;

  @ApiProperty()
  sources: {
    current: boolean;
    hourly: boolean;
    daily: boolean;
    airQuality: boolean;
  };
}

export class CityDashboardResponseDto {
  @ApiProperty()
  city: CityDashboardCityDto;

  @ApiProperty()
  current: CityDashboardCurrentDto;

  @ApiProperty()
  hourly: CityDashboardHourlyDto;

  @ApiProperty()
  daily: CityDashboardDailyDto;

  @ApiProperty()
  airQuality: CityDashboardAirQualityDto;

  @ApiProperty()
  meta: CityDashboardMetaDto;
}
