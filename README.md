# postgres-meta workspace

Monorepo with two projects:

| Folder | Purpose |
|--------|---------|
| `db_layer_api/` | [postgres-meta](https://github.com/supabase/postgres-meta) — REST API over PostgreSQL catalogs |
| `admin_ui/` | Next.js + shadcn DB admin UI (Studio-like, blue theme) |

## Docker stack (all-in-one)

Run **[supabase/postgres](https://hub.docker.com/r/supabase/postgres)** (pg_cron, pg_net, pg_stat_statements, PostGIS, and more pre-packaged), Redis, RustFS, postgres-meta, and admin_ui together on one internal network — no external services required.

```bash
cp .env.stack.example .env
# Edit .env — set POSTGRES_PASSWORD and admin secrets (see file for min lengths)

docker compose up -d --build
```

Open **http://localhost:3000** and sign in with `ADMIN_ID` / `ADMIN_PASSWORD` from `.env`.

| Service | Access |
|---------|--------|
| admin_ui | http://localhost:3000 (only public port) |
| postgres-meta | internal `http://postgres-meta:8080` |
| Supabase Postgres | internal `postgres:5432` |
| Redis | internal `redis:6379` |
| RustFS (S3) | internal `http://rustfs:9000` |

Storage requires `RUSTFS_ENDPOINT`, `RUSTFS_ACCESS_KEY`, and `RUSTFS_SECRET_KEY` on **admin_ui** (set in root `.env` / compose). If **New bucket** is disabled, check the Storage page alert and verify the `rustfs` service is running.

On first boot, bootstrap scripts in `admin_ui/db/bootstrap/` create Supabase roles (`supabase_admin`, etc.) and enable `pg_cron`, `pg_net`, and `pg_stat_statements` on the default `postgres` database.

First boot runs platform DB migrations automatically (`RUN_PLATFORM_SETUP=true`). Data persists in Docker volumes (`postgres_data`, `redis_data`, `rustfs_data`).

**Note:** `POSTGRES_IMAGE` major version must match your data volume. If you change it (e.g. 17 → 15), reset: `docker compose down -v` (deletes local DB data).

For split deploy (Coolify / separate hosts), see [`admin_ui/DEPLOYMENT.md`](./admin_ui/DEPLOYMENT.md) and [`db_layer_api/DEPLOYMENT.md`](./db_layer_api/DEPLOYMENT.md).

## Quick start (local dev)

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
