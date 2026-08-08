import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ArticlesService } from './articles.service';
import { AdminFlaggedArticlesQueryDto } from './dto/admin-flagged-articles-query.dto';
import { AdminFlaggedCommentsQueryDto } from './dto/admin-flagged-comments-query.dto';
import { AdminReviewArticleDto } from './dto/admin-review-article.dto';
import { AdminReviewCommentDto } from './dto/admin-review-comment.dto';
import { CreateArticleCommentDto } from './dto/create-article-comment.dto';
import { CreateOwnArticleDto } from './dto/create-own-article.dto';
import { UpdateArticleCommentDto } from './dto/update-article-comment.dto';
import { UpdateOwnArticleDto } from './dto/update-own-article.dto';

type RequestUser = {
  id: string;
  email: string;
  role: Role;
};

type RequestWithUser = Request & { user?: RequestUser };

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async list() {
    return this.articlesService.listPublished();
  }

  @Get(':slug/stats')
  async stats(@Param('slug') slug: string) {
    return this.articlesService.getArticleStats(slug);
  }

  @Get(':slug/comments')
  async comments(@Param('slug') slug: string) {
    return this.articlesService.listComments(slug);
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const article = await this.articlesService.getPublishedBySlug(slug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/mine')
  async listMine(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.listMine(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/favorites')
  async listFavorites(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.listFavorites(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async createOwn(
    @Req() req: RequestWithUser,
    @Body() dto: CreateOwnArticleDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.createOwn(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateOwn(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateOwnArticleDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.updateOwn(id, user.id, user.role, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/publish')
  async publishOwn(@Param('id') id: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.publishOwn(id, user.id, user.role);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/unpublish')
  async unpublishOwn(@Param('id') id: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.unpublishOwn(id, user.id, user.role);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removeOwn(@Param('id') id: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.removeOwn(id, user.id, user.role);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/moderation/comments')
  async listFlaggedComments(@Query() query: AdminFlaggedCommentsQueryDto) {
    return this.articlesService.listFlaggedComments(query);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/moderation/articles')
  async listFlaggedArticles(@Query() query: AdminFlaggedArticlesQueryDto) {
    return this.articlesService.listFlaggedArticles(query);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/moderation/comments/:commentId')
  async reviewComment(
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
    @Body() dto: AdminReviewCommentDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.reviewComment(commentId, user.id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/moderation/articles/:articleId')
  async reviewArticle(
    @Param('articleId') articleId: string,
    @Req() req: RequestWithUser,
    @Body() dto: AdminReviewArticleDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.reviewArticle(articleId, user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':slug/like')
  async like(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.likeArticle(slug, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':slug/like')
  async unlike(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.unlikeArticle(slug, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':slug/like')
  async likeState(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.getLikeState(slug, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':slug/comments')
  async createComment(
    @Param('slug') slug: string,
    @Req() req: RequestWithUser,
    @Body() dto: CreateArticleCommentDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.createComment(slug, user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':slug/comments/:commentId')
  async updateComment(
    @Param('slug') slug: string,
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateArticleCommentDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.updateComment(
      slug,
      commentId,
      user.id,
      user.role,
      dto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':slug/comments/:commentId/report')
  async reportComment(
    @Param('slug') slug: string,
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.reportComment(slug, commentId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':slug/comments/:commentId')
  async removeComment(
    @Param('slug') slug: string,
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.articlesService.removeComment(
      slug,
      commentId,
      user.id,
      user.role,
    );
  }
}
