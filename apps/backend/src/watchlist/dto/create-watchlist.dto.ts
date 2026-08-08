import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateWatchlistDto {
  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lon?: number;

  @IsOptional()
  @IsString()
  timezone?: string;
}
