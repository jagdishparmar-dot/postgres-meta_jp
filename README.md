# postgres-meta workspace

Monorepo with two projects:

| Folder | Purpose |
|--------|---------|
| `db_layer_api/` | [postgres-meta](https://github.com/supabase/postgres-meta) — REST API over PostgreSQL catalogs |
| `admin_ui/` | Next.js + shadcn DB admin UI (Studio-like, blue theme) |

## Quick start

### 1. Start Postgres (test DB)

```bash
cd db_layer_api
npm install
npm run db:run
```

### 2. Start postgres-meta API

```bash
cd db_layer_api
# Windows PowerShell:
$env:PG_META_HOST="0.0.0.0"
$env:PG_META_PORT="1337"
$env:PG_META_DB_HOST="localhost"
$env:PG_META_DB_NAME="postgres"
$env:PG_META_DB_USER="postgres"
$env:PG_META_DB_PORT="5432"
$env:PG_META_DB_PASSWORD="postgres"
npm run dev:code
```

API: http://localhost:1337

### 3. Start admin UI

```bash
cd admin_ui
npm install
npm run dev
```

UI: http://localhost:3000

Default connection form values match the Docker test DB (`postgres` / `postgres` @ `localhost:5432`).

## Current admin features

See [`admin_ui/FEATURES.md`](./admin_ui/FEATURES.md) for the living task list.

- Database connection form (stored in browser localStorage)
- Browse: schemas, tables (column detail sheet), views, materialized views, foreign tables
- Browse: functions, types, roles, policies, extensions, indexes, triggers, publications
- UI: shadcn **Nova** (readable compact) + blue accent

## Security

postgres-meta has **no auth**. Run both services locally or behind a private network only.
