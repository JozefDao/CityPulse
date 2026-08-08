import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { api, getApiErrorMessage } from '../lib/api';
import type { AlertEventDto, AlertMetric, AlertOperator, AlertRuleDto, WatchlistItemDto } from '../lib/types';

const metricOptions: Array<{ value: AlertMetric; label: string; unit: string }> = [
  { value: 'TEMPERATURE', label: 'Temperature', unit: 'C' },
  { value: 'WIND_SPEED', label: 'Wind speed', unit: 'km/h' },
  { value: 'HUMIDITY', label: 'Humidity', unit: '%' },
  { value: 'PRECIPITATION', label: 'Precipitation', unit: 'mm' },
  { value: 'PM25', label: 'PM2.5', unit: 'ug/m3' },
  { value: 'PM10', label: 'PM10', unit: 'ug/m3' },
];

const operatorOptions: Array<{ value: AlertOperator; label: string }> = [
  { value: 'GT', label: '>' },
  { value: 'GTE', label: '>=' },
  { value: 'LT', label: '<' },
  { value: 'LTE', label: '<=' },
];

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString();
}

export function AlertsPage() {
  const queryClient = useQueryClient();

  const [cityId, setCityId] = useState('');
  const [metric, setMetric] = useState<AlertMetric>('TEMPERATURE');
  const [operator, setOperator] = useState<AlertOperator>('LT');
  const [threshold, setThreshold] = useState('0');
  const [message, setMessage] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);

  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => (await api.get<WatchlistItemDto[]>('/me/watchlist')).data,
  });

  const rulesQuery = useQuery({
    queryKey: ['alerts', 'rules'],
    queryFn: async () => (await api.get<AlertRuleDto[]>('/me/alerts/rules')).data,
  });

  const eventsQuery = useQuery({
    queryKey: ['alerts', 'events', showUnreadOnly],
    queryFn: async () => {
      return (
        await api.get<AlertEventDto[]>('/me/alerts/events', {
          params: {
            unreadOnly: showUnreadOnly,
            limit: 40,
          },
        })
      ).data;
    },
  });

  const selectedMetric = useMemo(
    () => metricOptions.find((item) => item.value === metric) ?? metricOptions[0],
    [metric],
  );

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const parsedThreshold = Number(threshold);
      if (!cityId) {
        throw new Error('Select a city first');
      }
      if (!Number.isFinite(parsedThreshold)) {
        throw new Error('Threshold must be a valid number');
      }

      await api.post('/me/alerts/rules', {
        cityId,
        metric,
        operator,
        threshold: parsedThreshold,
      });
    },
    onSuccess: async () => {
      setMessage('Alert rule created.');
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
    },
    onError: (error) => setMessage(getApiErrorMessage(error)),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async (rule: AlertRuleDto) => {
      await api.patch(`/me/alerts/rules/${rule.id}`, {
        isActive: !rule.isActive,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
    },
    onError: (error) => setMessage(getApiErrorMessage(error)),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await api.delete(`/me/alerts/rules/${ruleId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
    },
    onError: (error) => setMessage(getApiErrorMessage(error)),
  });

  const markReadMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.patch(`/me/alerts/events/${eventId}/read`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'events'] });
    },
    onError: (error) => setMessage(getApiErrorMessage(error)),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/me/alerts/events/read-all');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'events'] });
      setMessage('All notifications marked as read.');
    },
    onError: (error) => setMessage(getApiErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Weather alerts</CardTitle>
          <CardDescription>Create threshold rules for watched cities and track triggered notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(watchlistQuery.data?.length ?? 0) === 0 && !watchlistQuery.isLoading ? (
            <EmptyStateCard
              title="Add a city before creating alerts"
              description="Alert rules are attached to cities in your watchlist. Save at least one city on the dashboard first."
              footer="Once a city is saved, you can define threshold rules for temperature, wind, humidity, precipitation, and PM values."
            />
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">City</span>
              <select
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select city</option>
                {watchlistQuery.data?.map((item) => (
                  <option key={item.cityId} value={item.cityId}>
                    {item.city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Metric</span>
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as AlertMetric)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {metricOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Operator</span>
              <select
                value={operator}
                onChange={(event) => setOperator(event.target.value as AlertOperator)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {operatorOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Threshold ({selectedMetric.unit})</span>
              <Input value={threshold} onChange={(event) => setThreshold(event.target.value)} />
            </label>
          </div>

          <Button onClick={() => createRuleMutation.mutate()} disabled={createRuleMutation.isPending}>
            {createRuleMutation.isPending ? 'Creating...' : 'Create alert rule'}
          </Button>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active rules</CardTitle>
          <CardDescription>Rules are evaluated every 30 minutes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rulesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading rules...</p> : null}
          {rulesQuery.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(rulesQuery.error)}
            </p>
          ) : null}

          {!rulesQuery.isLoading && !rulesQuery.isError && (rulesQuery.data?.length ?? 0) === 0 ? (
            <EmptyStateCard
              title="No alert rules yet"
              description="Create your first threshold rule above to get notified when city conditions cross a limit you care about."
              footer="Example: temperature below 0 C, PM2.5 above 35 ug/m3, or wind speed above 25 km/h."
            />
          ) : null}

          {rulesQuery.data?.map((rule) => {
            const metric = metricOptions.find((item) => item.value === rule.metric);
            const op = operatorOptions.find((item) => item.value === rule.operator);

            return (
              <div key={rule.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {rule.city.name}: {metric?.label ?? rule.metric} {op?.label ?? rule.operator} {rule.threshold} {metric?.unit ?? ''}
                  </p>
                  <span className={`rounded-md px-2 py-1 text-xs ${rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>
                    {rule.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Last value: {rule.lastEvaluationValue ?? 'N/A'} | Last triggered: {formatDateTime(rule.lastTriggeredAt)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => toggleRuleMutation.mutate(rule)} disabled={toggleRuleMutation.isPending}>
                    {rule.isActive ? 'Pause' : 'Activate'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => deleteRuleMutation.mutate(rule.id)} disabled={deleteRuleMutation.isPending}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Alerts center</CardTitle>
              <CardDescription>Triggered notifications from your alert rules.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setShowUnreadOnly((value) => !value)}>
                {showUnreadOnly ? 'Show all' : 'Show unread'}
              </Button>
              <Button type="button" variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                Mark all read
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {eventsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading notifications...</p> : null}
          {eventsQuery.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(eventsQuery.error)}
            </p>
          ) : null}

          {!eventsQuery.isLoading && !eventsQuery.isError && (eventsQuery.data?.length ?? 0) === 0 ? (
            <EmptyStateCard
              title={showUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
              description={showUnreadOnly ? 'Everything is marked as read right now.' : 'Triggered alert events will appear here after one of your rules is hit.'}
              footer={showUnreadOnly ? 'Switch to Show all if you want to review older events.' : 'Rules are evaluated on schedule, so this section can stay empty until real weather values cross your thresholds.'}
            />
          ) : null}

          {eventsQuery.data?.map((event) => (
            <div key={event.id} className={`rounded-md border p-3 ${event.isRead ? 'border-border' : 'border-primary/40 bg-primary/5'}`}>
              <p className="text-sm font-medium">{event.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">Triggered: {formatDateTime(event.createdAt)}</p>
              {!event.isRead ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={() => markReadMutation.mutate(event.id)}
                  disabled={markReadMutation.isPending}
                >
                  Mark as read
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
