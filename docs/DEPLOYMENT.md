# Deployment Guide

Rawaqan deploys as two independent artifacts: a **static frontend** (Vite build) and a
**Node API** with a **PostgreSQL** database and **Cloudinary** for images.

## 1. Provision services
- **PostgreSQL 14+** — managed (Neon, Supabase, RDS, Railway) or self-hosted.
- **Cloudinary** account — for image storage/optimization.
- **Node host** for the API (Render, Railway, Fly.io, a VM, or a container platform).
- **Static host / CDN** for the frontend (Vercel, Netlify, Cloudflare Pages, S3+CloudFront).

## 2. Backend

### Environment (production)
Set every var from `backend/.env.example`. Generate strong secrets:
```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET, and again for JWT_REFRESH_SECRET
```
Required: `NODE_ENV=production`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, `PUBLIC_SITE_URL`
(public frontend URL — QR target), `CORS_ORIGINS` (comma-separated frontend origins).

**Neon:** set `DATABASE_URL` to the **pooled** endpoint (host contains `-pooler`, append
`?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` to the **direct** endpoint (no `-pooler`).
Prisma uses `DIRECT_URL` for `migrate deploy` and `DATABASE_URL` for runtime queries. Run
migrations as a one-off release command, not inside the always-on web process, when running
multiple instances.

**Cross-site cookies (Vercel frontend + Render API = different sites):** in production the refresh
cookie is issued `SameSite=None; Secure` (auto, when `NODE_ENV=production`), so both domains must be
HTTPS and `CORS_ORIGINS` must list the exact Vercel origin. Alternatively proxy `/api/*` from Vercel
to Render to keep everything first-party (then cookies are `Lax` and CSRF surface shrinks).

### Build & migrate & run
```bash
npm ci
npm run db:generate --workspace backend
npm run db:deploy   --workspace backend   # prisma migrate deploy (no dev prompts)
npm run db:seed     --workspace backend   # first deploy only
npm run build       --workspace backend
node backend/dist/server.js               # or: npm start --workspace backend
```
The API sits behind a proxy; `trust proxy` is enabled so rate-limiting and `req.ip` work.

### Cookies across domains
The refresh cookie is `SameSite=Lax`, `Secure` in production, scoped to `/api/auth`. If the
frontend and API are on **different sites**, either serve both behind one domain (recommended,
via a reverse proxy) or switch the cookie to `SameSite=None; Secure` and ensure HTTPS.

## 3. Frontend
```bash
# frontend/.env
VITE_API_BASE_URL=https://api.rawaqan.example.com/api
VITE_SITE_URL=https://rawaqan.example.com

npm run build --workspace frontend        # outputs frontend/dist
```
Deploy `frontend/dist` to your static host. Add a SPA rewrite so all routes serve `index.html`
(e.g. Netlify `/* /index.html 200`, Vercel rewrites, or Nginx `try_files $uri /index.html`).

## 4. Reverse proxy (single-domain, recommended)
Serve the SPA at `/` and proxy `/api`, `/sitemap.xml`, `/robots.txt`, `/health` to the API.
This keeps cookies first-party and avoids CORS entirely.

## 5. One-command Docker deployment (recommended)
The repo ships a full production stack (`docker-compose.prod.yml`): **Postgres + API + Nginx-served SPA**.
Nginx is the single public entrypoint and reverse-proxies `/api` to the API container, so cookies
stay first-party and there is no CORS to configure.

```bash
cp backend/.env.example backend/.env     # fill in JWT secrets + Cloudinary
docker compose -f docker-compose.prod.yml up -d --build
# First run only — seed demo data. The api container's workdir is /app/backend,
# so run the script directly (no --workspace flag):
docker compose -f docker-compose.prod.yml exec api npm run db:seed
# App on http://localhost  (set WEB_PORT to change, e.g. WEB_PORT=8080 docker compose ... up)
```
- `DATABASE_URL` is injected by compose to point at the `db` service (overrides `.env`).
- The API container runs `prisma migrate deploy` on boot, then starts.
- `frontend/nginx.conf` sets gzip, long-cache for hashed assets, no-cache for `sw.js`, and the
  security headers + CSP. TLS is terminated by your platform LB or an Nginx/Caddy in front —
  point it at the `web` container and keep `Strict-Transport-Security` on.

### CI/CD
`.github/workflows/ci.yml` runs on every push/PR: `npm ci` → Prisma generate → backend
typecheck + build → frontend build → Docker image builds for both services. Wire a deploy step
(registry push + `docker compose pull && up -d`, or your PaaS) after the `docker` job.

---

## Production checklist
- [ ] Strong, unique `JWT_*` secrets set (not the example values)
- [ ] Seed admin password changed / seed re-run with real credentials
- [ ] `DATABASE_URL` points at a managed Postgres with backups
- [ ] `CLOUDINARY_*` configured and a test upload succeeds
- [ ] `CORS_ORIGINS` lists only your real frontend origin(s)
- [ ] `PUBLIC_SITE_URL` = production frontend URL (QR codes encode it)
- [ ] HTTPS everywhere; `NODE_ENV=production`
- [ ] SPA fallback rewrite configured on the static host
- [ ] `prisma migrate deploy` run; schema in sync
- [ ] `/health` returns 200 behind the proxy
- [ ] Rate limiting verified (login throttles after repeated failures)
- [ ] `robots.txt` disallows `/admin`; `sitemap.xml` resolves
- [ ] Backups + log/monitoring in place

## Security posture (implemented)
Helmet headers + Nginx CSP/security headers · CORS allow-list · per-route + auth rate limiting ·
per-account brute-force lockout · Zod validation on every input · bcrypt(12) password hashing ·
JWT access + rotating hashed refresh tokens (httpOnly) · role/permission-based access control ·
Prisma parameterized queries
(SQL-injection safe) · Multer 2.x with type/size limits · malformed-JSON → 400 · activity/audit log.
Review before launch and add WAF/CDN protections as needed.

### Brute-force lockout (H3, implemented)
Beyond the IP rate limiter, each account locks after `LOGIN_MAX_ATTEMPTS` (default 5) consecutive
failed logins for `LOGIN_LOCK_MINUTES` (default 15) — persisted on `admins.failed_login_attempts` /
`admins.locked_until`, so it survives restarts and works across instances (unlike the in-memory
limiter). A locked account is rejected with `429` before the password is checked; a successful login
clears the counter. Pure decision logic lives in `auth/lockout.ts` (unit-tested). Refresh-token
**reuse detection** and opportunistic expiry pruning are also in `auth.service.ts`.

### Scaling note — IP rate limiting (follow-up)
The `express-rate-limit` store is in-memory and **per-instance**, resetting on restart. Fine on a
single Render instance. Before scaling horizontally, back it with Redis (`rate-limit-redis` + Render
Key Value / Upstash). The per-account lockout above already covers distributed credential-stuffing
against a single account regardless of instance count.

### Known advisory (accepted)
`npm audit` reports 2 **moderate** advisories from a transitive dependency (`exceljs` → `uuid`):
a missing buffer-bounds check that triggers **only when a `buf` argument is passed to `uuid`** —
which `exceljs` never does, so it is not reachable in this app. Import/export is additionally
admin-only and RBAC-gated. The high-severity `xlsx` package was replaced with the maintained
`exceljs` to eliminate its (unfixable-on-npm) prototype-pollution + ReDoS advisories. Re-audit on
each `exceljs` release and drop the note once upstream bumps `uuid`.
