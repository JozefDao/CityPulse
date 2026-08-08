import { AlertMetric, AlertOperator } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';

export class CreateAlertRuleDto {
  @ApiProperty()
  @IsString()
  cityId!: string;

  @ApiProperty({ enum: AlertMetric })
  @IsEnum(AlertMetric)
  metric!: AlertMetric;

  @ApiProperty({ enum: AlertOperator })
  @IsEnum(AlertOperator)
  operator!: AlertOperator;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  threshold!: number;
}
