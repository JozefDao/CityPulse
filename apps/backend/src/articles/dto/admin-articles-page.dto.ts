import { ApiProperty } from '@nestjs/swagger';
import { AdminArticleDto } from './admin-article.dto';

export class AdminArticlesPageDto {
  @ApiProperty({ type: [AdminArticleDto] })
  items: AdminArticleDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  total: number;
}
