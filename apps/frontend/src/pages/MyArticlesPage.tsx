import { useMemo, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { api, getApiErrorMessage } from '../lib/api';
import type { ArticleDto } from '../lib/types';

const STALE_TIME = 60 * 1000;

type ArticleFormState = {
  title: string;
  slug: string;
  summary: string;
  markdown: string;
};

const emptyForm: ArticleFormState = {
  title: '',
  slug: '',
  summary: '',
  markdown: '',
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not published';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleString();
}

export function MyArticlesPage() {
  const queryClient = useQueryClient();
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleFormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleLength = form.title.trim().length;
  const summaryLength = form.summary.trim().length;
  const slugValue = form.slug.trim();
  const slugInvalid = slugValue.length > 0 && !slugPattern.test(slugValue);
  const bodyLength = form.markdown.trim().length;
  const bodyTooShort = bodyLength > 0 && bodyLength < 10;

  const validateForm = () => {
    const title = form.title.trim();
    const slug = form.slug.trim();
    const summary = form.summary.trim();
    const markdown = form.markdown.trim();

    if (title.length < 3) {
      return 'Title must be at least 3 characters long.';
    }

    if (slug && !slugPattern.test(slug)) {
      return 'Slug can contain only lowercase letters, numbers, and hyphens.';
    }

    if (summary.length < 3) {
      return 'Summary must be at least 3 characters long.';
    }

    if (markdown.length < 10) {
      return 'Article body must be at least 10 characters long.';
    }

    return null;
  };

  const mineQuery = useQuery({
    queryKey: ['articles', 'mine'],
    queryFn: async () => (await api.get<ArticleDto[]>('/articles/me/mine')).data,
    staleTime: STALE_TIME,
  });

  const sortedArticles = useMemo(
    () => [...(mineQuery.data ?? [])].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()),
    [mineQuery.data],
  );

  const resetForm = () => {
    setEditingArticleId(null);
    setForm(emptyForm);
    setSubmitError(null);
  };

  const invalidate = async (slug?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['articles', 'mine'] }),
      queryClient.invalidateQueries({ queryKey: ['articles'] }),
      queryClient.invalidateQueries({ queryKey: ['article'] }),
      queryClient.invalidateQueries({ queryKey: ['articles', 'favorites'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'articles'] }),
      ...(slug ? [queryClient.invalidateQueries({ queryKey: ['article', slug] })] : []),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null);
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim(),
        markdown: form.markdown.trim(),
      };

      if (editingArticleId) {
        return await api.patch<ArticleDto>(`/articles/${editingArticleId}`, payload);
      }

      return await api.post<ArticleDto>('/articles', payload);
    },
    onSuccess: async (response) => {
      const articleSlug = response?.data?.slug ?? (form.slug.trim() || undefined);
      await invalidate(articleSlug);
      resetForm();
    },
    onError: (error) => {
      if (error instanceof Error && !axios.isAxiosError(error)) {
        setSubmitError(error.message);
        return;
      }

      const message = getApiErrorMessage(error);
      if (message === 'Validation failed') {
        setSubmitError('Check the slug and article body. Slug supports lowercase letters, numbers, and hyphens. Body must be at least 10 characters long.');
        return;
      }

      if (message === 'Invalid slug') {
        setSubmitError('Slug can contain only lowercase letters, numbers, and hyphens.');
        return;
      }

      setSubmitError(message);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'publish' | 'unpublish' }) => {
      return await api.post<ArticleDto>(`/articles/${id}/${action}`);
    },
    onSuccess: async (response) => {
      await invalidate(response?.data?.slug ?? undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/articles/${id}`);
    },
    onSuccess: async () => {
      await invalidate();
      if (editingArticleId && !(mineQuery.data ?? []).some((article) => article.id === editingArticleId)) {
        resetForm();
      }
    },
  });

  const startEdit = (article: ArticleDto) => {
    setEditingArticleId(article.id);
    setSubmitError(null);
    setForm({
      title: article.title,
      slug: article.slug,
      summary: article.summary ?? '',
      markdown: article.markdown,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>My articles</CardTitle>
          <CardDescription>Create drafts, publish them when ready, and manage your own weather or city stories.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingArticleId ? 'Edit article' : 'Write a new article'}</CardTitle>
            <CardDescription>Drafts stay private until you publish them. Plain text works. Markdown is optional formatting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="article-title">Title</label>
              <Input id="article-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Weekend route planning in Malaga" />
              <p className={`text-xs ${titleLength > 0 && titleLength < 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {titleLength > 0 && titleLength < 3 ? `Title must be at least 3 characters long. Current length: ${titleLength}.` : 'Title must be at least 3 characters long.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="article-slug">Slug (optional)</label>
              <Input id="article-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} placeholder="weekend-route-planning-malaga" />
              <p className={`text-xs ${slugInvalid ? 'text-destructive' : 'text-muted-foreground'}`}>
                {slugInvalid ? 'Slug can contain only lowercase letters, numbers, and hyphens.' : 'Optional. Use lowercase letters, numbers, and hyphens only.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="article-summary">Summary</label>
              <textarea id="article-summary" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Short teaser shown in the Guides list..." />
              <p className={`text-xs ${summaryLength > 0 && summaryLength < 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {summaryLength > 0 && summaryLength < 3 ? `Summary must be at least 3 characters long. Current length: ${summaryLength}.` : 'Summary should be at least 3 characters long.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="article-markdown">Article body</label>
              <textarea id="article-markdown" value={form.markdown} onChange={(event) => setForm((current) => ({ ...current, markdown: event.target.value }))} className="min-h-[320px] w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Write in markdown or plain text. Explain city conditions, plans, weather observations, event prep, or route tips..." />
              <p className="text-xs text-muted-foreground">Markdown is optional. Plain text works too. Use markdown only if you want headings, lists, tables, or links.</p>
              <p className={`text-xs ${bodyTooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
                {bodyTooShort ? `Article body must be at least 10 characters long. Current length: ${bodyLength}.` : 'Article body must be at least 10 characters long.'}
              </p>
            </div>

            {submitError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || form.title.trim().length < 3 || form.markdown.trim().length < 10}>
                {saveMutation.isPending ? 'Saving...' : editingArticleId ? 'Save changes' : 'Create draft'}
              </Button>
              {editingArticleId ? (
                <Button type="button" variant="outline" onClick={resetForm}>Cancel editing</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your drafts and published articles</CardTitle>
            <CardDescription>Use drafts for writing. Publish when the guide is ready for public view.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mineQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : null}

            {mineQuery.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(mineQuery.error)}
              </p>
            ) : null}

            {!mineQuery.isLoading && !mineQuery.isError && sortedArticles.length === 0 ? (
              <EmptyStateCard
                title="No articles yet"
                description="Create your first draft. You can keep it private, edit it later, and publish it only when it is ready."
                footer="A strong first guide: local weather pattern, route tip, event prep, or city-specific AQ insight."
              />
            ) : null}

            {sortedArticles.map((article) => (
              <div key={article.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{article.title}</p>
                      <Badge variant={article.status === 'PUBLISHED' ? 'default' : 'secondary'}>{article.status ?? 'DRAFT'}</Badge>
                      {article.moderationStatus === 'EXPLICIT' ? <Badge variant="secondary">Explicit</Badge> : null}
                      {article.moderationStatus === 'BLOCKED' ? <Badge variant="destructive">Blocked</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{article.summary?.trim() || 'No summary yet.'}</p>
                    <p className="text-xs text-muted-foreground">Published: {formatDate(article.publishedAt)} | Likes: {article._count?.likes ?? 0} | Comments: {article._count?.comments ?? 0}</p>
                    {article.moderationStatus && article.moderationStatus !== 'CLEAN' && article.flagReason ? (
                      <p className="text-xs text-amber-700">Moderation note: {article.flagReason}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => startEdit(article)}>Edit</Button>
                  {article.status === 'PUBLISHED' ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => publishMutation.mutate({ id: article.id, action: 'unpublish' })} disabled={publishMutation.isPending}>Move to draft</Button>
                      <button
                        type="button"
                        onClick={() => window.open(`/guides/${article.slug}`, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background hover:bg-muted h-10 px-4 py-2"
                      >
                        Open public view
                      </button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => publishMutation.mutate({ id: article.id, action: 'publish' })} disabled={publishMutation.isPending || article.moderationStatus === 'BLOCKED'}>Publish article</Button>
                  )}
                  <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate(article.id)} disabled={deleteMutation.isPending}>Delete</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
