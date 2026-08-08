import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { api, getApiErrorMessage } from '../lib/api';
import type { ArticleDto } from '../lib/types';

const STALE_TIME = 60 * 1000;

function formatDate(value?: string | null) {
  if (!value) {
    return 'Unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleDateString();
}

export function FavoriteArticlesPage() {
  const favoritesQuery = useQuery({
    queryKey: ['articles', 'favorites'],
    queryFn: async () => (await api.get<ArticleDto[]>('/articles/me/favorites')).data,
    staleTime: STALE_TIME,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Favorite articles</CardTitle>
          <CardDescription>Saved guides you liked. This is your private reading list for quick return later.</CardDescription>
        </CardHeader>
      </Card>

      {favoritesQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {favoritesQuery.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(favoritesQuery.error)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!favoritesQuery.isLoading && !favoritesQuery.isError && (favoritesQuery.data?.length ?? 0) === 0 ? (
        <EmptyStateCard
          title="No favorites yet"
          description="Open a guide and tap the heart button to save it here for later."
          footer="Use this section for routes, city plans, AQ notes, or weather articles you want to revisit."
        />
      ) : null}

      {favoritesQuery.data && favoritesQuery.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {favoritesQuery.data.map((article) => (
            <Link key={article.id} to={`/guides/${article.slug}`} className="group block">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-soft">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">Favorite</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(article.publishedAt)}</span>
                  </div>
                  <CardTitle className="text-base">{article.title}</CardTitle>
                  <CardDescription>{article.summary?.trim() || 'No summary provided.'}</CardDescription>
                  {article.author ? <p className="text-xs text-muted-foreground">Author: {article.author.nickname}</p> : null}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Likes: {article._count?.likes ?? 0} | Comments: {article._count?.comments ?? 0}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
