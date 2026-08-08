import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleModerationStatus,
  ArticleStatus,
  ModerationSeverity,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminFlaggedArticlesQueryDto } from './dto/admin-flagged-articles-query.dto';
import { AdminFlaggedCommentsQueryDto } from './dto/admin-flagged-comments-query.dto';
import { AdminReviewArticleDto } from './dto/admin-review-article.dto';
import { AdminReviewCommentDto } from './dto/admin-review-comment.dto';
import { CreateArticleCommentDto } from './dto/create-article-comment.dto';
import { CreateOwnArticleDto } from './dto/create-own-article.dto';
import { UpdateArticleCommentDto } from './dto/update-article-comment.dto';
import { UpdateOwnArticleDto } from './dto/update-own-article.dto';

type ModerationCategory = 'PROFANITY' | 'HATE_SPEECH' | 'HARASSMENT';

type ModerationRule = {
  category: ModerationCategory;
  severity: ModerationSeverity;
  words: string[];
};

const MODERATION_RULES: ModerationRule[] = [
  {
    category: 'PROFANITY',
    severity: ModerationSeverity.MEDIUM,
    words: [
      'fuck',
      'fucking',
      'shit',
      'bitch',
      'asshole',
      'cunt',
      'dick',
      'bastard',
      'kurva',
      'pica',
      'pici',
      'picu',
      'pico',
      'picovina',
      'jebat',
      'jebe',
      'jebem',
      'jebak',
      'jebacik',
      'kokot',
      'debil',
      'svina',
      'sviniar',
      'kreten',
      'hajzel',
      'scheisse',
      'arschloch',
      'hurensohn',
      'fotze',
      'wichser',
      'fass',
      'bazmeg',
      'bazdmeg',
    ],
  },
  {
    category: 'HATE_SPEECH',
    severity: ModerationSeverity.HIGH,
    words: ['nigger', 'nigga', 'niga', 'cigan', 'cigani', 'gypsy'],
  },
  {
    category: 'HARASSMENT',
    severity: ModerationSeverity.HIGH,
    words: ['zabijsa', 'killyourself', 'retard'],
  },
];

