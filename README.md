# روقان — Rawaqan · Premium QR Digital Menu

A production-grade QR digital menu and admin dashboard for the **روقان (Rawaqan)** restaurant.
Luxury, minimal, fully responsive, bilingual (Arabic-first RTL + English), built as a scalable monorepo.

- **Public storefront** — landing page, browsable menu, dish details
- **Admin dashboard** — auth, category & meal management, image uploads, settings, QR generator
- **QR system** — printable table cards (PNG / SVG / PDF)

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, shadcn-style UI, Framer Motion, TanStack Query, React Hook Form + Zod, React Router, Zustand, Axios |
| Backend | Node.js, Express, TypeScript (ESM), JWT auth, Multer, Cloudinary, Helmet, rate-limiter, compression, Morgan, CORS |
| Database | PostgreSQL + Prisma ORM |
| QR / Docs | `qrcode`, `pdfkit` |

---

## Monorepo layout

```
Rawaqan/
├── frontend/            # React 19 SPA (public storefront + admin dashboard)
│   ├── src/
│   │   ├── components/  # ui/ (primitives), layout/, menu/, landing/, admin/, shared/
│   │   ├── pages/       # public pages + admin/ pages
│   │   ├── layouts/     # SiteLayout, AdminLayout
│   │   ├── hooks/       # data + admin query hooks
│   │   ├── services/    # typed API clients (public + admin/)
│   │   ├── store/       # zustand auth store
│   │   ├── lib/         # apiClient, utils, contact
│   │   ├── types/       # shared domain types
│   │   └── config/      # env
│   └── public/          # favicon, robots.txt
├── backend/             # Express API
│   ├── prisma/          # schema.prisma + seed.ts
│   └── src/
│       ├── config/      # validated env
│       ├── lib/         # prisma, cloudinary, tokens, password, activityLog
│       ├── middleware/  # auth, validate, error, rateLimit, notFound
│       ├── modules/     # auth, menu, settings, dashboard, upload, qr, seo
│       ├── utils/       # ApiError, asyncHandler, http, slug, serializers
│       ├── app.ts       # express app factory
│       └── server.ts    # bootstrap
├── docker-compose.yml   # local PostgreSQL
├── PROJECT_CHECKLIST.md # live build status (21 tasks)
└── docs/                # API_REFERENCE.md, DEPLOYMENT.md
```

---

## Quick start

### 1. Prerequisites
- Node.js ≥ 20
- Docker (for local PostgreSQL) — or any PostgreSQL 14+

### 2. Install
```bash
npm install          # installs both workspaces
```

### 3. Database
```bash
docker compose up -d                 # starts PostgreSQL on :5432
cp backend/.env.example backend/.env # then edit secrets
npm run db:migrate                   # applies schema
npm run db:seed                      # seeds admin + demo menu
```

### 4. Frontend env
```bash
cp frontend/.env.example frontend/.env
```

### 5. Run (both apps together)
```bash
npm run dev
# web → http://localhost:5173
# api → http://localhost:4000
```

Default seeded admin: **admin@rawaqan.local** / **Admin@12345** (change via `backend/.env`).
Admin dashboard: <http://localhost:5173/admin/login>

---

## Environment variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

Key backend vars: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`CLOUDINARY_*` (image uploads — optional in dev), `PUBLIC_SITE_URL` (QR target), `CORS_ORIGINS`.

> Image uploads require Cloudinary credentials. Without them the API still runs; upload
> endpoints return a clear 500 telling you to configure `CLOUDINARY_*`.

---

## Scripts (root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Run API + web concurrently |
| `npm run build` | Build backend then frontend |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | Lint both workspaces |

---

## Documentation
- **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)** — every endpoint, auth, payloads
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — production deployment + checklist
- **[PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md)** — build status of all 21 tasks

---

## Architecture notes (future-ready)

The domain is modelled so these can be added without schema rewrites: online ordering & cart
(add `orders`/`order_items`), reservations, loyalty/coupons, multi-branch (add `branch_id` FK),
multi-language (fields already carry `*_En` variants; extendable to a translations table).
The frontend service layer + typed query hooks isolate the UI from transport, so new resources
drop in cleanly.

## License
Proprietary — built for روقان.
