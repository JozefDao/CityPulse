import { Injectable, NotFoundException } from '@nestjs/common';
import { ArticleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPublicUsers(query: string) {
    const q = query.trim().toLowerCase();

    if (!q) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        nickname: {
          contains: q,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const publishedArticlesCount = await this.prisma.article.count({
      where: {
        authorId: userId,
        status: ArticleStatus.PUBLISHED,
      },
    });

    return {
      ...user,
      publishedArticlesCount,
    };
  }

  async getPublishedArticlesByAuthor(userId: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.article.findMany({
      where: {
        authorId: userId,
        status: ArticleStatus.PUBLISHED,
      },
      orderBy: { publishedAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });
  }
}
