# ─── Rawaqan API — multi-stage image (npm-workspaces aware) ──
# Build context is the REPO ROOT (see docker-compose.prod.yml / CI), because the
# single package-lock.json lives at the workspace root. `npm ci` needs the root
# lockfile plus every workspace's package.json to reproduce the tree.
FROM node:22-alpine AS base
# Prisma needs OpenSSL at build & runtime on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

# ── deps + build: install the whole workspace, then build the backend ──
FROM base AS build
# Manifests first for better layer caching (deps only re-install when they change).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci
# Backend source (incl. prisma schema) + generate client + compile TS.
COPY backend ./backend
RUN npm run db:generate --workspace backend \
 && npm run build --workspace backend

# ── runtime: carry over the fully-installed workspace + compiled output ──
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy the whole built tree so BOTH the hoisted root node_modules (with the
# generated Prisma client + prisma CLI) and any workspace-local node_modules
# come along — robust regardless of how npm chose to hoist.
COPY --from=build /app ./

WORKDIR /app/backend
EXPOSE 4000
USER node

# Apply migrations (prisma CLI resolves to the hoisted root node_modules), then boot.
# Retried with backoff: serverless Postgres (Neon) suspends idle compute and a
# cold connect can exceed Prisma's connect timeout (P1001) — the first failed
# attempt itself triggers the wake-up, so a retry ~10s later succeeds.
CMD ["sh", "-c", "\
  ok=0; \
  for i in 1 2 3 4 5; do \
    npx prisma migrate deploy && ok=1 && break; \
    echo \"migrate deploy failed (attempt $i/5) — waiting for database to wake…\"; \
    sleep 10; \
  done; \
  [ \"$ok\" = 1 ] || { echo 'migrations could not be applied — aborting boot'; exit 1; }; \
  node dist/server.js"]
