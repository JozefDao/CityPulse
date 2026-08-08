import { ApiProperty } from '@nestjs/swagger';
import { ModerationSeverity } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminReviewCommentDto {
  @ApiProperty({ description: 'Final moderation decision for comment' })
  @IsBoolean()
  isFlagged!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  flagCategory?: string;

  @ApiProperty({ enum: ModerationSeverity, required: false })
  @IsOptional()
  @IsEnum(ModerationSeverity)
  flagSeverity?: ModerationSeverity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  flagReason?: string;

  @ApiProperty({
    required: false,
    description: 'Admin note for moderation audit log',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
