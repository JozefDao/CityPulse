# CityPulse Backend

NestJS backend for the CityPulse application.

## Responsibilities

- authentication and refresh-cookie flow
- user profile management
- city search and watchlist
- weather dashboard aggregation
- alert rules and alert events
- article, comment, favorite, and moderation APIs
- protected weather and alert job endpoints
- Swagger documentation

## Tech

- NestJS
- Prisma
- MySQL for local development; MySQL-compatible TiDB Cloud for production
- JWT
- Swagger

## Local development

Run the normal local workflow from the repository root, not from this backend
directory:

```bash
npm install
npm run bootstrap:local
npm run dev
```

`npm run bootstrap:local` starts Docker MySQL 8, creates a missing
`apps/backend/.env` with local-only values, runs Prisma generate, applies the
migrations with `prisma migrate deploy`, and seeds the database. It never
overwrites an existing `.env`. `npm run dev` performs the same idempotent
bootstrap before starting the backend, frontend, and development job runner.

The local API runs at `http://localhost:3001`; Swagger is available at
`http://localhost:3001/api/docs`, with JSON at
`http://localhost:3001/api/docs-json`.

Useful root-level commands:

```bash
npm run db:up
npm run db:down
npm run dev:jobs
```

The development job runner calls the existing protected endpoints using the
local `CRON_SECRET`: `POST /api/internal/jobs/weather-refresh` every five
minutes and `POST /api/internal/jobs/alerts-evaluate` every 30 minutes. It is
development-only. Production continues to trigger those same endpoints
externally.

### Backend-only development

After the root bootstrap has completed, the backend can be started by itself
from `apps/backend`:

```bash
npm run start:dev
```

### Local avatars

With `NODE_ENV=development` (or no `NODE_ENV`) and no `CLOUDINARY_URL`, avatar
uploads are stored under `apps/backend/uploads/avatars` and served as
`/uploads/avatars/...`. The directory is local runtime data and is ignored by
Git. No Cloudinary account is needed for local development.

## Environment variables

The backend loads `apps/backend/.env`. The committed
`apps/backend/.env.example` is a reference and advanced configuration template,
not a required first-run step: use the root bootstrap workflow above for normal
local setup. There is no root `.env.example`.

Do not commit a real `.env` file. The template documents these variables:

- `NODE_ENV`
- `PORT`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `CLOUDINARY_URL`
- `OPEN_METEO_TIMEOUT_MS`
- `CRON_SECRET`

For an advanced manual local configuration, copy `.env.example` to `.env` from
this directory and replace placeholders only in the ignored `.env` file. Local
development can leave `CLOUDINARY_URL` empty to use local avatars.

## Prisma

The root bootstrap handles the usual local Prisma steps. Run these commands
from `apps/backend` only when working on Prisma directly:

Generate the client:

```bash
npm run prisma:generate
```

Apply pending migrations to the configured database:

```bash
npm run prisma:migrate:deploy
```

Seed the configured database:

```bash
npm run prisma:seed
```

Reset a deliberately selected database to the deployment-ready admin-only
state:

```bash
npm run prisma:reset:production-admin
```

## Tests and build

Run these commands from `apps/backend`:

```bash
npm run test -- --runInBand
npm run build
```

`npm run lint` is available, but its current script uses ESLint `--fix` and can
modify files.

## Production

Production uses the deployed MySQL-compatible TiDB Cloud database and
Cloudinary; neither has a local fallback in production. Configure production
values through the hosting provider's environment variables, rather than a
committed `.env` file. In particular, provide a production `DATABASE_URL`,
strong distinct JWT and cron secrets, `CORS_ORIGIN`, and a valid
`CLOUDINARY_URL`.

With `NODE_ENV=production`, the backend never serves or writes local avatar
files. Missing or malformed `CLOUDINARY_URL` makes startup fail. Production
scheduling must invoke the protected job endpoints externally (for example via
Cloudflare Workers Cron Triggers), not through an in-process Nest scheduler.

For a production-style backend process:

```bash
npm run build
npm run start:prod
```

Additional production notes:

- `CORS_ORIGIN` must match the deployed frontend origin.
- Cookies use `sameSite=none` and `secure=true` in production mode.
- `start:prod` uses the built entry file at `dist/src/main`.
