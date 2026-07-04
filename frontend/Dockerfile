# ─── Rawaqan web (SPA) — build then serve via Nginx ─────────
# Build context is the REPO ROOT (npm workspaces: the single package-lock.json
# lives there). `npm ci` reproduces the tree from the root lockfile + both
# workspace manifests, then we build only the frontend workspace.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
# `npm ci` honors the committed lockfile. npm bug #4828 means Rollup's platform
# optional binary isn't installed under workspaces even though it's in the lock,
# so we force-install the Alpine (musl) binary matching the resolved rollup
# version. `--no-save` leaves package.json / the host lockfile untouched.
RUN npm ci \
 && npm install --no-save "@rollup/rollup-linux-x64-musl@$(node -p "require('rollup/package.json').version")"
COPY frontend ./frontend
# API is reached through the Nginx reverse proxy at /api.
ENV VITE_API_BASE_URL=/api
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine AS runner
RUN rm /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/rawaqan.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
