# DB Admin UI — Feature Task List

Living roadmap for turning `admin_ui` into a full Postgres admin panel (Supabase Studio–like).  
Update status as work lands: `pending` · `in_progress` · `done` · `deferred` · `cancelled`

**Theme:** Nova (compact, readable) · blue accent · Studio-like dark UI  
**Stack:** Next.js + shadcn/ui (`base-nova`) · postgres-meta (`db_layer_api`)

> **Project platform:** Supabase-style project manager — see [`PROJECT_PLATFORM_PLAN.md`](./PROJECT_PLATFORM_PLAN.md).  
> **P0–P3 status:** `done` — nested Studio routes + project overview/snippets.

---

## P. Project platform

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P0.1 | Platform DB migrations + `platform:setup` | `done` | `db/migrations`, `npm run platform:setup` |
| P0.2 | Env contract (`PG_MASTER_URL`, `PLATFORM_DATABASE_URL`) | `done` | `.env.example` |
| P0.3 | Health / setup page | `done` | `/setup` |
| P1.1 | Projects list + create/archive/delete | `done` | `/projects` — link existing or create DB |
| P1.2 | Open project → cookie → Studio | `done` | Master URL + `database_name` |
| P1.3 | Project switcher in topbar | `cancelled` | Switch via `/projects` only |
| P2.1 | Nest Studio under `/projects/[id]/database/...` | `done` | Legacy `/database/*` redirects |
| P3.1 | Project-scoped snippets / overview | `done` | `/projects/[id]` + `sql_snippets` |

## 0. Foundation & UI

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F0.1 | Switch shadcn style for compact UI | `done` | Tried Mira (too dense) → settled on **Nova** (`base-nova`) |
| F0.2 | Tighten custom Studio chrome to match component density | `done` | Comfortable Studio spacing (not ultra-cramped) |
| F0.3 | Keep blue accent theme (not Supabase green) | `done` | Already in `globals.css` |
| F0.4 | Shared resource list / proxy patterns | `done` | `/api/meta/[...path]`, `ResourcePage` |

---

## 1. Catalog browsing (introspection)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F1.1 | Schemas list | `done` | |
| F1.2 | Tables list (+ columns) | `done` | |
| F1.3 | Views list | `done` | |
| F1.4 | Materialized views | `done` | |
| F1.5 | Foreign tables | `done` | |
| F1.6 | Functions / procedures | `done` | |
| F1.7 | Types / enums | `done` | |
| F1.8 | Extensions | `done` | |
| F1.9 | Roles | `done` | |
| F1.10 | Indexes | `done` | |
| F1.11 | Triggers | `done` | |
| F1.12 | Publications | `done` | |
| F1.13 | Column detail in table browser | `done` | Structure tab |
| F1.14 | Global catalog search (⌘K) | `done` | |
| F1.15 | ER relationship diagram | `done` | |

---

## 2. SQL & query tools

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F2.1 | SQL Editor (run queries) | `done` | Nested under project Studio |
| F2.2 | SQL format / parse helpers | `done` | Format via `/query/format` |
| F2.3 | Query history + saved snippets | `done` | History localStorage; snippets in platform DB |
| F2.4 | EXPLAIN / EXPLAIN ANALYZE UI | `done` | Explain + Analyze + Plan tab; run selection |
| F2.5 | Results → CSV download | `done` | |

---

## 3. Table data

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F3.1 | Browse rows (sort / filter / pagination) | `done` | |
| F3.2 | Insert / edit / delete rows | `done` | |
| F3.3 | Primary-key aware editing | `done` | |
| F3.4 | Table Editor live sidebar (schema → tables) | `done` | Supabase-style secondary nav |
| F3.5 | CSV import into table | `done` | Table data toolbar |

---

## 4. Schema DDL

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F4.1 | Create / drop / rename tables | `done` | |
| F4.2 | Add / edit / drop columns | `done` | Structure tab |
| F4.3 | Primary keys / foreign keys | `done` | |
| F4.4 | Views / functions create-edit-drop | `done` | |
| F4.5 | Schemas create-edit-drop | `done` | |

---

## 5. Security

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F5.1 | RLS policy CRUD | `done` | |
| F5.2 | Table privileges grant/revoke | `done` | |

---

## 6. Connections (legacy)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F6.1 | Multiple saved connections | `cancelled` | Replaced by project platform |
| F6.2 | Encrypted connection vault | `cancelled` | Replaced by `PG_MASTER_URL` |

---

## 7. Generators / misc

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F7.1 | Type generators UI | `done` | TS / Python / Go / Swift under Database → Tools |
| F7.2 | CSV import | `done` | See F3.5 |

---

## 8. Ops / monitoring

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F8.1 | Activity / locks | `done` | `/…/database/ops` |
| F8.2 | Table sizes | `done` | |
| F8.3 | Slow queries | `done` | |
| F8.4 | Vacuum / analyze | `done` | |
| F8.5 | Config browser | `done` | `/…/database/config` |
| F8.6 | Logs / activity log | `done` | GUCs + pg_stat_activity (not file tail) |
| F8.7 | Logical SQL backup | `done` | `/…/database/backup` |

---

