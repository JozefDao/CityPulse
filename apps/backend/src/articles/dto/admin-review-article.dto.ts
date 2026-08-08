import { ApiProperty } from '@nestjs/swagger';
import { ArticleModerationStatus, ModerationSeverity } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminReviewArticleDto {
  @ApiProperty()
  @IsBoolean()
  isFlagged!: boolean;

  @ApiProperty({ enum: ArticleModerationStatus })
  @IsEnum(ArticleModerationStatus)
  moderationStatus!: ArticleModerationStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  flagCategory?: string | null;

  @ApiProperty({ enum: ModerationSeverity, required: false })
  @IsOptional()
  @IsEnum(ModerationSeverity)
  flagSeverity?: ModerationSeverity | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  flagReason?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
