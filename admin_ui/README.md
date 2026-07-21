# DB Admin UI

Next.js + shadcn admin console for Postgres, backed by `../db_layer_api` (postgres-meta).

## Setup

```bash
npm install
cp .env.example .env.local   # if needed
npm run dev
```

Requires postgres-meta running at `PG_META_URL` (default `http://localhost:1337`).

## Production deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for cloud/Docker setup, required secrets, health checks, and security checklist.

```bash
cp .env.production.example .env.production
docker build -t pgadmin-ui .
docker run --env-file .env.production -p 3000:3000 pgadmin-ui
```

## Features

See [FEATURES.md](./FEATURES.md) for the full roadmap and task status.

- Connect to any Postgres instance
- Browse: schemas, tables (with column detail), views, materialized views, foreign tables
- Browse: functions, types, roles, policies, extensions, indexes, triggers, publications

UI: **shadcn Nova** (compact but readable) + Studio-like dark layout with a **blue** accent.  
Note: Mira was too dense for this UI; Nova is the settled style.