const MODERATION_ALLOWLIST = new Set<string>([
  'assistant',
  'assistance',
  'classic',
  'classical',
  'assessment',
]);
const MODERATION_STEMS: Array<{
  stem: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
}> = [
  { stem: 'jeb', category: 'PROFANITY', severity: ModerationSeverity.MEDIUM },
  { stem: 'pic', category: 'PROFANITY', severity: ModerationSeverity.MEDIUM },
  { stem: 'kokot', category: 'PROFANITY', severity: ModerationSeverity.MEDIUM },
  { stem: 'nigg', category: 'HATE_SPEECH', severity: ModerationSeverity.HIGH },
  { stem: 'cigan', category: 'HATE_SPEECH', severity: ModerationSeverity.HIGH },
  { stem: 'fass', category: 'PROFANITY', severity: ModerationSeverity.MEDIUM },
  {
    stem: 'bazmeg',
    category: 'PROFANITY',
    severity: ModerationSeverity.MEDIUM,
  },
];

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished() {
    return this.prisma.article.findMany({
      where: { status: ArticleStatus.PUBLISHED },
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async getPublishedBySlug(slug: string) {
    return this.prisma.article.findFirst({
      where: { slug, status: ArticleStatus.PUBLISHED },
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async getArticleStats(slug: string) {
    const article = await this.findPublishedBySlugOrThrow(slug);
    const [likesCount, commentsCount] = await Promise.all([
      this.prisma.articleLike.count({ where: { articleId: article.id } }),
      this.prisma.articleComment.count({
        where: { articleId: article.id, deletedAt: null },
      }),
    ]);

    return {
      articleId: article.id,
      slug: article.slug,
      likesCount,
      commentsCount,
    };
  }

  async listMine(userId: string) {
    return this.prisma.article.findMany({
      where: { authorId: userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async listFavorites(userId: string) {
    const likedArticles = await this.prisma.articleLike.findMany({
      where: {
        userId,
        article: {
          status: ArticleStatus.PUBLISHED,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        article: {
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
            _count: { select: { likes: true, comments: true } },
          },
        },
      },
    });

    return likedArticles.map((item) => item.article);
  }

  async createOwn(userId: string, dto: CreateOwnArticleDto) {
    const manualSlug = dto.slug?.trim();
    if (manualSlug) {
      this.ensureValidManualSlug(manualSlug);
    }

    const baseSlug = manualSlug || dto.title;
    const slug = await this.ensureUniqueSlug(baseSlug);
    const moderation = this.detectModerationFlags(
      [dto.title, dto.summary ?? '', dto.markdown].join(' '),
    );
    const articleModeration = this.getArticleModerationState(moderation);

    return this.prisma.article.create({
      data: {
        authorId: userId,
        title: dto.title,
        slug,
        summary: dto.summary ?? '',
        markdown: dto.markdown,
        status: ArticleStatus.DRAFT,
        publishedAt: null,
        isFlagged: moderation.isFlagged,
        flagCategory: moderation.category,
        flagSeverity: moderation.severity,
        flagReason: moderation.reason,
        moderationStatus: articleModeration.moderationStatus,
      },
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async updateOwn(
    articleId: string,
    userId: string,
    role: Role,
    dto: UpdateOwnArticleDto,
  ) {
    const article = await this.findByIdOrThrow(articleId);
    this.ensureArticlePermission(article.authorId, userId, role);

    let nextSlug = article.slug;
    if (dto.slug && dto.slug.trim() && dto.slug !== article.slug) {
      this.ensureValidManualSlug(dto.slug.trim());
      nextSlug = await this.ensureUniqueSlug(dto.slug, articleId);
    }

    const nextTitle = dto.title ?? article.title;
    const nextSummary = dto.summary ?? article.summary;
    const nextMarkdown = dto.markdown ?? article.markdown;
    const moderation = this.detectModerationFlags(
      [nextTitle, nextSummary, nextMarkdown].join(' '),
    );
    const articleModeration = this.getArticleModerationState(moderation);
    const nextStatus =
      articleModeration.moderationStatus === ArticleModerationStatus.BLOCKED
        ? ArticleStatus.DRAFT
        : article.status;
    const nextPublishedAt =
      nextStatus === ArticleStatus.PUBLISHED ? article.publishedAt : null;

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        title: nextTitle,
        summary: nextSummary,
        markdown: nextMarkdown,
        slug: nextSlug,
        status: nextStatus,
        publishedAt: nextPublishedAt,
        isFlagged: moderation.isFlagged,
        flagCategory: moderation.category,
        flagSeverity: moderation.severity,
        flagReason: moderation.reason,
        moderationStatus: articleModeration.moderationStatus,
      },
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async publishOwn(articleId: string, userId: string, role: Role) {
    const article = await this.findByIdOrThrow(articleId);
    this.ensureArticlePermission(article.authorId, userId, role);

    if (article.moderationStatus === ArticleModerationStatus.BLOCKED) {
      throw new BadRequestException(
        'This article is blocked by moderation and requires admin review before publication',
      );
    }

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: article.publishedAt ?? new Date(),
      },
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async unpublishOwn(articleId: string, userId: string, role: Role) {
    const article = await this.findByIdOrThrow(articleId);
    this.ensureArticlePermission(article.authorId, userId, role);

    return this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      },
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
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async removeOwn(articleId: string, userId: string, role: Role) {
    const article = await this.findByIdOrThrow(articleId);
    this.ensureArticlePermission(article.authorId, userId, role);
    return this.prisma.article.delete({ where: { id: articleId } });
  }

  async listComments(slug: string) {
    const article = await this.findPublishedBySlugOrThrow(slug);
    return this.prisma.articleComment.findMany({
      where: { articleId: article.id, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async createComment(
    slug: string,
    userId: string,
    dto: CreateArticleCommentDto,
  ) {
    const article = await this.findPublishedBySlugOrThrow(slug);
    const moderation = this.detectModerationFlags(dto.body);

    return this.prisma.articleComment.create({
      data: {
        articleId: article.id,
        userId,
        body: dto.body,
        isFlagged: moderation.isFlagged,
        flagCategory: moderation.category,
        flagSeverity: moderation.severity,
        flagReason: moderation.reason,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async updateComment(
    slug: string,
    commentId: string,
    userId: string,
    role: Role,
    dto: UpdateArticleCommentDto,
  ) {
    const article = await this.findPublishedBySlugOrThrow(slug);
    const comment = await this.prisma.articleComment.findFirst({
      where: { id: commentId, articleId: article.id, deletedAt: null },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('You can edit only your own comments');
    }

    const moderation = this.detectModerationFlags(dto.body);

    return this.prisma.articleComment.update({
      where: { id: comment.id },
      data: {
        body: dto.body,
        isFlagged: moderation.isFlagged,
        flagCategory: moderation.category,
        flagSeverity: moderation.severity,
        flagReason: moderation.reason,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async removeComment(
    slug: string,
    commentId: string,
    userId: string,
    role: Role,
  ) {
    const article = await this.findPublishedBySlugOrThrow(slug);
    const comment = await this.prisma.articleComment.findFirst({
      where: { id: commentId, articleId: article.id, deletedAt: null },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('You can delete only your own comments');
    }

    await this.prisma.articleComment.update({
      where: { id: comment.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async reportComment(slug: string, commentId: string, reporterId: string) {
    const article = await this.findPublishedBySlugOrThrow(slug);
    const comment = await this.prisma.articleComment.findFirst({
      where: { id: commentId, articleId: article.id, deletedAt: null },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const commentAuthor = await this.prisma.user.findUnique({
      where: { id: comment.userId },
      select: { role: true },
    });

    if (commentAuthor?.role === Role.ADMIN) {
      throw new BadRequestException('Admin comments cannot be reported');
    }

    const updated = await this.prisma.articleComment.update({
      where: { id: comment.id },
      data: {
        isFlagged: true,
        flagCategory: comment.flagCategory ?? 'HARASSMENT',
        flagSeverity: comment.flagSeverity ?? ModerationSeverity.MEDIUM,
        flagReason: comment.flagReason ?? 'Reported by community user',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.prisma.moderationAuditLog.create({
      data: {
        commentId: comment.id,
        adminId: reporterId,
        action: 'USER_REPORT',
        previousIsFlagged: comment.isFlagged,
        nextIsFlagged: true,
        previousCategory: comment.flagCategory,
        nextCategory: updated.flagCategory,
        previousSeverity: comment.flagSeverity,
        nextSeverity: updated.flagSeverity,
        previousReason: comment.flagReason,
        nextReason: updated.flagReason,
        note: 'Comment reported from public article view',
      },
    });

    return { success: true, commentId: comment.id };
  }

  async listFlaggedComments(query: AdminFlaggedCommentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ArticleCommentWhereInput = { deletedAt: null };

    if (query.flaggedOnly ?? true) {
      where.isFlagged = true;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { body: { contains: term } },
        { user: { nickname: { contains: term } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.articleComment.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
              role: true,
              avatarUrl: true,
            },
          },
          article: { select: { id: true, slug: true, title: true } },
        },
      }),
      this.prisma.articleComment.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async listFlaggedArticles(query: AdminFlaggedArticlesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ArticleWhereInput = {};

    if (query.flaggedOnly ?? true) {
      where.OR = [
        { isFlagged: true },
        { moderationStatus: { not: ArticleModerationStatus.CLEAN } },
      ];
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      const searchFilter: Prisma.ArticleWhereInput = {
        OR: [
          { title: { contains: term } },
          { slug: { contains: term } },
          { summary: { contains: term } },
          { author: { nickname: { contains: term } } },
        ],
      };

      if (query.flaggedOnly ?? true) {
        where.AND = [
          {
            OR: [
              { isFlagged: true },
              { moderationStatus: { not: ArticleModerationStatus.CLEAN } },
            ],
          },
          searchFilter,
        ];
        delete where.OR;
      } else {
        Object.assign(where, searchFilter);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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
          _count: { select: { likes: true, comments: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async reviewArticle(
    articleId: string,
    adminId: string,
    dto: AdminReviewArticleDto,
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const nextModerationStatus = dto.moderationStatus;
    const nextStatus =
      nextModerationStatus === ArticleModerationStatus.BLOCKED
        ? ArticleStatus.DRAFT
        : article.status;
    const nextPublishedAt =
      nextStatus === ArticleStatus.PUBLISHED
        ? (article.publishedAt ?? new Date())
        : null;

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        isFlagged: dto.isFlagged,
        flagCategory: dto.isFlagged
          ? (dto.flagCategory ?? article.flagCategory)
          : null,
        flagSeverity: dto.isFlagged
          ? (dto.flagSeverity ?? article.flagSeverity)
          : null,
        flagReason: dto.isFlagged
          ? (dto.flagReason ?? article.flagReason)
          : null,
        moderationStatus: nextModerationStatus,
        status: nextStatus,
        publishedAt: nextPublishedAt,
      },
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
        _count: { select: { likes: true, comments: true } },
      },
    });

    void adminId;

    return updated;
  }

  async reviewComment(
    commentId: string,
    adminId: string,
    dto: AdminReviewCommentDto,
  ) {
    const comment = await this.prisma.articleComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    const nextCategory = dto.isFlagged
      ? (dto.flagCategory ?? comment.flagCategory)
      : null;
    const nextSeverity = dto.isFlagged
      ? (dto.flagSeverity ?? comment.flagSeverity)
      : null;
    const nextReason = dto.isFlagged
      ? (dto.flagReason ?? comment.flagReason)
      : null;

    const updated = await this.prisma.articleComment.update({
      where: { id: commentId },
      data: {
        isFlagged: dto.isFlagged,
        flagCategory: nextCategory,
        flagSeverity: nextSeverity,
        flagReason: nextReason,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            avatarUrl: true,
          },
        },
        article: { select: { id: true, slug: true, title: true } },
      },
    });

    await this.prisma.moderationAuditLog.create({
      data: {
        commentId,
        adminId,
        action: dto.isFlagged ? 'RE_FLAG' : 'APPROVE_UNFLAG',
        previousIsFlagged: comment.isFlagged,
        nextIsFlagged: dto.isFlagged,
        previousCategory: comment.flagCategory,
        nextCategory,
        previousSeverity: comment.flagSeverity,
        nextSeverity,
        previousReason: comment.flagReason,
        nextReason,
        note: dto.note ?? null,
      },
    });

    return updated;
  }

  async likeArticle(slug: string, userId: string) {
    const article = await this.findPublishedBySlugOrThrow(slug);

    await this.prisma.articleLike.upsert({
      where: { articleId_userId: { articleId: article.id, userId } },
      update: {},
      create: { articleId: article.id, userId },
    });

    return this.getLikeState(slug, userId);
  }

  async unlikeArticle(slug: string, userId: string) {
    const article = await this.findPublishedBySlugOrThrow(slug);

    await this.prisma.articleLike.deleteMany({
      where: { articleId: article.id, userId },
    });

    return this.getLikeState(slug, userId);
  }

  async getLikeState(slug: string, userId: string) {
    const article = await this.findPublishedBySlugOrThrow(slug);

    const [likedRecord, likesCount] = await Promise.all([
      this.prisma.articleLike.findUnique({
        where: { articleId_userId: { articleId: article.id, userId } },
      }),
      this.prisma.articleLike.count({ where: { articleId: article.id } }),
    ]);

    return { articleId: article.id, liked: Boolean(likedRecord), likesCount };
  }

  private async findPublishedBySlugOrThrow(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: { slug, status: ArticleStatus.PUBLISHED },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  private async findByIdOrThrow(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  private ensureArticlePermission(
    authorId: string,
    userId: string,
    role: Role,
  ) {
    if (authorId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('You can manage only your own articles');
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private ensureValidManualSlug(value: string) {
    const normalized = value.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      throw new BadRequestException(
        'Slug can contain only lowercase letters, numbers, and hyphens',
      );
    }
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

  private getArticleModerationState(moderation: {
    isFlagged: boolean;
    category: ModerationCategory | null;
    severity: ModerationSeverity | null;
    reason: string | null;
  }) {
    void moderation.category;
    void moderation.reason;

    if (!moderation.isFlagged) {
      return { moderationStatus: ArticleModerationStatus.CLEAN };
    }

    if (moderation.severity === ModerationSeverity.HIGH) {
      return { moderationStatus: ArticleModerationStatus.BLOCKED };
    }

    return { moderationStatus: ArticleModerationStatus.EXPLICIT };
  }

  private normalizeForModeration(content: string): string {
    const lowered = content.toLowerCase();
    const withoutDiacritics = lowered
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const deobfuscated = withoutDiacritics
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't');

    return deobfuscated
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private detectModerationFlags(content: string) {
    const normalized = this.normalizeForModeration(content);
    const tokens = normalized
      .split(' ')
      .filter(Boolean)
      .filter((token) => !MODERATION_ALLOWLIST.has(token));
    for (const token of tokens) {
      for (const stemRule of MODERATION_STEMS) {
        if (token.startsWith(stemRule.stem)) {
          return {
            isFlagged: true,
            category: stemRule.category,
            severity: stemRule.severity,
            reason:
              'Potential ' +
              stemRule.category.toLowerCase() +
              ' detected: ' +
              stemRule.stem +
              '*',
          };
        }
      }
    }

    for (const rule of MODERATION_RULES) {
      for (const word of rule.words) {
        const matchesToken = tokens.some((token) => {
          if (
            token === word ||
            token.startsWith(word) ||
            token.endsWith(word)
          ) {
            return true;
          }

          if (word.length >= 4 && token.includes(word)) {
            return true;
          }

          const fuzzy = word.split('').join('[a-z0-9]{0,2}');
          return new RegExp(`^${fuzzy}$`).test(token);
        });

        if (matchesToken) {
          return {
            isFlagged: true,
            category: rule.category,
            severity: rule.severity,
            reason:
              'Potential ' + rule.category.toLowerCase() + ' detected: ' + word,
          };
        }
      }
    }

    return {
      isFlagged: false,
      category: null as ModerationCategory | null,
      severity: null as ModerationSeverity | null,
      reason: null as string | null,
    };
  }
}
