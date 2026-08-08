import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { Skeleton } from '../components/ui/skeleton';
import { api, getApiErrorMessage } from '../lib/api';
import type { ArticleDto, PublicUserDto } from '../lib/types';

const GUIDE_STALE_TIME = 5 * 60 * 1000;

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Unpublished';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleDateString();
}

function GuidesSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function GuidesPage() {
  const [authorQuery, setAuthorQuery] = useState('');

  const articlesQuery = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const response = await api.get<ArticleDto[]>('/articles');
      return response.data;
    },
    staleTime: GUIDE_STALE_TIME,
  });

  const trimmedAuthorQuery = useMemo(() => authorQuery.trim(), [authorQuery]);

  const usersQuery = useQuery({
    queryKey: ['users', 'search', trimmedAuthorQuery],
    queryFn: async () => {
      const response = await api.get<PublicUserDto[]>('/users/search', {
        params: { q: trimmedAuthorQuery },
      });
      return response.data;
    },
    enabled: trimmedAuthorQuery.length >= 2,
    staleTime: GUIDE_STALE_TIME,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Guides</CardTitle>
          <CardDescription>Here you can browse weather and city guides written by creators.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find authors</CardTitle>
          <CardDescription>Find creators by nickname and open their profile with published guides.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={authorQuery}
            onChange={(event) => setAuthorQuery(event.target.value)}
            placeholder="Search by nickname..."
          />

          {trimmedAuthorQuery.length < 2 ? (
            <EmptyStateCard
              title="Search authors by nickname"
              description="Start typing at least 2 characters to find creators and open their public profiles."

            />
          ) : null}

          {usersQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {usersQuery.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(usersQuery.error)}
            </p>
          ) : null}

          {usersQuery.data?.map((user) => (
            <Link
              key={user.id}
              to={`/authors/${user.id}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted"
            >
              <span className="text-sm font-medium">{user.nickname}</span>
              <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
            </Link>
          ))}

          {!usersQuery.isLoading && !usersQuery.isError && trimmedAuthorQuery.length >= 2 && (usersQuery.data?.length ?? 0) === 0 ? (
            <EmptyStateCard
              title="No authors found"
              description="No creator matched this nickname search. Try a shorter query or different spelling."
            />
          ) : null}
        </CardContent>
      </Card>

      {articlesQuery.isLoading ? <GuidesSkeleton /> : null}

      {articlesQuery.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(articlesQuery.error)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!articlesQuery.isLoading && !articlesQuery.isError && (articlesQuery.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No guides are available yet.</p>
          </CardContent>
        </Card>
      ) : null}

      {articlesQuery.data && articlesQuery.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articlesQuery.data.map((article) => (
            <Link key={article.id} to={`/guides/${article.slug}`} className="group block">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-soft">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Guide</Badge>
                      {article.moderationStatus === 'EXPLICIT' ? <Badge variant="outline">Explicit</Badge> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(article.publishedAt)}</span>
                  </div>
                  <CardTitle className="text-base">{article.title}</CardTitle>
                  <CardDescription>
                    {article.summary?.trim().length ? article.summary : 'No summary provided.'}
                  </CardDescription>
                  {article.author ? (
                    <p className="text-xs text-muted-foreground">Author: {article.author.nickname}</p>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