## 9. Storage (RustFS)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F9.1 | Bucket-per-project + project-DB metadata | `done` | `storage.*` schema in project DB; physical `pg-<uuid>` in RustFS |
| F9.2 | Buckets / objects API + Studio UI | `done` | `/…/database/storage`; sidebar Storage module |
| F9.3 | Local RustFS compose + env | `done` | `docker-compose.rustfs.yml`, `RUSTFS_*` |

### High value (Studio-like)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F9.4 | Folder browser | `done` | Prefix breadcrumbs, create folder, bulk delete by prefix |
| F9.5 | Bucket settings UI | `done` | `public`, `file_size_limit`, `allowed_mime_types` |
| F9.6 | Image / PDF preview | `done` | Inline preview dialog via signed URL |
| F9.7 | Upload progress (+ large files) | `done` | XHR progress bar; server multipart ≥8MB |
| F9.8 | Move / rename / copy | `done` | PATCH object → S3 copy/move + DB update |
| F9.9 | Signed URL controls | `done` | Expiry presets, copy signed/public URL |

### Access & security

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F9.10 | RLS-style storage policies | `done` | `storage.policies`; deny definitions block API ops |
| F9.11 | Public object URLs | `done` | Proxy `/storage/public/...` + optional `RUSTFS_PUBLIC_URL` |
| F9.12 | Content scanning hook | `done` | Webhook via settings or `STORAGE_SCAN_WEBHOOK_URL` |

### Ops & admin

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F9.13 | Usage dashboard | `done` | `/storage/usage` + project quota |
| F9.14 | Orphan repair | `done` | DB ↔ RustFS scan + delete either side |
| F9.15 | Bulk zip import | `done` | Buckets toolbar → Import zip |
| F9.16 | Lifecycle rules | `done` | Expire-after-N-days + Apply now |
| F9.17 | Audit log | `done` | `storage.audit_log` + `/storage/audit` |

### Nice-to-have

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F9.18 | Object search / filters | `pending` | Name, MIME, size, date |
| F9.19 | Image transforms / CDN | `pending` | Needs transform service |
| F9.20 | Object versioning | `pending` | Prior versions in RustFS + DB |

---

## 10. Postgres automation (Supabase-like)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| F10.1 | pg_cron UI | `done` | `/…/database/cron` — schedule/pause/run/history |
| F10.2 | pg_net HTTP UI | `done` | `/…/database/pg-net` — GET/POST/DELETE + responses |
| F10.3 | API keys & project settings | `done` | anon / service_role JWTs, JWT secret, API URL, CORS |

---

## Suggested order (historical)

1. **F0** — Foundation ← *done*  
2. **F2.1–F2.3** — SQL Editor ← *done*  
3. **F3.1–F3.3** — Table data browser / editor ← *done*  
4. **F4.1–F4.5** — Schema DDL ← *done*  
5. **F5.1–F5.2** — Policies & privileges ← *done*  
6. **P0–P3** — Project platform ← *done*  
7. Remaining polish (EXPLAIN, CSV import, generators)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-20 | F10.3 — Per-project API keys & settings (anon/service_role, JWT, CORS, URL) |
| 2026-07-20 | F10.1–F10.2 — pg_cron + pg_net Studio UIs |
| 2026-07-20 | Storage F9.10–F9.17: policies, public URLs, scan webhook, usage, orphans, zip, lifecycle, audit |
| 2026-07-20 | Storage F9.4–F9.9 done (folders, settings, preview, upload progress, move/copy, signed URLs); F9.10–F9.20 backlog |
| 2026-07-20 | Storage: RustFS bucket-per-project; metadata in project DB (`storage.*`) |
| 2026-07-20 | Advanced tools: EXPLAIN, Table Editor nav, CSV import, generators, config, logs, backup |
| 2026-07-20 | P2.1–P3.1 — Nested `/projects/[id]/database/*`, overview, SQL snippets |
| 2026-07-20 | Platform model: `PG_MASTER_URL` + `PLATFORM_DATABASE_URL`; projects link/create instance DBs |
| 2026-07-20 | P0–P1 — Platform DB + Projects page (open → Studio) |
| 2026-07-20 | F8.1–F8.4 — Ops hub: activity/locks, table sizes, slow queries, vacuum/analyze |
| 2026-07-20 | F1.14–F1.15 — Global catalog search (⌘K) + ER relationship diagram |
| 2026-07-20 | F4.3–F4.5 — PK/FK on Structure tab; schema/view/function create-edit-drop |
| 2026-07-20 | F6.1–F6.2 — Multi-connection vault (later superseded by platform) |
| 2026-07-20 | F5.1–F5.2 — RLS policy CRUD + table privileges grant/revoke |
| 2026-07-20 | F4.1–F4.2 — Create/drop/rename tables + add/edit/drop columns |
| 2026-07-20 | F3.1–F3.3 — Table data browser with sort/filter/pagination + insert/edit/delete |
| 2026-07-20 | F2.1–F2.3, F2.5 — SQL Editor with format, history, CSV export |
| 2026-07-20 | Created roadmap; F0.1–F0.2 — Mira too dense, switched to Nova + restored blue Studio theme |
