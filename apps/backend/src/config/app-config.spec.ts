import { validateAppConfig } from './app-config';

describe('validateAppConfig', () => {
  it('returns normalized config in development without requiring production-only values', () => {
    const config = validateAppConfig({ NODE_ENV: 'development' });

    expect(config.NODE_ENV).toBe('development');
  });

  it('throws when a required production environment variable is missing', () => {
    expect(() =>
      validateAppConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'access',
        JWT_REFRESH_SECRET: 'refresh',
        CLOUDINARY_URL: 'cloudinary://api:key@cloudname',
        CRON_SECRET: 'cron',
      }),
    ).toThrow(/Missing required environment variables in production:/);
  });

  it('throws when production CORS_ORIGIN is missing', () => {
    expect(() =>
      validateAppConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://localhost/db',
        JWT_ACCESS_SECRET: 'access',
        JWT_REFRESH_SECRET: 'refresh',
        CLOUDINARY_URL: 'cloudinary://api:key@cloudname',
        CRON_SECRET: 'cron',
      }),
    ).toThrow(/Missing required environment variables in production: CORS_ORIGIN/);
  });

  it('throws when production JWT secrets are equal', () => {
    expect(() =>
      validateAppConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://localhost/db',
        JWT_ACCESS_SECRET: 'same',
        JWT_REFRESH_SECRET: 'same',
        CLOUDINARY_URL: 'cloudinary://api:key@cloudname',
        CRON_SECRET: 'cron',
        CORS_ORIGIN: 'http://example.com',
      }),
    ).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different/);
  });

  it('accepts all required production values when they are present and distinct', () => {
    const config = validateAppConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'mysql://localhost/db',
      JWT_ACCESS_SECRET: 'access',
      JWT_REFRESH_SECRET: 'refresh',
      CLOUDINARY_URL: 'cloudinary://api:key@cloudname',
      CRON_SECRET: 'cron',
      CORS_ORIGIN: 'http://example.com',
    });

    expect(config.JWT_ACCESS_SECRET).toBe('access');
    expect(config.JWT_REFRESH_SECRET).toBe('refresh');
    expect(config.CORS_ORIGIN).toBe('http://example.com');
  });
});
