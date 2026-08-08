import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderWatchlistDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  cityIds!: string[];
}
