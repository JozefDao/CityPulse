import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Flag, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { api, getApiErrorMessage } from '../lib/api';
import type { AdminModerationArticlesPageDto, AdminModerationPageDto, UserDto } from '../lib/types';

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function AdminModerationPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<UserDto>('/me')).data,
    staleTime: 0,
  });

  const moderationQuery = useQuery({
    queryKey: ['admin', 'moderation', 'comments'],
    queryFn: async () =>
      (await api.get<AdminModerationPageDto>('/articles/admin/moderation/comments', {
        params: { page: 1, pageSize: 100 },
      })).data,
    enabled: meQuery.data?.role === 'ADMIN',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const articleModerationQuery = useQuery({
    queryKey: ['admin', 'moderation', 'articles'],
    queryFn: async () =>
      (await api.get<AdminModerationArticlesPageDto>('/articles/admin/moderation/articles', {
        params: { page: 1, pageSize: 100 },
      })).data,
    enabled: meQuery.data?.role === 'ADMIN',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const items = moderationQuery.data?.items ?? [];
  const articleItems = articleModerationQuery.data?.items ?? [];
  const count = items.length;
  const articleCount = articleItems.length;

  const removeSelectedIfPresent = (commentId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== commentId));
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ commentId, isFlagged }: { commentId: string; isFlagged: boolean }) => {
      return api.patch(`/articles/admin/moderation/comments/${commentId}`, {
        isFlagged,
        flagReason: isFlagged ? 'Manually re-flagged by admin.' : null,
      });
    },
    onSuccess: async (_data, vars) => {
      if (!vars.isFlagged) {
        removeSelectedIfPresent(vars.commentId);
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] });
      await queryClient.invalidateQueries({ queryKey: ['article'] });
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] });
    },
  });

  const articleReviewMutation = useMutation({
    mutationFn: async ({
      articleId,
      moderationStatus,
      isFlagged,
      flagReason,
    }: {
      articleId: string;
      moderationStatus: 'CLEAN' | 'EXPLICIT' | 'BLOCKED';
      isFlagged: boolean;
      flagReason?: string | null;
    }) => {
      return api.patch(`/articles/admin/moderation/articles/${articleId}`, {
        moderationStatus,
        isFlagged,
        flagReason: flagReason ?? null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'articles'] }),
        queryClient.invalidateQueries({ queryKey: ['articles', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['articles'] }),
        queryClient.invalidateQueries({ queryKey: ['article'] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ slug, commentId }: { slug: string; commentId: string }) => {
      return api.delete(`/articles/${slug}/comments/${commentId}`);
    },
    onSuccess: async (_data, vars) => {
      removeSelectedIfPresent(vars.commentId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['article'] }),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (articleId: string) => api.delete(`/articles/${articleId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'articles'] }),
        queryClient.invalidateQueries({ queryKey: ['articles', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['articles'] }),
      ]);
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (commentIds: string[]) => {
      await Promise.allSettled(
        commentIds.map((commentId) =>
          api.patch(`/articles/admin/moderation/comments/${commentId}`, {
            isFlagged: false,
            flagReason: null,
          }),
        ),
      );
    },
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['article'] }),
      ]);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (commentIds: string[]) => {
      const selectedItems = items.filter((item) => commentIds.includes(item.id));
      await Promise.allSettled(
        selectedItems.map((item) => api.delete(`/articles/${item.article.slug}/comments/${item.id}`)),
      );
    },
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['article'] }),
      ]);
    },
  });

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.length === items.length,
    [items.length, selectedIds.length],
  );

  const busy =
    reviewMutation.isPending ||
    deleteMutation.isPending ||
    bulkApproveMutation.isPending ||
    bulkDeleteMutation.isPending ||
    articleReviewMutation.isPending ||
    deleteArticleMutation.isPending;

  if (meQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
      </Card>
    );
  }

  if (meQuery.data?.role !== 'ADMIN') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin only</CardTitle>
          <CardDescription>You do not have permission to access moderation tools.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Comment Moderation</CardTitle>
          <CardDescription>Review flagged comments and decide whether to keep them hidden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Currently flagged comments: {count}</p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(items.map((item) => item.id));
                }
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              {allSelected ? 'Unselect all' : 'Select all'}
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => bulkApproveMutation.mutate(selectedIds)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve selected
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Article Moderation</CardTitle>
          <CardDescription>Review explicit or blocked articles after automatic content detection.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Currently flagged articles: {articleCount}</p>
        </CardContent>
      </Card>

      {moderationQuery.isLoading || articleModerationQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {moderationQuery.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(moderationQuery.error)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {articleModerationQuery.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(articleModerationQuery.error)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!moderationQuery.isLoading && !moderationQuery.isError && count === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No flagged comments right now.</CardContent>
        </Card>
      ) : null}

      {items.map((item) => {
        const checked = selectedIds.includes(item.id);

        return (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((prev) => Array.from(new Set([...prev, item.id])));
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                      }
                    }}
                  />
                  <CardTitle className="text-base">{item.user.nickname}</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
              </div>
              <CardDescription>
                Article:{' '}
                <Link to={`/guides/${item.article.slug}`} className="text-primary hover:underline">
                  {item.article.title}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-amber-900">
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Flagged ({item.flagCategory ?? 'UNSPECIFIED'} / {item.flagSeverity ?? 'N/A'})</span>
                </div>
                <p className="text-sm">{item.body}</p>
                {item.flagReason ? <p className="mt-1 text-xs">Reason: {item.flagReason}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate({ commentId: item.id, isFlagged: false })}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve (unflag)
                </button>

                <button
                  type="button"
                  onClick={() => reviewMutation.mutate({ commentId: item.id, isFlagged: true })}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  <Flag className="h-4 w-4" />
                  Keep flagged
                </button>

                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ slug: item.article.slug, commentId: item.id })}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete comment
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!articleModerationQuery.isLoading && !articleModerationQuery.isError && articleCount === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No flagged articles right now.</CardContent>
        </Card>
      ) : null}

      {articleItems.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>
                  Author: {item.author.nickname} | Status: {item.status} | Moderation: {item.moderationStatus}
                </CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-amber-900">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                <ShieldAlert className="h-4 w-4" />
                <span>{item.flagCategory ?? 'UNSPECIFIED'} / {item.flagSeverity ?? 'N/A'}</span>
              </div>
              <p className="text-sm font-medium">{item.summary || 'No summary provided.'}</p>
              {item.flagReason ? <p className="mt-1 text-xs">Reason: {item.flagReason}</p> : null}
              <p className="mt-1 text-xs">Likes: {item._count.likes} | Comments: {item._count.comments}</p>
              <div className="mt-2">
                <Link to={`/guides/${item.slug}`} className="text-sm font-medium text-primary hover:underline">
                  Open public article
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => articleReviewMutation.mutate({ articleId: item.id, moderationStatus: 'CLEAN', isFlagged: false, flagReason: null })}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve clean
              </button>

              <button
                type="button"
                onClick={() => articleReviewMutation.mutate({ articleId: item.id, moderationStatus: 'EXPLICIT', isFlagged: true, flagReason: item.flagReason ?? 'Explicit content - reviewed by admin.' })}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                <Flag className="h-4 w-4" />
                Keep explicit
              </button>

              <button
                type="button"
                onClick={() => articleReviewMutation.mutate({ articleId: item.id, moderationStatus: 'BLOCKED', isFlagged: true, flagReason: item.flagReason ?? 'Blocked by admin review.' })}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
              >
                <ShieldAlert className="h-4 w-4" />
                Block article
              </button>

              <button
                type="button"
                onClick={() => deleteArticleMutation.mutate(item.id)}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Delete article
              </button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
