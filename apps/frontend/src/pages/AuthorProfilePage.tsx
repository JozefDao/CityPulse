import { useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { api, getApiErrorMessage, resolveMediaUrl } from '../lib/api';
import { getManagedAvatarPath, getNicknameInitials } from '../lib/avatar';
import { authStore } from '../lib/auth-store';
import type { ArticleDto, PublicUserProfileDto } from '../lib/types';

const STALE_TIME = 5 * 60 * 1000;

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

export function AuthorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  const hasToken = Boolean(authState.accessToken);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['author', id],
    queryFn: async () => {
      const response = await api.get<PublicUserProfileDto>(`/users/${id}`);
      return response.data;
    },
    enabled: typeof id === 'string' && id.length > 0,
    staleTime: STALE_TIME,
  });

  const articlesQuery = useQuery({
    queryKey: ['author', id, 'articles'],
    queryFn: async () => {
      const response = await api.get<ArticleDto[]>(`/users/${id}/articles`);
      return response.data;
    },
    enabled: typeof id === 'string' && id.length > 0,
    staleTime: STALE_TIME,
  });

  const supportMutation = useMutation({
    mutationFn: async () => {
      await api.post('/support', {
        subject: subject.trim(),
        message: message.trim(),
      });
    },
    onSuccess: () => {
      setSubject('');
      setMessage('');
      setHint('Support request sent. Admin team will review it.');
    },
    onError: (error) => {
      setHint(getApiErrorMessage(error));
    },
  });

  return (
    <div className="space-y-4">
      <Link to="/guides" className="inline-flex text-sm font-medium text-primary hover:underline">
        Back to guides
      </Link>

      {profileQuery.isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
        </Card>
      ) : null}

      {profileQuery.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(profileQuery.error)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {profileQuery.data ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start gap-3">
              {resolveMediaUrl(getManagedAvatarPath(profileQuery.data.avatarUrl)) ? (
                <img
                  src={resolveMediaUrl(getManagedAvatarPath(profileQuery.data.avatarUrl)) ?? undefined}
                  alt={profileQuery.data.nickname}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {getNicknameInitials(profileQuery.data.nickname)}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{profileQuery.data.nickname}</CardTitle>
                  <Badge variant={profileQuery.data.role === 'ADMIN' ? 'default' : 'secondary'}>
                    {profileQuery.data.role}
                  </Badge>
                </div>
                <CardDescription>
                  Email: {profileQuery.data.email} | Joined: {formatDate(profileQuery.data.createdAt)} | Published articles: {profileQuery.data.publishedArticlesCount}
                </CardDescription>
                {profileQuery.data.bio ? (
                  <p className="text-sm text-muted-foreground">{profileQuery.data.bio}</p>
                ) : null}
              </div>
            </div>
          </CardHeader>

          {profileQuery.data.role === 'ADMIN' ? (
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use in-app form to contact support directly.
              </p>

              {!hasToken ? (
                <p className="text-sm text-muted-foreground">Login required to send support request.</p>
              ) : (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (subject.trim().length < 3 || message.trim().length < 10) {
                      return;
                    }
                    supportMutation.mutate();
                  }}
                >
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Subject"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe your issue..."
                    className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={supportMutation.isPending || subject.trim().length < 3 || message.trim().length < 10}
                    className="inline-flex rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {supportMutation.isPending ? 'Sending...' : 'Send to support'}
                  </button>
                </form>
              )}

              {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Published articles</CardTitle>
          <CardDescription>Weather and city-related posts by this author.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {articlesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}

          {articlesQuery.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(articlesQuery.error)}
            </p>
          ) : null}

          {!articlesQuery.isLoading && !articlesQuery.isError && (articlesQuery.data?.length ?? 0) === 0 ? (
            <EmptyStateCard
              title="No published articles yet"
              description="This author does not have any public guides at the moment."
              footer="Check back later or open the main Guides page to browse other creators."
            />
          ) : null}

          {articlesQuery.data?.map((article) => (
            <Link
              key={article.id}
              to={`/guides/${article.slug}`}
              className="block rounded-md border border-border p-3 transition-colors hover:bg-muted"
            >
              <p className="font-medium">{article.title}</p>
              <p className="text-sm text-muted-foreground">{article.summary || 'No summary provided.'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Published: {formatDate(article.publishedAt)}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
