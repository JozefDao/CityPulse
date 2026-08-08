import { AlertMetric, AlertOperator } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateAlertRuleDto {
  @ApiPropertyOptional({ enum: AlertMetric })
  @IsOptional()
  @IsEnum(AlertMetric)
  metric?: AlertMetric;

  @ApiPropertyOptional({ enum: AlertOperator })
  @IsOptional()
  @IsEnum(AlertOperator)
  operator?: AlertOperator;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
