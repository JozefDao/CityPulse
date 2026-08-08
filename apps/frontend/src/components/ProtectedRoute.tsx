import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { authStore } from '../lib/auth-store';

export function ProtectedRoute() {
  const auth = useSyncExternalStore(authStore.subscribe, authStore.getState);
  const location = useLocation();

  if (!auth.isReady) {
    return <div className="rounded-2xl border bg-card p-6 shadow-soft text-sm text-muted-foreground">Checking session...</div>;
  }

  if (!auth.accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
