# Project Platform Plan — Supabase-style Project Manager

**Status:** P0–P3 done (nested Studio + overview/snippets)  
**Date:** 2026-07-20  

## Decisions (locked for v1)

| Question | Decision |
|----------|----------|
| Credential mode | **Two env URLs only:** `PG_MASTER_URL` (instance) + `PLATFORM_DATABASE_URL` (metadata) |
| Project → DB | Project stores `database_name`; runtime URL = master URL with that database |
| Create project | **Link existing** DB on the instance, or **CREATE DATABASE** then link |
| Routing | Studio under `/projects/[id]/database/...`; overview at `/projects/[id]` |
| Platform DB | Same Postgres server, database `pgadmin_platform` |
| Auth | Trusted network / no login (same as today) |
| Multi-DB per project | Deferred |
| Topbar project switcher | Cancelled — return to `/projects` to switch |

---

## 1. Goals

| Goal | Detail |
|------|--------|
| Project-first UX | Landing is a **Projects** page (create / open / archive) |
| One project → one primary Postgres DB | Opening a project scopes Studio to that database |
| Two connection strings | Master instance for DB admin ops; platform DB for project metadata |
| Nested Studio URLs | Shareable `/projects/[id]/database/...` paths |
| Project snippets | Saved SQL stored in the platform DB per project |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  admin_ui                                                   │
│  /projects → /projects/[id] (overview)                      │
│            → /projects/[id]/database/* (Studio)             │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                │ CRUD + snippets             │ Studio queries
                ▼                             ▼
┌───────────────────────────┐    ┌────────────────────────────┐
│  PLATFORM_DATABASE_URL    │    │  PG_MASTER_URL + db name   │
│  projects, sql_snippets   │    │  via postgres-meta         │
└───────────────────────────┘    └────────────────────────────┘
```

### Credential resolution

```ts
connectionString = buildDatabaseUrl(PG_MASTER_URL, project.database_name)
```

### Env example

```bash
PG_META_URL=http://localhost:1337
PG_MASTER_URL=postgresql://postgres:postgres@localhost:5432/postgres
PLATFORM_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pgadmin_platform
```

### Entry

1. `/setup` → configure + `npm run platform:setup`
2. `/projects` → create/link database → **Open**
3. `/projects/[id]` overview → **Open Studio** or SQL snippets
4. `/projects/[id]/database/schemas` (and other Studio pages)

Legacy `/database/*` redirects to the active project’s nested path (or `/projects`).

---

## 3. Schema

- `001_platform_init.sql` — projects / meta  
- `002_project_databases.sql` — `projects.database_name`  
- `003_sql_snippets.sql` — project-scoped snippets  

---

## 4. Remaining (later)

- Optional per-project credential overrides  
- EXPLAIN UI, CSV import, type generators (see FEATURES.md)
