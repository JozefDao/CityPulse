import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArticleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateArticleDto } from './dto/admin-create-article.dto';
import { AdminUpdateArticleDto } from './dto/admin-update-article.dto';
import { AdminArticlesQueryDto } from './dto/admin-articles-query.dto';

@Injectable()
export class AdminArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminArticlesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ArticleWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [{ title: { contains: term } }, { slug: { contains: term } }];
    }

    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getById(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  async create(authorId: string, dto: AdminCreateArticleDto) {
    const baseSlug = dto.slug ?? this.slugify(dto.title);
    const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

    return this.prisma.article.create({
      data: {
        authorId,
        title: dto.title,
        summary: dto.summary ?? '',
        markdown: dto.markdown,
        slug: uniqueSlug,
        status: ArticleStatus.DRAFT,
      },
    });
  }

  async update(id: string, dto: AdminUpdateArticleDto) {
    const existing = await this.getById(id);

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.ensureUniqueSlug(dto.slug, id);
    } else if (dto.title && !dto.slug) {
      // Do not auto-change slug on title edit unless slug explicitly provided.
      slug = existing.slug;
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        summary: dto.summary ?? existing.summary,
        markdown: dto.markdown ?? existing.markdown,
        slug,
      },
    });
  }

  async publish(id: string) {
    await this.getById(id);
    return this.prisma.article.update({
      where: { id },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string) {
    await this.getById(id);
    return this.prisma.article.update({
      where: { id },
      data: {
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    return this.prisma.article.delete({ where: { id } });
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private async ensureUniqueSlug(base: string, excludeId?: string) {
    const normalized = this.slugify(base);
    if (!normalized) {
      throw new BadRequestException('Invalid slug');
    }

    let slug = normalized;
    let counter = 2;
    while (true) {
      const existing = await this.prisma.article.findFirst({
        where: {
          slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) {
        return slug;
      }
      slug = `${normalized}-${counter}`;
      counter += 1;
    }
  }
}
