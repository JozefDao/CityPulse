import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { AdminArticlesController } from './admin-articles.controller';
import { AdminArticlesService } from './admin-articles.service';

@Module({
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesService, AdminArticlesService],
})
export class ArticlesModule {}
