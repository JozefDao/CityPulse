# CityPulse

CityPulse is a fullstack weather and air-quality application built with NestJS, React, TypeScript, MySQL, and Prisma.

It combines three product areas in one app:

- weather dashboard for selected cities
- alert rules and notifications
- guide articles with comments, favorites, moderation, and admin tools

## Stack

### Backend

- NestJS
- Prisma ORM
- MySQL
- JWT auth with refresh-cookie flow
- Swagger

### Frontend

- Vite
- React + TypeScript
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- shadcn/ui
- Recharts
- react-markdown + remark-gfm

## Monorepo structure

- `apps/backend` - NestJS API, Prisma schema, seed scripts
- `apps/frontend` - React application
- `docker-compose.yml` - local MySQL service
- `package.json` - root local-development commands
- `apps/backend/.env.example` - backend environment template
- `apps/frontend/.env.example` - frontend environment template

## Core features

- auth with login, register, refresh, logout
- profile settings with nickname, bio, avatar, and password change
- weather dashboard with search, watchlist, current metrics, charts, and tables
- alert rules and notifications
- public guide articles rendered from markdown
- comments, favorites, and author pages
- admin moderation for comments and flagged articles
- admin content management

## Local development

### Prerequisites

- Node.js and npm
- Docker Desktop or Docker Engine, installed and running
- Internet access for the Open-Meteo weather and air-quality requests

For normal local development, no account or credentials are needed for
Cloudinary, TiDB, Vercel, or Cloudflare.

### Quick Start

```bash
git clone <repo>
cd CityPulse_project
npm install
npm run bootstrap:local
npm run dev
```

`npm run bootstrap:local` prepares the complete local backend environment. It:

- starts or prepares the local MySQL 8 database through Docker Compose;
- waits until MySQL is ready to accept connections;
- creates `apps/backend/.env` when it does not yet exist;
- adds safe, development-only JWT and `CRON_SECRET` values without printing
  them;
- configures the local `DATABASE_URL`;
- runs `prisma generate`;
- applies the full Prisma migration history with `prisma migrate deploy`; and
- runs the seed.

`npm run dev` runs the bootstrap again safely, then starts:

- the NestJS backend;
- the React/Vite frontend; and
- the local weather and alerts scheduler.

Local addresses:

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3001/api`

Existing `apps/backend/.env` files are never overwritten. The bootstrap only
adds missing or blank development-only secrets and accepts only an unset or
`development` `NODE_ENV` with a loopback MySQL host. This prevents it from
being used accidentally with a production-like database.

### Individual local commands

Prepare only the local database and backend environment:

```bash
npm run bootstrap:local
```

Start or stop only the local MySQL service:

```bash
npm run db:up
npm run db:down
```

Run only the development job runner after the API is already running:

```bash
npm run dev:jobs
```

The development job runner calls the existing protected job endpoints with the
local `CRON_SECRET`: weather once immediately and then every five minutes,
alerts once immediately and then every 30 minutes. It is development-only and
accepts only an unset or `development` `NODE_ENV`. Production continues to use
external scheduling against those same endpoints.

### Local avatars

With `NODE_ENV=development` (or no `NODE_ENV`) and no `CLOUDINARY_URL`, avatar
uploads are stored locally in `apps/backend/uploads/avatars` and served by the
backend under `/uploads`. A Cloudinary account is not needed for local
development, and this runtime directory is ignored by Git.

With `NODE_ENV=production`, the backend never enables local avatar storage or
static `/uploads` serving. A valid `CLOUDINARY_URL` is required; missing or
malformed Cloudinary credentials cause backend startup to fail. When a
`CLOUDINARY_URL` is configured, uploads continue to use Cloudinary. Other
non-development environments also fail rather than falling back to local disk.

## Production deployment

The production architecture is separate from the local workflow:

- frontend: Vercel
- backend: Vercel
- database: TiDB Cloud
- avatar storage: Cloudinary
- scheduled weather and alerts jobs: Cloudflare Cron calling the protected
  backend job endpoints

Set all production secrets and credentials through the hosting environment
variables. Production never falls back to local avatar storage: it requires a
valid Cloudinary configuration.

## Environment variables

### Backend

The backend loads `apps/backend/.env`; its committed template is
`apps/backend/.env.example`. There is no root `.env.example`.

The Quick Start does not require creating this file manually.
`npm run bootstrap:local` creates a missing backend `.env` with safe local
values. Use the template only for advanced or production-style configuration.
To configure it manually, copy the template and replace only placeholder values
in the local, ignored file. Never commit a real `.env` file.

Backend variables:

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

`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, and
`CLOUDINARY_URL` are secrets or credentials in production and must use real,
deployment-specific values. `CLOUDINARY_URL` may be empty only in local
development, where the development-only local avatar storage is used instead.

### Frontend

The frontend does not need `apps/frontend/.env` for the standard local flow: it
falls back to `http://localhost:3001/api`. To override that URL, copy
`apps/frontend/.env.example` to `apps/frontend/.env` and set
`VITE_API_BASE_URL` there. This is optional advanced configuration. Vite
exposes only `VITE_*` variables to the browser, so they must not contain
secrets.

Frontend variables:

- `VITE_API_BASE_URL`

## Auth, cookies, and CORS

Local development:

- frontend origin: `http://localhost:5173`
- backend origin: `http://localhost:3001`
- cookies use `sameSite="lax"` and `secure=false`

Production with separate frontend and backend domains:

- set `NODE_ENV=production`
- set backend `CORS_ORIGIN` to the frontend domain
- cookies use `sameSite="none"` and `secure=true`
- frontend `VITE_API_BASE_URL` must point to the deployed backend `/api` base URL

## Database reset

To reset the database into the deployment-ready state:

```bash
cd apps/backend
npm run prisma:reset:production-admin
```

This leaves:

- one admin account
- zero comments
- zero likes
- five curated seed guide articles

## Testing

Frontend:

```bash
cd apps/frontend
npm run lint
npm run build
npm run test:e2e
```

Backend:

```bash
cd apps/backend
npm run lint
npm run build
npm run test -- --runInBand
```
