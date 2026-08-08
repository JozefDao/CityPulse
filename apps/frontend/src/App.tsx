/* eslint-disable react-refresh/only-export-components */
import { Suspense, lazy } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const GuidesPage = lazy(() => import('./pages/GuidesPage').then((module) => ({ default: module.GuidesPage })));
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage').then((module) => ({ default: module.ArticleDetailPage })));
const AuthorProfilePage = lazy(() => import('./pages/AuthorProfilePage').then((module) => ({ default: module.AuthorProfilePage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((module) => ({ default: module.AlertsPage })));
const MyArticlesPage = lazy(() => import('./pages/MyArticlesPage').then((module) => ({ default: module.MyArticlesPage })));
const FavoriteArticlesPage = lazy(() => import('./pages/FavoriteArticlesPage').then((module) => ({ default: module.FavoriteArticlesPage })));
const AdminModerationPage = lazy(() => import('./pages/AdminModerationPage').then((module) => ({ default: module.AdminModerationPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function RouteLoading() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <p className="text-sm text-muted-foreground">Loading page...</p>
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected application error';

  return (
    <div className="app-container">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex gap-2">
          <Link to="/" className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            Go home
          </Link>
          <Link to="/dashboard" className="rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: withSuspense(<LandingPage />) },
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'register', element: withSuspense(<RegisterPage />) },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'guides', element: withSuspense(<GuidesPage />) },
          { path: 'guides/:slug', element: withSuspense(<ArticleDetailPage />) },
          { path: 'authors/:id', element: withSuspense(<AuthorProfilePage />) },
          { path: 'alerts', element: withSuspense(<AlertsPage />) },
          { path: 'my-articles', element: withSuspense(<MyArticlesPage />) },
          { path: 'favorites', element: withSuspense(<FavoriteArticlesPage />) },
          { path: 'admin/moderation', element: withSuspense(<AdminModerationPage />) },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
        ],
      },
    ],
  },
]);
