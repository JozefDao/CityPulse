export type AppEnv = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  CLOUDINARY_URL?: string;
  CRON_SECRET?: string;
  CORS_ORIGIN?: string;
  [key: string]: string | undefined;
};

export function isProductionEnv(env: AppEnv): boolean {
  return env.NODE_ENV?.trim().toLowerCase() === 'production';
}

export function validateAppConfig(config: Record<string, string | undefined>) {
  const normalized: AppEnv = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, value?.trim()]),
  );

  if (!isProductionEnv(normalized)) {
    return normalized;
  }

  const missingKeys = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CLOUDINARY_URL',
    'CRON_SECRET',
    'CORS_ORIGIN',
  ].filter((key) => !normalized[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missingKeys.join(', ')}`,
    );
  }

  if (normalized.JWT_ACCESS_SECRET === normalized.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.',
    );
  }

  return normalized;
}
