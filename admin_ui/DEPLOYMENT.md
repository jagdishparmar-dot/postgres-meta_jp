# Deploying admin_ui to production

This guide covers running the Postgres admin panel in the cloud to manage multiple project databases on your stack.

## Architecture

```
Internet → TLS reverse proxy → admin_ui (Next.js, port 3000)
                                    ↓ private network
                              postgres-meta / db_layer_api (port 8080)
                                    ↓
                    Postgres (master + platform DB + project DBs)
                    Redis, S3/RustFS (optional)
```

| Service | Role | Exposure |
|---------|------|----------|
| **admin_ui** | Web UI + platform APIs | Public (behind TLS + login) |
| **postgres-meta** (`db_layer_api`) | SQL/catalog proxy | **Private only** — no public ingress |
| **Platform DB** | Project metadata | Private |
| **Master Postgres** | Hosts all project databases | Private |

postgres-meta has **no authentication**. Anyone who can reach it with a connection string can run queries. Keep `PG_META_URL` on an internal network.

---

## Production requirements

When `NODE_ENV=production`, the app **validates environment on startup** and refuses to boot if required secrets are missing or weak.

| Variable | Required | Notes |
|----------|----------|-------|
| `ADMIN_ID` | Yes | Single admin username |
| `ADMIN_PASSWORD` | Yes | Min 16 chars; not common defaults |
| `ADMIN_SESSION_SECRET` | Yes | Min 32 chars; independent from password |
| `PG_META_URL` | Yes | Internal URL to postgres-meta |
| `PG_MASTER_URL` | Yes | Postgres instance for project DBs |
| `PLATFORM_DATABASE_URL` | Yes | Control-plane metadata DB |
| `CONNECTION_VAULT_KEY` | Yes | Min 16 chars; encrypts vault/Redis URLs |
| `COOKIE_SECURE` | Recommended | `true` when served over HTTPS |
| `ENABLE_HSTS` | Optional | `true` when TLS terminates at proxy |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL for links/settings |
| `READY_PROBE_TOKEN` | Optional | Token for `/api/ready` load balancer probes |
| `REDIS_URL` | If using Redis UI | Shared Redis instance |
| `RUSTFS_*` | If using Storage | S3-compatible object storage |

Auth is **always enforced** in production. In development, auth is optional (enabled only when `ADMIN_ID` + `ADMIN_PASSWORD` are set).

---

## Quick start (Docker)

### 1. Prepare secrets

```bash
cp .env.production.example .env.production
# Edit .env.production — use strong random values for passwords/secrets
```

Generate secrets:

```bash
openssl rand -base64 32   # ADMIN_SESSION_SECRET
openssl rand -base64 24   # ADMIN_PASSWORD / CONNECTION_VAULT_KEY
openssl rand -hex 32      # READY_PROBE_TOKEN
```

### 2. Bootstrap platform database (first time)

Run migrations against your platform Postgres **before** or during first deploy:

```bash
# From host with env loaded
pnpm run platform:setup
```

Or set `RUN_PLATFORM_SETUP=true` on the container for the first deploy only.

### 3. Build and run

```bash
docker build -t pgadmin-ui .
docker run --env-file .env.production -p 3000:3000 pgadmin-ui
```

Or use the reference compose file (adjust for your infra):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Put TLS in front

Use nginx, Caddy, Cloudflare, or your cloud load balancer:

- Terminate TLS at the proxy
- Set `COOKIE_SECURE=true` and `ENABLE_HSTS=true`
- Forward `X-Forwarded-For` / `X-Forwarded-Proto` headers
- Restrict source IPs if possible (VPN / allowlist)

---

## Health checks

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | None | Liveness — process is up |
| `GET /api/ready` | Admin session **or** `READY_PROBE_TOKEN` | Readiness — platform DB reachable |

Probe examples:

```bash
# Liveness
curl https://admin.example.com/api/health

# Readiness (with probe token)
curl "https://admin.example.com/api/ready?token=$READY_PROBE_TOKEN"
# or
curl -H "Authorization: Bearer $READY_PROBE_TOKEN" https://admin.example.com/api/ready
```

---

## Security defaults in production

- **Login rate limiting** — 5 failures per IP per 15 minutes
- **HttpOnly session cookies** — signed with `ADMIN_SESSION_SECRET`
- **Security headers** — X-Frame-Options, nosniff, Referrer-Policy, optional HSTS
- **`x-connection-string` header disabled** — cannot bypass project model via raw connection strings (set `ALLOW_CONNECTION_HEADER=true` only if you know you need it)
- **Public storage URLs** — `/api/platform/projects/.../storage/public/...` remain unauthenticated for public buckets; use WAF/CDN rules in production

---

## Deploying postgres-meta (db_layer_api)

Build and run separately on a **private network** (no public ingress):

```bash
cd db_layer_api
docker build -t postgres-meta .
docker run --env-file .env.production --network pgadmin_internal postgres-meta
```

Full guide: **[db_layer_api/DEPLOYMENT.md](../db_layer_api/DEPLOYMENT.md)**

Set in admin_ui: `PG_META_URL=http://postgres-meta:8080` (same Docker network / VPC).

---

## Cloud platforms

### Generic VM / Docker

1. Run postgres-meta internally
2. Run admin_ui with `.env.production`
3. Reverse proxy with TLS
4. Managed Postgres for `PG_MASTER_URL` + `PLATFORM_DATABASE_URL`

### Kubernetes

- Deployment + Service for admin_ui
- Liveness: `/api/health`
- Readiness: `/api/ready?token=...` with `READY_PROBE_TOKEN` from Secret
- Secrets for all env vars above
- NetworkPolicy: admin_ui → postgres-meta → postgres only

### Coolify / Railway / Fly.io

- Set env vars from the table above
- Use `pnpm build && pnpm start` or the Dockerfile
- Attach managed Postgres; run `platform:setup` once
- Enable HTTPS; set `COOKIE_SECURE=true`

---

## Scripts

```bash
pnpm dev              # Local development
pnpm build            # Production build (standalone)
pnpm start            # Start production server
pnpm run check        # Typecheck
pnpm run platform:setup  # Migrate platform DB
```

---

## Checklist before go-live

- [ ] Strong `ADMIN_PASSWORD` (16+ chars) and `ADMIN_SESSION_SECRET` (32+ chars)
- [ ] `CONNECTION_VAULT_KEY` set (not auto-generated `.data/vault.key`)
- [ ] postgres-meta **not** publicly reachable
- [ ] TLS enabled; `COOKIE_SECURE=true`
- [ ] Platform DB migrated (`platform:setup`)
- [ ] Postgres credentials use least privilege where possible
- [ ] `.env.production` / secrets stored in secret manager, not git
- [ ] Sign out tested; login rate limit verified
- [ ] Backup strategy for platform DB and project databases
