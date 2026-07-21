# Deploying postgres-meta (db_layer_api) with Docker

postgres-meta is the **internal API** that admin_ui calls. It has **no authentication** — treat it like a database admin socket and **never expose it to the public internet**.

admin_ui sends the target database on every request via the `pg` HTTP header (project connection string). The `PG_META_DB_*` env vars are only a **default/fallback** connection when no header is sent.

---

## Build the image

From the `db_layer_api` directory:

```bash
cd db_layer_api
docker build -t postgres-meta .
```

This uses the existing multi-stage `Dockerfile`:

1. `npm ci` + `npm run build` (TypeScript → `dist/`)
2. Slim runtime image with `node dist/server/server.js` on port **8080**

---

## Run with Docker

```bash
docker run -d \
  --name postgres-meta \
  -p 8080:8080 \
  -e PG_META_HOST=0.0.0.0 \
  -e PG_META_PORT=8080 \
  -e PG_META_DB_HOST=your-postgres-host \
  -e PG_META_DB_PORT=5432 \
  -e PG_META_DB_NAME=postgres \
  -e PG_META_DB_USER=postgres \
  -e PG_META_DB_PASSWORD=your-password \
  -e PG_META_DB_SSL_MODE=disable \
  postgres-meta
```

Verify:

```bash
curl http://localhost:8080/health
# → {"date":"..."}
```

### Using an env file

```bash
cp .env.example .env.production
# edit .env.production

docker run -d --name postgres-meta \
  --env-file .env.production \
  -p 8080:8080 \
  postgres-meta
```

**Production:** bind to an internal Docker network only — do **not** publish `-p 8080:8080` publicly. admin_ui reaches it by service name, e.g. `PG_META_URL=http://postgres-meta:8080`.

---

## Docker Compose (internal network)

```bash
cp .env.example .env.production
docker compose -f docker-compose.prod.yml up -d --build
```

See `docker-compose.prod.yml` — postgres-meta on a private network, port **not** published to the host by default.

---

## Wire admin_ui to postgres-meta

In admin_ui `.env.production`:

```env
PG_META_URL=http://postgres-meta:8080
```

Both services must share a Docker network (or VPC / private subnet in cloud).

| Service      | Port | Exposure        |
|-------------|------|-----------------|
| admin_ui    | 3000 | Public (TLS)    |
| postgres-meta | 8080 | **Private only** |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_META_HOST` | `0.0.0.0` | Listen address |
| `PG_META_PORT` | `1337` (8080 in Docker) | API port |
| `PG_META_DB_HOST` | `localhost` | Default Postgres host |
| `PG_META_DB_NAME` | `postgres` | Default database |
| `PG_META_DB_USER` | `postgres` | Default user |
| `PG_META_DB_PASSWORD` | `postgres` | Default password |
| `PG_META_DB_PORT` | `5432` | Default port |
| `PG_META_DB_SSL_MODE` | `disable` | Postgres SSL mode |
| `PG_META_DB_URL` | — | Full URL (overrides vars above) |
| `PG_CONN_TIMEOUT_SECS` | `15` | Connection timeout |
| `PG_QUERY_TIMEOUT_SECS` | `55` | Query timeout |
| `PG_META_MAX_RESULT_SIZE_MB` | `2048` | Max result size |
| `PG_META_MAX_BODY_LIMIT_MB` | `3` | Max request body |

---

## Cloud deployment notes

### Docker / VM

- Run postgres-meta on the same private network as admin_ui and Postgres
- No public load balancer on port 8080
- Restrict firewall / security group to admin_ui IP or Docker network only

### Kubernetes

```yaml
# Deployment — no Ingress for postgres-meta
# Service type ClusterIP, port 8080
# admin_ui env: PG_META_URL=http://postgres-meta.default.svc.cluster.local:8080
```

### Coolify / similar

1. Create a **private** service from `db_layer_api/Dockerfile`
2. Do not assign a public domain
3. Set admin_ui `PG_META_URL` to the internal service URL Coolify provides

---

## Security checklist

- [ ] postgres-meta **not** reachable from the internet
- [ ] Only admin_ui (or trusted internal services) can call port 8080
- [ ] Postgres credentials in env / secret manager, not in git
- [ ] Use TLS (`PG_META_DB_SSL_MODE=require`) for managed Postgres when applicable
- [ ] admin_ui login enabled (`ADMIN_ID`, `ADMIN_PASSWORD`, etc.) — see `../admin_ui/DEPLOYMENT.md`

---

## Local development (without Docker)

```powershell
cd db_layer_api
npm install
$env:PG_META_HOST="0.0.0.0"
$env:PG_META_PORT="1337"
$env:PG_META_DB_HOST="localhost"
$env:PG_META_DB_PASSWORD="postgres"
npm run dev:code
```

admin_ui: `PG_META_URL=http://localhost:1337`
