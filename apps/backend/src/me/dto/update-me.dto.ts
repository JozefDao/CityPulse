import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 24,
    description: 'Letters, numbers and underscore only',
  })
  @IsOptional()
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-zA-Z0-9_]+$/)
  nickname?: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;
}
