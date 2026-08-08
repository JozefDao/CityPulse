const DEFAULT_OPEN_METEO_TIMEOUT_MS = 5_000;

export function getOpenMeteoTimeoutMs(): number {
  const configuredTimeout = Number(process.env.OPEN_METEO_TIMEOUT_MS);

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_OPEN_METEO_TIMEOUT_MS;
}
