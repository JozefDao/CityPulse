import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Flag, Heart, MessageCircle, Pencil, Send, Share2, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { Skeleton } from '../components/ui/skeleton';
import { api, getApiErrorMessage, resolveMediaUrl } from '../lib/api';
import { getManagedAvatarPath, getNicknameInitials } from '../lib/avatar';
import { authStore } from '../lib/auth-store';
import type { ArticleCommentDto, ArticleDto, ArticleLikeStateDto, ArticleStatsDto, UserDto } from '../lib/types';

const GUIDE_STALE_TIME = 5 * 60 * 1000;
const MAX_INLINE_TRANSLATE_CHARS = 1200;

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'sk', label: 'Slovak' },
  { code: 'cs', label: 'Czech' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'pl', label: 'Polish' },
];

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleString();
}

function getGoogleTranslateUrl(text: string, targetLanguage: string): string {
  const encodedText = encodeURIComponent(text);
  return `https://translate.google.com/?sl=auto&tl=${targetLanguage}&text=${encodedText}&op=translate`;
}

function getGoogleTranslateHomeUrl(targetLanguage: string): string {
  return `https://translate.google.com/?sl=auto&tl=${targetLanguage}&op=translate`;
}


const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  ),
};

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  const hasToken = Boolean(authState.accessToken);

  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translateHint, setTranslateHint] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const [shareHint, setShareHint] = useState<string | null>(null);

  const articleQuery = useQuery({
    queryKey: ['article', slug],
    queryFn: async () => {
      const response = await api.get<ArticleDto>(`/articles/${slug}`);
      return response.data;
    },
    enabled: typeof slug === 'string' && slug.length > 0,
    staleTime: GUIDE_STALE_TIME,
  });

  const statsQuery = useQuery({
    queryKey: ['article', slug, 'stats'],
    queryFn: async () => {
      const response = await api.get<ArticleStatsDto>(`/articles/${slug}/stats`);
      return response.data;
    },
    enabled: typeof slug === 'string' && slug.length > 0,
    staleTime: GUIDE_STALE_TIME,
  });

  const commentsQuery = useQuery({
    queryKey: ['article', slug, 'comments'],
    queryFn: async () => {
      const response = await api.get<ArticleCommentDto[]>(`/articles/${slug}/comments`);
      return response.data;
    },
    enabled: typeof slug === 'string' && slug.length > 0,
    staleTime: GUIDE_STALE_TIME,
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await api.get<UserDto>('/me');
      return response.data;
    },
    enabled: hasToken,
    staleTime: GUIDE_STALE_TIME,
  });

  const likeStateQuery = useQuery({
    queryKey: ['article', slug, 'like-state'],
    queryFn: async () => {
      const response = await api.get<ArticleLikeStateDto>(`/articles/${slug}/like`);
      return response.data;
    },
    enabled: hasToken && typeof slug === 'string' && slug.length > 0,
    staleTime: GUIDE_STALE_TIME,
  });

  const isNotFound = axios.isAxiosError(articleQuery.error) && articleQuery.error.response?.status === 404;

  const translateSourceText = useMemo(() => {
    if (!articleQuery.data) {
      return '';
    }

    return `${articleQuery.data.title}\n\n${articleQuery.data.markdown}`;
  }, [articleQuery.data]);

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (!slug) {
        return;
      }

      const liked = likeStateQuery.data?.liked ?? false;
      if (liked) {
        await api.delete(`/articles/${slug}/like`);
      } else {
        await api.post(`/articles/${slug}/like`);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'like-state'] }),
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['articles', 'favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
      ]);
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      if (!slug) {
        return;
      }
      await api.post(`/articles/${slug}/comments`, { body: commentBody.trim() });
    },
    onSuccess: async () => {
      setCommentBody('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['articles', 'favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
      ]);
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async () => {
      if (!slug || !editCommentId) {
        return;
      }
      await api.patch(`/articles/${slug}/comments/${editCommentId}`, {
        body: editCommentBody.trim(),
      });
    },
    onSuccess: async () => {
      setEditCommentId(null);
      setEditCommentBody('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
      ]);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!slug) {
        return;
      }
      await api.delete(`/articles/${slug}/comments/${commentId}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['articles', 'favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
      ]);
    },
  });


  const reportCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!slug) {
        return;
      }
      await api.post(`/articles/${slug}/comments/${commentId}/report`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['article', slug, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
      ]);
    },
  });
  const handleTranslate = async () => {
    if (!translateSourceText.trim()) {
      return;
    }

    setTranslateHint(null);

    const canInlineTranslate = translateSourceText.length <= MAX_INLINE_TRANSLATE_CHARS;
    const url = canInlineTranslate
      ? getGoogleTranslateUrl(translateSourceText, targetLanguage)
      : getGoogleTranslateHomeUrl(targetLanguage);

    window.open(url, '_blank', 'noopener,noreferrer');

    if (!canInlineTranslate) {
      try {
        await navigator.clipboard.writeText(translateSourceText);
        setTranslateHint('Article text was copied. Paste it in Google Translate after the tab opens.');
      } catch {
        setTranslateHint('Open tab ready. Copy the article text manually and paste it into Google Translate.');
      }
    }
  };

  const handleShare = async () => {
    setShareHint(null);
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: articleQuery.data?.title ?? 'CityPulse article',
          text: articleQuery.data?.summary ?? 'Check this CityPulse guide',
          url: shareUrl,
        });
        setShareHint('Shared successfully.');
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareHint('Link copied to clipboard.');
    } catch {
      setShareHint('Share was cancelled or not available.');
    }
  };

  const likesCount = likeStateQuery.data?.likesCount ?? statsQuery.data?.likesCount ?? 0;
  const commentsCount = statsQuery.data?.commentsCount ?? commentsQuery.data?.length ?? 0;
  const sortedComments = useMemo(() => {
    const items = commentsQuery.data ?? [];
    return [...items].sort((a, b) => {
      const primary = Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt);
      if (primary !== 0) return primary;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [commentsQuery.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link to="/guides" className="inline-flex text-sm font-medium text-primary hover:underline">
          Back to guides
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label htmlFor="translate-language" className="text-sm text-muted-foreground">
            Language
          </label>
          <select
            id="translate-language"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
          >
            {languageOptions.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleTranslate()}
            className="inline-flex w-full justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted sm:w-auto"
          >
            Translate article
          </button>
        </div>
      </div>

      {translateHint ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{translateHint}</p>
      ) : null}

      {shareHint ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{shareHint}</p>
      ) : null}

      {articleQuery.isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {articleQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{isNotFound ? 'Article not found' : 'Error loading article'}</CardTitle>
            <CardDescription>
              {isNotFound
                ? 'The requested article does not exist or is not published.'
                : getApiErrorMessage(articleQuery.error)}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {articleQuery.data ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{articleQuery.data.title}</CardTitle>
              {articleQuery.data.moderationStatus === 'EXPLICIT' ? (
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Explicit</span>
              ) : null}
              {articleQuery.data.moderationStatus === 'BLOCKED' ? (
                <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">Blocked</span>
              ) : null}
            </div>
            <CardDescription>
              Published: {formatDate(articleQuery.data.publishedAt)}
              {' | '}
              Updated: {formatDate(articleQuery.data.updatedAt ?? articleQuery.data.createdAt)}
            </CardDescription>

            {articleQuery.data.author ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Author:</span>
                {resolveMediaUrl(getManagedAvatarPath(articleQuery.data.author.avatarUrl)) ? (
                  <img
                    src={resolveMediaUrl(getManagedAvatarPath(articleQuery.data.author.avatarUrl)) ?? undefined}
                    alt={articleQuery.data.author.nickname}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {getNicknameInitials(articleQuery.data.author.nickname)}
                  </span>
                )}
                <Link to={`/authors/${articleQuery.data.author.id}`} className="font-medium text-primary hover:underline">
                  {articleQuery.data.author.nickname}
                </Link>
                {articleQuery.data.author.role === 'ADMIN' ? (
                  <span className="rounded-md border border-input px-2 py-0.5 text-xs">ADMIN</span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => toggleLikeMutation.mutate()}
                disabled={!hasToken || toggleLikeMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                title={hasToken ? 'Save this article to favorites' : 'Login to save to favorites'}
              >
                <Heart className={`h-4 w-4 ${likeStateQuery.data?.liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                <span>{likeStateQuery.data?.liked ? 'Saved' : 'Save'}</span>
                <span>{likesCount}</span>
              </button>

              <span className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span>{commentsCount}</span>
              </span>

              <button
                type="button"
                onClick={() => void handleShare()}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
            </div>
          </CardHeader>

          <CardContent>
            <article className="prose prose-slate max-w-none prose-table:border prose-table:border-border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-li:marker:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {articleQuery.data.markdown}
              </ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
          <CardDescription>{hasToken ? 'Write and discuss this guide.' : 'Login to add comments.'}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {hasToken ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (commentBody.trim().length < 2) {
                  return;
                }
                createCommentMutation.mutate();
              }}
            >
              <textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Write a comment..."
                className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
              />
              <button
                type="submit"
                disabled={createCommentMutation.isPending || commentBody.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                <span>{createCommentMutation.isPending ? 'Posting...' : 'Post comment'}</span>
              </button>
            </form>
          ) : null}

          {commentsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}

          {commentsQuery.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(commentsQuery.error)}
            </p>
          ) : null}

          {!commentsQuery.isLoading && !commentsQuery.isError && (commentsQuery.data?.length ?? 0) === 0 ? (
            <EmptyStateCard
              title="No comments yet"
              description={hasToken ? 'Start the discussion with the first comment on this guide.' : 'Login if you want to join the discussion under this guide.'}
              footer={hasToken ? 'Keep it useful: comment on weather interpretation, route ideas, or local conditions.' : 'Comments, likes, and creator interactions unlock after login.'}
            />
          ) : null}

          {sortedComments.map((comment) => {
            const canManage = meQuery.data?.id === comment.userId || meQuery.data?.role === 'ADMIN';
            const canReport = hasToken && !canManage && comment.user.role !== 'ADMIN';
            const isEditing = editCommentId === comment.id;

            return (
              <div key={comment.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    {resolveMediaUrl(getManagedAvatarPath(comment.user.avatarUrl)) ? (
                      <img
                        src={resolveMediaUrl(getManagedAvatarPath(comment.user.avatarUrl)) ?? undefined}
                        alt={comment.user.nickname}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {getNicknameInitials(comment.user.nickname)}
                      </div>
                    )}
                    <span className="text-sm font-medium">{comment.user.nickname}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(comment.updatedAt)}</span>
                </div>

                {isEditing ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (editCommentBody.trim().length < 2) {
                        return;
                      }
                      updateCommentMutation.mutate();
                    }}
                  >
                    <textarea
                      value={editCommentBody}
                      onChange={(event) => setEditCommentBody(event.target.value)}
                      className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updateCommentMutation.isPending || editCommentBody.trim().length < 2}
                        className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCommentId(null);
                          setEditCommentBody('');
                        }}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : comment.isFlagged ? (
                  <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Comment hidden by moderation.</span>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{comment.body}</p>
                )}

                {canManage && !isEditing ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditCommentId(comment.id);
                        setEditCommentBody(comment.body);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      disabled={deleteCommentMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                ) : canReport && !isEditing ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => reportCommentMutation.mutate(comment.id)}
                      disabled={reportCommentMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      <span>Report</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}








