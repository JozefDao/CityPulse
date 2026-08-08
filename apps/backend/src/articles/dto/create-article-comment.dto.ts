import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateArticleCommentDto {
  @ApiProperty({ minLength: 2, maxLength: 1000 })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  body!: string;
}
