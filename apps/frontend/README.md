# CityPulse Frontend

React frontend for the CityPulse application.

## Responsibilities

- authentication UI
- weather dashboard UI
- guides, comments, and favorites
- alerts UI
- profile settings and avatar flow
- admin moderation interface

## Tech

- Vite
- React + TypeScript
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- shadcn/ui
- Recharts
- react-markdown + remark-gfm
- Playwright

## Local development

Run these commands from the repository root:

```bash
npm install
npm run bootstrap:local
npm run dev
```

The root bootstrap starts local MySQL, prepares the local backend environment,
generates Prisma Client, applies migrations, and seeds the database. The root
`npm run dev` starts the backend, this frontend, and the local development job
runner. It also runs the bootstrap step, so a later `npm run dev` is sufficient
after the first setup.

- frontend: `http://localhost:5173`
- local API: `http://localhost:3001/api`

To run only the frontend after the root bootstrap and backend are already
running:

```bash
cd apps/frontend
npm run dev
```

## Environment variables

The frontend does not require `apps/frontend/.env` for local development.
Without `VITE_API_BASE_URL`, it falls back to
`http://localhost:3001/api`.

To override the API URL, copy `apps/frontend/.env.example` to
`apps/frontend/.env` and set:

```dotenv
VITE_API_BASE_URL=https://<PUBLIC_BACKEND_HOST>/api
```

Use a publicly reachable deployed backend URL in production. Only `VITE_*`
variables are exposed to the browser, so they must not contain secrets. Local
`.env` files are ignored by Git; there is no root `.env.example`.

Production build:

```bash
npm run build
npm run preview
```

## Quality checks

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

E2E tests:

```bash
npm run test:e2e
```

## Notes

- the frontend uses `withCredentials=true` for auth requests
- access tokens are kept in client state and refreshed through the backend refresh cookie flow
- markdown article detail pages are rendered with `react-markdown` and `remark-gfm`
- charts are rendered with Recharts and have mobile-friendly fallback behavior
