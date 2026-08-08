/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { Tooltip } from '../components/ui/tooltip';
import { api, getApiErrorMessage } from '../lib/api';
import { authStore } from '../lib/auth-store';
import { cn } from '../lib/utils';
import type { CityDashboardResponseDto, CitySearchResultDto, WatchlistItemDto } from '../lib/types';

type HourlySeriesPoint = {
  dateTime: string;
  temperature?: number;
  precipitation?: number;
  windSpeed?: number;
  humidity?: number;
};

type DailySeriesPoint = {
  date: string;
  tempMin?: number;
  tempMax?: number;
  precipitationSum?: number;
  windMax?: number;
  sunrise?: string;
  sunset?: string;
};

type AirSeriesPoint = {
  dateTime: string;
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
};

type ChartTab = 'hourly' | 'daily' | 'air';

type ResolvedCityDto = {
  id: string;
  name: string;
  countryCode?: string | null;
  lat: number;
  lon: number;
  timezone: string;
};

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function useViewportWidth(): number {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener('resize', listener);
      return () => window.removeEventListener('resize', listener);
    },
    () => window.innerWidth,
    () => 1024,
  );
}

function formatValue(value: number | undefined, suffix: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A';
  }

  return `${value}${suffix}`;
}

function formatIsoDateTime(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toHourlySeries(data: CityDashboardResponseDto | undefined): HourlySeriesPoint[] {
  if (!data) {
    return [];
  }

  const times = data.hourly.times ?? [];
  return times.map((dateTime, index) => ({
    dateTime,
    temperature: data.hourly.temperature?.[index],
    precipitation: data.hourly.precipitation?.[index],
    windSpeed: data.hourly.windSpeed?.[index],
    humidity: data.hourly.humidity?.[index],
  }));
}

function toDailySeries(data: CityDashboardResponseDto | undefined): DailySeriesPoint[] {
  if (!data) {
    return [];
  }

  const dates = data.daily.dates ?? [];
  return dates.map((date, index) => ({
    date,
    tempMin: data.daily.tempMin?.[index],
    tempMax: data.daily.tempMax?.[index],
    precipitationSum: data.daily.precipitationSum?.[index],
    windMax: data.daily.windMax?.[index],
    sunrise: data.daily.sunrise?.[index],
    sunset: data.daily.sunset?.[index],
  }));
}

function toAirSeries(data: CityDashboardResponseDto | undefined): AirSeriesPoint[] {
  if (!data) {
    return [];
  }

  const times = data.airQuality.times ?? [];
  return times.map((dateTime, index) => ({
    dateTime,
    pm25: data.airQuality.pm25?.[index],
    pm10: data.airQuality.pm10?.[index],
    no2: data.airQuality.no2?.[index],
    o3: data.airQuality.o3?.[index],
  }));
}

function ChartFrame({ className, children }: { className: string; children: (size: { width: number; height: number }) => ReactNode }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const rect = frame.getBoundingClientRect();
      setSize({
        width: Math.max(Math.floor(rect.width), 0),
        height: Math.max(Math.floor(rect.height), 0),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  const isReady = size.width > 0 && size.height > 0;

  return (
    <div ref={frameRef} className={cn('min-w-0 overflow-hidden', className)}>
      {isReady ? children(size) : <div className="h-full w-full rounded-md bg-muted/30" />}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function formatDateTimeTick(value: string, compact = false): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const date = parsed.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  const time = parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return compact ? time : `${date} ${time}`;
}

function formatDateTick(value: string, compact = false): string {
  return new Date(value).toLocaleDateString([], compact ? { day: '2-digit', month: '2-digit' } : { month: 'short', day: 'numeric' });
}

function formatObservationDateTime(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  // Open-Meteo often sends city-local timestamps without timezone offset.
  const isLocalNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
  if (isLocalNoTz) {
    return value.replace('T', ' ');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatTempPrecipTooltip(value: number | string | undefined, name?: string): [string, string] {
  if (name === 'Temperature') {
    return [`${value ?? 'N/A'} C`, name];
  }

  return [`${value ?? 'N/A'} mm`, name ?? 'Precipitation'];
}

function formatTempTooltip(value: number | string | undefined, name?: string): [string, string] {
  return [`${value ?? 'N/A'} C`, name ?? 'Value'];
}

function formatWindHumidityTooltip(value: number | string | undefined, name?: string): [string, string] {
  if (name === 'Humidity') {
    return [`${value ?? 'N/A'} %`, name];
  }

  return [`${value ?? 'N/A'} km/h`, name ?? 'Wind Speed'];
}

function formatAirTooltip(value: number | string | undefined, name?: string): [string, string] {
  return [`${value ?? 'N/A'} ug/m3`, name ?? 'Air metric'];
}

function getLatestPm25(series: AirSeriesPoint[]): number | undefined {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i].pm25;
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
  }

  return undefined;
}

function getAirQualitySeverity(pm25: number | undefined): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (typeof pm25 !== 'number' || Number.isNaN(pm25)) {
    return { label: 'AQ unknown', variant: 'secondary' };
  }

  if (pm25 <= 12) {
    return { label: 'AQ good', variant: 'default' };
  }

  if (pm25 <= 35.4) {
    return { label: 'AQ moderate', variant: 'secondary' };
  }

  return { label: 'AQ unhealthy', variant: 'destructive' };
}

function sourceAvailabilityLabel(value: boolean): string {
  return value ? 'available' : 'missing';
}

export function DashboardPage() {
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  const hasToken = Boolean(authState.accessToken);
  const hasAuthenticatedSession = hasToken && authState.isReady;
  const viewportWidth = useViewportWidth();
  const isCompactCharts = viewportWidth < 640;

  const [search, setSearch] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [activeWatchlistIndex, setActiveWatchlistIndex] = useState(-1);
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>('hourly');
  const [showHourlyTable, setShowHourlyTable] = useState(false);
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [draggedWatchlistCityId, setDraggedWatchlistCityId] = useState<string | null>(null);
  const [dropTargetWatchlistCityId, setDropTargetWatchlistCityId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const queryClient = useQueryClient();
  const watchlistKeyScopeRef = useRef<HTMLDivElement | null>(null);
  const searchCardRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const resultItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const watchlistItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveWatchlistItem = (items: WatchlistItemDto[], fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) {
      return items;
    }

    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const reorderByCityIds = (items: WatchlistItemDto[], sourceCityId: string, targetCityId: string) => {
    const fromIndex = items.findIndex((item) => item.cityId === sourceCityId);
    const toIndex = items.findIndex((item) => item.cityId === targetCityId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return items.map((item) => item.cityId);
    }

    return moveWatchlistItem(items, fromIndex, toIndex).map((item) => item.cityId);
  };

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const response = await api.get<WatchlistItemDto[]>('/me/watchlist');
      return response.data;
    },
    enabled: hasAuthenticatedSession,
    refetchInterval: hasToken ? 60000 : false,
  });

  useEffect(() => {
    if (hasAuthenticatedSession && !selectedCityId && watchlistQuery.data && watchlistQuery.data.length > 0) {
      setSelectedCityId(watchlistQuery.data[0].cityId);
    }
  }, [hasAuthenticatedSession, selectedCityId, watchlistQuery.data]);

  useEffect(() => {
    const watchlist = watchlistQuery.data ?? [];
    const nextIndex = watchlist.findIndex((item) => item.cityId === selectedCityId);
    setActiveWatchlistIndex(nextIndex);
  }, [selectedCityId, watchlistQuery.data]);

  useEffect(() => {
    setShowHourlyTable(false);
    setShowDailyTable(false);
  }, [selectedCityId, activeChartTab]);

  const citySearchQuery = useQuery({
    queryKey: ['city-search', debouncedSearch],
    queryFn: async ({ signal }) => {
      const response = await api.get<CitySearchResultDto[]>('/cities/search', {
        params: { q: debouncedSearch },
        signal,
      });
      return response.data;
    },
    enabled: debouncedSearch.trim().length >= 2,
    refetchOnWindowFocus: false,
  });

  const guestDefaultCityQuery = useQuery({
    queryKey: ['guest-default-city'],
    queryFn: async () => {
      const searchResponse = await api.get<CitySearchResultDto[]>('/cities/search', {
        params: { q: 'Bratislava' },
      });
      const first = searchResponse.data[0];
      if (!first) {
        return null;
      }

      const resolved = await api.post<ResolvedCityDto>('/cities/resolve', first);
      return resolved.data;
    },
    enabled: !hasToken,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!hasToken && !selectedCityId && guestDefaultCityQuery.data?.id) {
      setSelectedCityId(guestDefaultCityQuery.data.id);
    }
  }, [hasToken, selectedCityId, guestDefaultCityQuery.data]);

  const addWatchlistMutation = useMutation({
    mutationFn: async (city: CitySearchResultDto) => {
      const response = await api.post<WatchlistItemDto>('/me/watchlist', city);
      return response.data;
    },
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setSelectedCityId(item.cityId);
      setIsDropdownOpen(false);
      setActiveResultIndex(-1);
    },
  });

  const removeWatchlistMutation = useMutation({
    mutationFn: async (cityId: string) => {
      const response = await api.delete<{ ok: true }>(`/me/watchlist/${cityId}`);
      return { cityId, data: response.data };
    },
    onSuccess: async ({ cityId }) => {
      const watchlist = watchlistQuery.data ?? [];
      const remaining = watchlist.filter((item) => item.cityId !== cityId);
      if (selectedCityId === cityId) {
        setSelectedCityId(remaining[0]?.cityId ?? '');
      }
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const reorderWatchlistMutation = useMutation({
    mutationFn: async (cityIds: string[]) => {
      const response = await api.patch<WatchlistItemDto[]>('/me/watchlist/reorder', { cityIds });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const guestResolveMutation = useMutation({
    mutationFn: async (city: CitySearchResultDto) => {
      const response = await api.post<ResolvedCityDto>('/cities/resolve', city);
      return response.data;
    },
    onSuccess: (city) => {
      setSelectedCityId(city.id);
      setIsDropdownOpen(false);
      setActiveResultIndex(-1);
    },
  });

  const dashboardQuery = useQuery({
    queryKey: ['city-dashboard', selectedCityId],
    queryFn: async () => {
      const response = await api.get<CityDashboardResponseDto>(`/cities/${selectedCityId}/dashboard`);
      return response.data;
    },
    enabled: selectedCityId.length > 0,
    refetchInterval: 45000,
  });

  const searchResults = useMemo(() => citySearchQuery.data ?? [], [citySearchQuery.data]);
  const displayedResults = useMemo(() => searchResults.slice(0, 6), [searchResults]);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setIsDropdownOpen(false);
      setActiveResultIndex(-1);
      return;
    }

    if (displayedResults.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [debouncedSearch, displayedResults]);

  useEffect(() => {
    if (activeResultIndex >= displayedResults.length) {
      setActiveResultIndex(displayedResults.length - 1);
    }
  }, [activeResultIndex, displayedResults]);

  useEffect(() => {
    if (activeResultIndex < 0) {
      return;
    }

    const item = resultItemRefs.current[activeResultIndex];
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeResultIndex]);

  useEffect(() => {
    if (activeWatchlistIndex < 0) {
      return;
    }

    const item = watchlistItemRefs.current[activeWatchlistIndex];
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeWatchlistIndex]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setIsDropdownOpen(false);
        setActiveResultIndex(-1);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleWatchlistKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const watchlist = watchlistQuery.data ?? [];
    if (watchlist.length === 0) {
      return;
    }

    const currentIndex = activeWatchlistIndex >= 0 ? activeWatchlistIndex : 0;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % watchlist.length;
      setActiveWatchlistIndex(nextIndex);
      watchlistItemRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex <= 0 ? watchlist.length - 1 : currentIndex - 1;
      setActiveWatchlistIndex(prevIndex);
      watchlistItemRefs.current[prevIndex]?.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const selectedIndex = activeWatchlistIndex >= 0 ? activeWatchlistIndex : 0;
      setActiveWatchlistIndex(selectedIndex);
      setSelectedCityId(watchlist[selectedIndex].cityId);
      watchlistItemRefs.current[selectedIndex]?.focus();
    }
  };

  const handleWatchlistDrop = (targetCityId: string) => {
    const items = watchlistQuery.data ?? [];
    if (!draggedWatchlistCityId || draggedWatchlistCityId === targetCityId || items.length < 2) {
      setDraggedWatchlistCityId(null);
      setDropTargetWatchlistCityId(null);
      return;
    }

    reorderWatchlistMutation.mutate(reorderByCityIds(items, draggedWatchlistCityId, targetCityId), {
      onSettled: () => {
        setDraggedWatchlistCityId(null);
        setDropTargetWatchlistCityId(null);
      },
    });
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (displayedResults.length > 0) {
        setIsDropdownOpen(true);
      }
    }

    if (!isDropdownOpen || displayedResults.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev + 1) % displayedResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev <= 0 ? displayedResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsDropdownOpen(false);
      setActiveResultIndex(-1);
      return;
    }

    if (event.key === 'Enter') {
      const index = activeResultIndex >= 0 ? activeResultIndex : 0;
      const city = displayedResults[index];
      if (city) {
        event.preventDefault();
        if (hasToken) {
          addWatchlistMutation.mutate(city);
        } else {
          guestResolveMutation.mutate(city);
        }
      }
    }
  };

  const selectedDashboard = dashboardQuery.data;
  const hourlySeries = useMemo(() => toHourlySeries(selectedDashboard), [selectedDashboard]);
  const displayedHourlySeries = useMemo(() => hourlySeries.slice(0, 24), [hourlySeries]);
  const hasHourlyHumidity = useMemo(
    () => displayedHourlySeries.some((point) => typeof point.humidity === 'number' && !Number.isNaN(point.humidity)),
    [displayedHourlySeries],
  );
  const dailySeries = useMemo(() => toDailySeries(selectedDashboard), [selectedDashboard]);
  const airSeries = useMemo(() => toAirSeries(selectedDashboard), [selectedDashboard]);
  const latestPm25 = useMemo(() => getLatestPm25(airSeries), [airSeries]);
  const airQualitySeverity = useMemo(() => getAirQualitySeverity(latestPm25), [latestPm25]);
  const airQualityBadgeTitle = useMemo(() => {
    if (typeof latestPm25 !== 'number' || Number.isNaN(latestPm25)) {
      return 'Air quality label is based on PM2.5. Current PM2.5 value is unavailable.';
    }

    return 'Air quality label is based on PM2.5 (' + latestPm25.toFixed(1) + ' ug/m3).';
  }, [latestPm25]);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {hasToken ? (
        <Card
          className="lg:h-[calc(100vh-190px)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          ref={watchlistKeyScopeRef}
          tabIndex={0}
          onKeyDown={handleWatchlistKeyDown}
          onMouseDown={(event) => {
            const target = event.target;
            if (!(target instanceof Node)) {
              return;
            }

            const button = target instanceof Element ? target.closest('button') : null;
            if (!button) {
              watchlistKeyScopeRef.current?.focus();
            }
          }}
        >
          <CardHeader>
            <CardTitle>Watchlist</CardTitle>
            <CardDescription>Your saved cities for quick weather checks.</CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-120px)] pt-0">
            {watchlistQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : null}

            {watchlistQuery.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(watchlistQuery.error)}
              </p>
            ) : null}

            {removeWatchlistMutation.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(removeWatchlistMutation.error)}
              </p>
            ) : null}

            {reorderWatchlistMutation.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(reorderWatchlistMutation.error)}
              </p>
            ) : null}

            {!watchlistQuery.isLoading && (watchlistQuery.data?.length ?? 0) === 0 ? (
              <EmptyStateCard
                title="Your watchlist is empty"
                description="Start with one city so your dashboard and alerts have a default place to work from."
                footer="Use the search panel on the right, then click Add on a result you want to keep."
              />
            ) : null}

            <ScrollArea className="h-full pr-1">
              <div className="space-y-2">
                {(watchlistQuery.data ?? []).map((item, index, items) => (
                  <div
                    key={item.cityId}
                    className={cn(
                      'rounded-md border bg-background p-2 transition-colors',
                      dropTargetWatchlistCityId === item.cityId && 'border-primary bg-primary/5',
                      draggedWatchlistCityId === item.cityId && 'opacity-70',
                    )}
                    draggable={!reorderWatchlistMutation.isPending && items.length > 1}
                    onDragStart={(event) => {
                      setDraggedWatchlistCityId(item.cityId);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', item.cityId);
                    }}
                    onDragOver={(event) => {
                      if (!draggedWatchlistCityId || draggedWatchlistCityId === item.cityId) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropTargetWatchlistCityId(item.cityId);
                    }}
                    onDragEnter={() => {
                      if (draggedWatchlistCityId && draggedWatchlistCityId !== item.cityId) {
                        setDropTargetWatchlistCityId(item.cityId);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                      }
                      if (dropTargetWatchlistCityId === item.cityId) {
                        setDropTargetWatchlistCityId(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleWatchlistDrop(item.cityId);
                    }}
                    onDragEnd={() => {
                      setDraggedWatchlistCityId(null);
                      setDropTargetWatchlistCityId(null);
                    }}
                  >
                    <Button
                      ref={(node) => {
                        watchlistItemRefs.current[index] = node;
                      }}
                      type="button"
                      variant={selectedCityId === item.cityId ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onFocus={() => setActiveWatchlistIndex(index)}
                      onKeyDown={handleWatchlistKeyDown}
                      onClick={() => {
                        setActiveWatchlistIndex(index);
                        setSelectedCityId(item.cityId);
                      }}
                    >
                      {item.city.name}
                    </Button>
                    <div className="mt-2 space-y-2">
                      <p className="hidden text-xs text-muted-foreground sm:block">
                        Drag this card to change its position.
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex w-full gap-2 sm:hidden">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => reorderWatchlistMutation.mutate(moveWatchlistItem(items, index, index - 1).map((entry) => entry.cityId))}
                            disabled={index === 0 || reorderWatchlistMutation.isPending}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => reorderWatchlistMutation.mutate(moveWatchlistItem(items, index, index + 1).map((entry) => entry.cityId))}
                            disabled={index === items.length - 1 || reorderWatchlistMutation.isPending}
                          >
                            Down
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive sm:w-auto"
                          onClick={() => removeWatchlistMutation.mutate(item.cityId)}
                          disabled={removeWatchlistMutation.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card className="lg:h-[calc(100vh-190px)]">
          <CardHeader>
            <CardTitle>Guest mode</CardTitle>
            <CardDescription>Browse weather freely. Login to unlock watchlist, guides, and alerts.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Search a city on the right and press "View" to load forecast details.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="min-w-0 space-y-4">
        <Card
          className="relative overflow-visible"
          ref={searchCardRef}
          onMouseDown={(event) => {
            const target = event.target;
            if (!(target instanceof Node)) {
              return;
            }
            if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
              setIsDropdownOpen(false);
              setActiveResultIndex(-1);
            }
          }}
        >
          <CardHeader>
            <CardTitle>Search city</CardTitle>
            <CardDescription>{hasToken ? 'Search cities and add them to your watchlist.' : 'Search cities and open weather details instantly.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative" ref={searchBoxRef}>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => {
                  if (displayedResults.length > 0) {
                    setIsDropdownOpen(true);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search for a city"
                aria-expanded={isDropdownOpen}
                aria-activedescendant={activeResultIndex >= 0 ? `search-option-${activeResultIndex}` : undefined}
              />
              {citySearchQuery.isFetching ? <Skeleton className="mt-3 h-10 w-full" /> : null}
              {citySearchQuery.isError ? (
                <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {getApiErrorMessage(citySearchQuery.error)}
                </p>
              ) : null}

              {isDropdownOpen && displayedResults.length > 0 ? (
                <div className="absolute left-0 right-0 top-[52px] z-20 rounded-lg border bg-card p-2 shadow-soft">
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {displayedResults.map((city, index) => (
                      <div
                        key={`${city.name}-${city.lat}-${city.lon}`}
                        id={`search-option-${index}`}
                        ref={(node) => {
                          resultItemRefs.current[index] = node;
                        }}
                        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                          activeResultIndex === index ? 'bg-muted' : 'bg-background'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{city.name}</p>
                          <p className="text-xs text-muted-foreground">{city.countryCode ?? 'N/A'}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onMouseEnter={() => setActiveResultIndex(index)}
                          onClick={() => {
                            if (hasToken) {
                              addWatchlistMutation.mutate(city);
                            } else {
                              guestResolveMutation.mutate(city);
                            }
                          }}
                          disabled={hasToken ? addWatchlistMutation.isPending : guestResolveMutation.isPending}
                        >
                          {hasToken ? 'Add' : 'View'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {hasToken && addWatchlistMutation.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(addWatchlistMutation.error)}
              </p>
            ) : null}

            {!hasToken && guestResolveMutation.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(guestResolveMutation.error)}
              </p>
            ) : null}

            {!citySearchQuery.isFetching && debouncedSearch.trim().length >= 2 && !citySearchQuery.isError && displayedResults.length === 0 ? (
              <EmptyStateCard
                title="No matching cities"
                description="Try a broader city name, local spelling, or remove extra characters."
                footer="Examples: Bratislava, Vienna, Malaga"
              />
            ) : null}

            {!hasToken && guestDefaultCityQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading default city...</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{selectedDashboard?.city.name ?? 'City overview'}</CardTitle>
                <CardDescription>View current weather, forecast trends, and air quality for the selected city.</CardDescription>
              </div>
              {selectedDashboard ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selectedDashboard.meta.isStale ? 'secondary' : 'default'}>
                    {selectedDashboard.meta.isStale ? 'Data may be stale' : 'Fresh'}
                  </Badge>
                  <Tooltip
                    content={
                      selectedDashboard.meta.isStale
                        ? 'Some weather blocks are a bit older than expected. Values still work, but refresh may lag.'
                        : 'All weather blocks are up to date.'
                    }
                  >
                    <button
                      type="button"
                      aria-label="Fresh status help"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <CircleHelp className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Badge variant="outline">
                    Fetched at {new Date(selectedDashboard.meta.lastUpdated).toLocaleString()}
                  </Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {dashboardQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-72 w-full" />
              </div>
            ) : null}

            {dashboardQuery.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(dashboardQuery.error)}
              </p>
            ) : null}

            {!dashboardQuery.isLoading && !selectedDashboard ? (
              <EmptyStateCard
                title="Pick a city to begin"
                description={hasToken ? 'Select a saved city from your watchlist or add a new one using search.' : 'Search a city above and open it to load current conditions and forecast charts.'}
                footer={hasToken ? 'Tip: add one dependable city first so the dashboard always opens with useful data.' : 'Guest mode lets you inspect cities without saving them.'}
              />
            ) : null}

            {selectedDashboard ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Temperature" value={formatValue(selectedDashboard.current.temperature, ' C')} />
                  <MetricCard label="Wind Speed" value={formatValue(selectedDashboard.current.windSpeed, ' km/h')} />
                  <MetricCard label="Humidity" value={formatValue(selectedDashboard.current.humidity, ' %')} />
                  <MetricCard label="Precipitation" value={formatValue(selectedDashboard.current.precipitation, ' mm')} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Observation time (city): {formatObservationDateTime(selectedDashboard.current.time)}
                </p>

                <Separator />

                <Tabs className="min-w-0" defaultValue="hourly" value={activeChartTab} onValueChange={(value) => setActiveChartTab(value as ChartTab)}>
                  <div className="overflow-x-auto pb-1"><TabsList className="inline-flex min-w-max">
                    <TabsTrigger value="hourly">Hourly</TabsTrigger>
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="air">Air Quality</TabsTrigger>
                  </TabsList></div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Data status: Current {sourceAvailabilityLabel(selectedDashboard.meta.sources.current)} | Hourly {sourceAvailabilityLabel(selectedDashboard.meta.sources.hourly)} | Daily {sourceAvailabilityLabel(selectedDashboard.meta.sources.daily)} | Air {sourceAvailabilityLabel(selectedDashboard.meta.sources.airQuality)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hourly tab shows a rolling 24h window. Daily tab shows full-day aggregates.
                  </p>

                  {activeChartTab === 'hourly' ? (
                  <TabsContent value="hourly" className="min-w-0">
                    {displayedHourlySeries.length === 0 ? (
                      <EmptyStateCard
                        title="Hourly data unavailable"
                        description="This city does not currently expose hourly forecast values for the selected range."
                        footer="Try another city or check back after the next provider refresh."
                      />
                    ) : (
                      <div className="space-y-4">
                        <ChartFrame className="h-72 w-full">
                          {({ width, height }) => (
                            <ComposedChart width={width} height={height} data={displayedHourlySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d8e1ec" />
                              <XAxis dataKey="dateTime" tickFormatter={(value) => formatDateTimeTick(String(value), isCompactCharts)} minTickGap={isCompactCharts ? 56 : 32} />
                              <YAxis yAxisId="temp" unit="C" />
                              <YAxis yAxisId="precip" orientation="right" unit="mm" />
                              <RechartsTooltip labelFormatter={(value) => formatDateTimeTick(String(value))} formatter={formatTempPrecipTooltip} />
                              {!isCompactCharts ? <Legend /> : null}
                              <Area yAxisId="precip" type="monotone" dataKey="precipitation" name="Precipitation" fill="#8ec9f6" stroke="#4ea3ea" fillOpacity={0.35} />
                              <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature" stroke="#1167b1" strokeWidth={2} dot={false} />
                            </ComposedChart>
                          )}
                        </ChartFrame>

                        <ChartFrame className="h-64 w-full">
                          {({ width, height }) => (
                            <LineChart width={width} height={height} data={displayedHourlySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d8e1ec" />
                              <XAxis dataKey="dateTime" tickFormatter={(value) => formatDateTimeTick(String(value), isCompactCharts)} minTickGap={isCompactCharts ? 56 : 32} />
                              <YAxis yAxisId="wind" unit="km/h" />
                              {hasHourlyHumidity ? <YAxis yAxisId="hum" orientation="right" unit="%" /> : null}
                              <RechartsTooltip labelFormatter={(value) => formatDateTimeTick(String(value))} formatter={formatWindHumidityTooltip} />
                              {!isCompactCharts ? <Legend /> : null}
                              <Line yAxisId="wind" type="monotone" dataKey="windSpeed" name="Wind Speed" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                              {hasHourlyHumidity ? (
                                <Line yAxisId="hum" type="monotone" dataKey="humidity" name="Humidity" stroke="#22c55e" strokeWidth={2} dot={false} />
                              ) : null}
                            </LineChart>
                          )}
                        </ChartFrame>

                        {isCompactCharts ? (
                          <p className="text-xs text-muted-foreground">Charts use fewer labels on phones. Open the table for exact values.</p>
                        ) : null}

                        {!hasHourlyHumidity ? (
                          <p className="text-xs text-muted-foreground">
                            Hourly humidity is not available for this city right now. The Current card still shows the latest humidity reading.
                          </p>
                        ) : null}

                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="sm:hidden"
                            onClick={() => setShowHourlyTable((current) => !current)}
                          >
                            {showHourlyTable ? 'Hide table' : 'Show table'}
                          </Button>
                          <div className={cn('min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-md border', !showHourlyTable && 'hidden sm:block')}>
                            <table className="w-full min-w-[640px] text-sm sm:min-w-[760px]">
                              <thead className="bg-muted text-left">
                                <tr>
                                  <th className="px-3 py-2">DateTime</th>
                                  <th className="px-3 py-2">Temp</th>
                                  <th className="px-3 py-2">Precip</th>
                                  <th className="px-3 py-2">Wind</th>
                                  <th className="px-3 py-2">Humidity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedHourlySeries.map((point) => (
                                  <tr key={point.dateTime} className="border-t">
                                    <td className="px-3 py-2">{formatDateTimeTick(point.dateTime)}</td>
                                    <td className="px-3 py-2">{formatValue(point.temperature, ' C')}</td>
                                    <td className="px-3 py-2">{formatValue(point.precipitation, ' mm')}</td>
                                    <td className="px-3 py-2">{formatValue(point.windSpeed, ' km/h')}</td>
                                    <td className="px-3 py-2">{formatValue(point.humidity, ' %')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  ) : null}

                  {activeChartTab === 'daily' ? (
                  <TabsContent value="daily" className="min-w-0">
                    {dailySeries.length === 0 ? (
                      <EmptyStateCard
                        title="Daily data unavailable"
                        description="Daily aggregates are missing for this city right now."
                        footer="Current weather can still be valid even if daily aggregation is temporarily absent."
                      />
                    ) : (
                      <div className="space-y-4">
                        <ChartFrame className="h-72 w-full">
                          {({ width, height }) => (
                            <LineChart width={width} height={height} data={dailySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0}}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d8e1ec" />
                              <XAxis dataKey="date" tickFormatter={(value) => formatDateTick(String(value), isCompactCharts)} minTickGap={isCompactCharts ? 32 : 0} />
                              <YAxis unit="C" />
                              <RechartsTooltip labelFormatter={(value) => formatDateTick(String(value))} formatter={formatTempTooltip} />
                              {!isCompactCharts ? <Legend /> : null}
                              <Line type="monotone" dataKey="tempMin" name="Min Temperature" stroke="#3b82f6" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="tempMax" name="Max Temperature" stroke="#ef4444" strokeWidth={2} dot={false} />
                            </LineChart>
                          )}
                        </ChartFrame>

                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="sm:hidden"
                            onClick={() => setShowDailyTable((current) => !current)}
                          >
                            {showDailyTable ? 'Hide table' : 'Show table'}
                          </Button>
                          <div className={cn('min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-md border', !showDailyTable && 'hidden sm:block')}>
                            <table className="w-full min-w-[640px] text-sm sm:min-w-[760px]">
                              <thead className="bg-muted text-left">
                                <tr>
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Rain sum</th>
                                  <th className="px-3 py-2">Wind max</th>
                                  <th className="px-3 py-2">Sunrise</th>
                                  <th className="px-3 py-2">Sunset</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dailySeries.map((point) => (
                                  <tr key={point.date} className="border-t">
                                    <td className="px-3 py-2">{formatDateTick(point.date)}</td>
                                    <td className="px-3 py-2">{formatValue(point.precipitationSum, ' mm')}</td>
                                    <td className="px-3 py-2">{formatValue(point.windMax, ' km/h')}</td>
                                    <td className="px-3 py-2">{formatIsoDateTime(point.sunrise)}</td>
                                    <td className="px-3 py-2">{formatIsoDateTime(point.sunset)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  ) : null}

                  {activeChartTab === 'air' ? (
                  <TabsContent value="air" className="min-w-0">
                    {airSeries.length === 0 ? (
                      <EmptyStateCard
                        title="Air quality data unavailable"
                        description="Air quality metrics are not available for this city at the moment."
                        footer="When available again, PM2.5, PM10, NO2, and O3 will appear here."
                      />
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={airQualitySeverity.variant}>{airQualitySeverity.label}</Badge>
                          <Tooltip content={airQualityBadgeTitle}>
                            <button
                              type="button"
                              aria-label="Air quality help"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted"
                            >
                              <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                        <ChartFrame className="h-72 w-full">
                          {({ width, height }) => (
                            <LineChart width={width} height={height} data={airSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d8e1ec" />
                              <XAxis dataKey="dateTime" tickFormatter={(value) => formatDateTimeTick(String(value), isCompactCharts)} minTickGap={isCompactCharts ? 56 : 32} />
                              <YAxis />
                              <RechartsTooltip labelFormatter={(value) => formatDateTimeTick(String(value))} formatter={formatAirTooltip} />
                              {!isCompactCharts ? <Legend /> : null}
                              <Line type="monotone" dataKey="pm25" name="PM2.5" stroke="#f97316" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="pm10" name="PM10" stroke="#7c3aed" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="no2" name="NO2" stroke="#0ea5e9" strokeWidth={1.8} dot={false} />
                              <Line type="monotone" dataKey="o3" name="O3" stroke="#22c55e" strokeWidth={1.8} dot={false} />
                            </LineChart>
                          )}
                        </ChartFrame>
                      </div>
                    )}
                  </TabsContent>
                  ) : null}
                </Tabs>
              </>
            ) : null}

            {!hasToken && guestResolveMutation.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(guestResolveMutation.error)}
              </p>
            ) : null}

            {!citySearchQuery.isFetching && debouncedSearch.trim().length >= 2 && !citySearchQuery.isError && displayedResults.length === 0 ? (
              <EmptyStateCard
                title="No matching cities"
                description="Try a broader city name, local spelling, or remove extra characters."
                footer="Examples: Bratislava, Vienna, Malaga"
              />
            ) : null}

            {!hasToken && guestDefaultCityQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading default city...</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


