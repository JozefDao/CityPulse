import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Menu, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage, refreshAccessToken } from '../lib/api';
import { authStore } from '../lib/auth-store';
import type { AlertEventDto, UserDto } from '../lib/types';
import { cn } from '../lib/utils';

const privateNavItems = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/guides', label: 'Guides' },
  { to: '/my-articles', label: 'My articles' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/settings', label: 'Settings' },
] as const;

const adminNavItem = { to: '/admin/moderation', label: 'Moderation' } as const;

const publicNavItems = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
];

function resetUiLocks() {
  document.body.classList.remove('overflow-hidden', 'pointer-events-none');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('pointer-events');
  document.body.style.removeProperty('padding-right');
  document.body.removeAttribute('data-scroll-locked');
  document.documentElement.style.removeProperty('overflow');
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }
  return parsed.toLocaleString();
}

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

function getDropdownPosition(anchor: HTMLElement): DropdownPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 8;
  const preferredWidth = 360;
  const maxWidth = Math.max(260, window.innerWidth - viewportPadding * 2);
  const width = Math.min(preferredWidth, maxWidth);
  const rawLeft = rect.right - width;
  const left = Math.min(Math.max(rawLeft, viewportPadding), window.innerWidth - width - viewportPadding);

  return {
    top: rect.bottom + 10,
    left,
    width,
  };
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  const hasToken = Boolean(authState.accessToken);
  const isSessionReady = authState.isReady;
  const hasAuthenticatedSession = hasToken && isSessionReady;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 70, left: 8, width: 360 });
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    resetUiLocks();
  }, [location.pathname]);

  useEffect(() => {
    if (!authState.accessToken || authState.isReady) {
      return;
    }

    let cancelled = false;

    void refreshAccessToken()
      .catch(() => {
        authStore.clear();
      })
      .finally(() => {
        if (!cancelled) {
          authStore.setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authState.accessToken, authState.isReady]);

  useEffect(() => {
    const recoverUiIfStuck = () => {
      const hasOpenDialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!hasOpenDialog) {
        resetUiLocks();
      }
    };

    recoverUiIfStuck();
    const intervalId = window.setInterval(recoverUiIfStuck, 1500);
    window.addEventListener('focus', recoverUiIfStuck);
    document.addEventListener('visibilitychange', recoverUiIfStuck);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', recoverUiIfStuck);
      document.removeEventListener('visibilitychange', recoverUiIfStuck);
    };
  }, []);

  const updateDropdownPosition = useCallback(() => {
    if (!bellButtonRef.current) {
      return;
    }
    setDropdownPosition(getDropdownPosition(bellButtonRef.current));
  }, []);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    updateDropdownPosition();

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target) || bellButtonRef.current?.contains(target)) {
        return;
      }
      setNotificationsOpen(false);
    };

    const onViewportChange = () => updateDropdownPosition();

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [notificationsOpen, updateDropdownPosition]);

  const meQuery = useQuery({
    queryKey: ['me', 'layout'],
    queryFn: async () => (await api.get<UserDto>('/me')).data,
    enabled: hasAuthenticatedSession,
    staleTime: 60 * 1000,
  });

  const notificationsQuery = useQuery({
    queryKey: ['alerts', 'events', 'header'],
    queryFn: async () => {
      return (
        await api.get<AlertEventDto[]>('/me/alerts/events', {
          params: {
            unreadOnly: true,
            limit: 50,
          },
        })
      ).data;
    },
    enabled: hasAuthenticatedSession,
    staleTime: 30 * 1000,
  });

  const recentUnread = useMemo(() => (notificationsQuery.data ?? []).slice(0, 5), [notificationsQuery.data]);
  const unreadCount = notificationsQuery.data?.length ?? 0;
  const logoTarget = hasToken ? '/dashboard' : '/';

  const markReadMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.patch(`/me/alerts/events/${eventId}/read`);
      return eventId;
    },
    onMutate: async (eventId) => {
      setNotificationError(null);
      await queryClient.cancelQueries({ queryKey: ['alerts', 'events', 'header'] });
      const previous = queryClient.getQueryData<AlertEventDto[]>(['alerts', 'events', 'header']) ?? [];
      queryClient.setQueryData<AlertEventDto[]>(
        ['alerts', 'events', 'header'],
        previous.filter((item) => item.id !== eventId),
      );
      return { previous };
    },
    onError: (error, _eventId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['alerts', 'events', 'header'], context.previous);
      }
      setNotificationError(getApiErrorMessage(error));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'events'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('/me/alerts/events/read-all');
    },
    onMutate: async () => {
      setNotificationError(null);
      await queryClient.cancelQueries({ queryKey: ['alerts', 'events', 'header'] });
      const previous = queryClient.getQueryData<AlertEventDto[]>(['alerts', 'events', 'header']) ?? [];
      queryClient.setQueryData<AlertEventDto[]>(['alerts', 'events', 'header'], []);
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['alerts', 'events', 'header'], context.previous);
      }
      setNotificationError(getApiErrorMessage(error));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'events'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: async () => {
      authStore.clear();
      setNotificationsOpen(false);
      queryClient.clear();
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      setNotificationError(getApiErrorMessage(error));
    },
  });

  const isAdmin = meQuery.data?.role === 'ADMIN';
  const navItems = hasToken
    ? (isAdmin ? [...privateNavItems, adminNavItem] : [...privateNavItems])
    : publicNavItems;

  return (
    <div className="app-container">
      <header className="relative z-40 mb-6 overflow-visible rounded-2xl border bg-card/95 p-4 shadow-soft md:p-5">
        <div className="flex items-start justify-between gap-3 xl:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Weather + Air Quality</p>
            <Link to={logoTarget} className="inline-block">
              <h1 className="text-2xl font-semibold transition-colors hover:text-primary">CityPulse</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2 xl:gap-3">
            <div className="flex items-center gap-2">
              {hasToken ? (
                <button
                  ref={bellButtonRef}
                  type="button"
                  onClick={() => setNotificationsOpen((value) => !value)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setMobileMenuOpen((value) => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background hover:bg-muted xl:hidden"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>

            <div className="hidden xl:flex xl:items-center xl:justify-end xl:gap-2">
              <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {hasToken ? (
                <button
                  type="button"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>


      {mobileMenuOpen ? (
        <div className="mb-6 rounded-2xl border bg-card/95 p-3 shadow-soft xl:hidden">
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {hasToken ? (
              <button
                type="button"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}

      <main className="relative z-10">
        <Outlet />
      </main>

      {notificationsOpen
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[130] rounded-md border bg-white p-3 text-foreground shadow-2xl"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Unread alerts</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending || unreadCount === 0}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all
                </button>
              </div>

              {notificationError ? (
                <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {notificationError}
                </p>
              ) : null}

              {notificationsQuery.isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : null}

              {!notificationsQuery.isLoading && recentUnread.length === 0 ? (
                <p className="text-xs text-muted-foreground">No unread alerts.</p>
              ) : null}

              <div className="space-y-2">
                {recentUnread.map((event) => (
                  <div key={event.id} className="rounded-md border border-border p-2">
                    <p className="text-xs font-medium">{event.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-medium text-primary hover:underline"
                      onClick={() => markReadMutation.mutate(event.id)}
                      disabled={markReadMutation.isPending}
                    >
                      Mark read
                    </button>
                  </div>
                ))}
              </div>

              <NavLink
                to="/alerts"
                className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                onClick={() => setNotificationsOpen(false)}
              >
                Open alerts center
              </NavLink>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
