import { assertDevelopmentMode, loadBackendEnv } from './local-env.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEATHER_INTERVAL_MS = 5 * 60 * 1_000;
const ALERTS_INTERVAL_MS = 30 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 30_000;

function getLocalApiBaseUrl(env) {
  const port = env.PORT?.trim() || '3001';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('apps/backend/.env has an invalid PORT for the local scheduler.');
  }

  return `http://127.0.0.1:${port}/api`;
}

async function callJob(baseUrl, secret, path, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.text();
    console.log(`[local scheduler] ${label}: ${body || 'completed'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[local scheduler] ${label} failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForApi(baseUrl) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The Nest dev server is still starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }

  console.warn(
    '[local scheduler] API did not become ready within 60 seconds; scheduled requests will keep retrying.',
  );
}

export async function startLocalScheduler() {
  const env = loadBackendEnv();
  assertDevelopmentMode(
    env.NODE_ENV?.trim() || process.env.NODE_ENV,
    'The local scheduler',
  );

  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error('apps/backend/.env must define CRON_SECRET for the local scheduler.');
  }

  const baseUrl = getLocalApiBaseUrl(env);
  await waitForApi(baseUrl);

  const refreshWeather = () =>
    callJob(baseUrl, secret, '/internal/jobs/weather-refresh', 'weather refresh');
  const evaluateAlerts = () =>
    callJob(baseUrl, secret, '/internal/jobs/alerts-evaluate', 'alerts evaluation');

  await Promise.all([refreshWeather(), evaluateAlerts()]);
  setInterval(refreshWeather, WEATHER_INTERVAL_MS);
  setInterval(evaluateAlerts, ALERTS_INTERVAL_MS);
  console.log('[local scheduler] weather: every 5 minutes; alerts: every 30 minutes.');
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  startLocalScheduler().catch((error) => {
    console.error(`Local scheduler failed: ${error.message}`);
    process.exitCode = 1;
  });
}
