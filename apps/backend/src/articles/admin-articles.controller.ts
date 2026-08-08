import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminArticlesService } from './admin-articles.service';
import { AdminCreateArticleDto } from './dto/admin-create-article.dto';
import { AdminUpdateArticleDto } from './dto/admin-update-article.dto';
import { AdminArticlesQueryDto } from './dto/admin-articles-query.dto';
import { AdminArticlesPageDto } from './dto/admin-articles-page.dto';
import { AdminArticleDto } from './dto/admin-article.dto';

type RequestUser = { id: string; role: Role };

@ApiTags('admin/articles')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly adminArticlesService: AdminArticlesService) {}

  @Get()
  @ApiOkResponse({ type: AdminArticlesPageDto })
  async list(@Query() query: AdminArticlesQueryDto) {
    return this.adminArticlesService.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminArticleDto })
  async detail(@Param('id') id: string) {
    return this.adminArticlesService.getById(id);
  }

  @Post()
  @ApiOkResponse({ type: AdminArticleDto })
  async create(@Req() req: Request, @Body() dto: AdminCreateArticleDto) {
    const user = req.user as RequestUser;
    return this.adminArticlesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminArticleDto })
  async update(@Param('id') id: string, @Body() dto: AdminUpdateArticleDto) {
    return this.adminArticlesService.update(id, dto);
  }

  @Post(':id/publish')
  @ApiOkResponse({ type: AdminArticleDto })
  async publish(@Param('id') id: string) {
    return this.adminArticlesService.publish(id);
  }

  @Post(':id/unpublish')
  @ApiOkResponse({ type: AdminArticleDto })
  async unpublish(@Param('id') id: string) {
    return this.adminArticlesService.unpublish(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.adminArticlesService.remove(id);
  }
}
