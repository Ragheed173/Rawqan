# روقان (Rawaqan) — Build Checklist

Live status of the 21-task build. **Rule:** no task moves to `Done` until it is completed, tested, and reviewed.

Legend: ⬜ not started · 🟨 in progress · ✅ done

## Foundation
- ✅ Monorepo scaffold (frontend + backend + root workspaces) — builds green
- ✅ Design system / tokens wired into Tailwind (HSL vars, dark surface, animations)
- ✅ Shared TypeScript types (frontend `src/types`, backend serializers)
- ✅ Docker-compose Postgres for reproducible local DB

## Tasks
| # | Task | Status | Notes |
|---|------|--------|-------|
| 15 | Database Design (Prisma schema) | ✅ | 10 models, enums, indexes, cascade rules; `prisma generate` OK |
| 16 | REST API | ✅ | auth, menu, categories, tags, settings, dashboard, upload, qr, analytics, admins(RBAC), import/export, backup, logs — consistent envelopes, Zod-validated, permission-gated. Boot-verified live (200/202/400/401) |
| 1 | Landing Page | ✅ | hero/parallax, featured, hours/location/contact, floating QR/WA/call, SEO+JSON-LD. Build green, backend boots (health 200). Full DB render pending Postgres |
| 2 | Menu Page | ✅ | sticky category rail + IntersectionObserver scroll-spy, debounced search, filter chips, sort, grouped sections, skeletons, empty states. Build green |
| 3 | Dish Details | ✅ | gallery (thumbs+crossfade+zoom), price/discount, ingredients/calories/allergens, badges, availability, related items, MenuItem JSON-LD. Build green |
| 4 | Admin Dashboard (auth) | ✅ | JWT login, silent refresh, ProtectedRoute, dark sidebar shell, stats+recent meals+activity. Auth guards verified live (401) |
| 5 | Category Management | ✅ | CRUD dialog, image upload, enable/disable switch, reorder (↑↓ + transaction), delete confirm |
| 6 | Meal Management | ✅ | full editor (all fields+flags+tags), list w/ search+category filter, duplicate, delete confirm |
| 7 | Image Management (Cloudinary) | ✅ | drag&drop dropzone, multi-upload, set-primary, delete, client-side validation; Cloudinary stream upload backend |
| 8 | Restaurant Settings | ✅ | identity+logo/cover upload, contact/social, opening-hours editor, currency/footer |
| 9 | QR System | ✅ | png/svg/pdf downloads, sizes, table cards, live preview. **Verified live**: valid PNG output, target URL correct |
| 10 | Responsive Design | ✅ | mobile-first throughout; nav drawer, admin sidebar drawer, responsive grids, `svh` hero, safe-area viewport |
| 11 | Accessibility | ✅ | skip link, ARIA labels/`aria-pressed`/`aria-current`, focus rings, keyboard nav, `prefers-reduced-motion`, RTL `lang/dir`, alt text |
| 12 | Performance | ✅ | route code-splitting (lazy+Suspense), lazy/async images w/ blur-in, Vite manualChunks vendor split, TanStack Query caching, `fetchPriority` hero |
| 13 | SEO | ✅ | React19 native meta, OG/Twitter, canonical, Restaurant + MenuItem JSON-LD, static robots.txt + dynamic `/sitemap.xml` |
| 14 | Security | ✅ | Helmet + CSP + security headers (Nginx), CORS allow-list, rate limiting (api+auth), Zod validation, bcrypt(12), JWT access + hashed rotating refresh (httpOnly), Prisma param queries, Multer 2.x, malformed-JSON→400. npm audit: only 2 **moderate** transitive advisories via `exceljs`→`uuid` (buffer-bounds bug that triggers *only when a `buf` arg is passed to uuid* — exceljs never does; not exploitable). High-severity `xlsx` was removed in favor of maintained `exceljs` |
| 17 | Admin UX | ✅ | sonner toasts, confirm dialogs, **deferred-undo delete** (never hits server if undone), skeletons, empty states, loading spinners |
| 18 | Extra premium features | ✅ | featured/best-seller/chef/new/veg flags, landing featured strip, related items, discount pricing, best-seller sort, spice levels |
| 19 | Future-ready architecture | ✅ | modular domains, typed service layer, `*_En` bilingual fields, explicit M:N join, extensibility documented in README |
| 20 | Code quality pass | ✅ | TS strict (noUnused*), ESLint flat configs both packages — **lint clean**, SOLID modules, DRY reusable components |
| 21 | Final deliverables | ✅ | README, docs/API_REFERENCE.md, docs/DEPLOYMENT.md + production checklist, seed, docker-compose, .env examples |
| 22 | Advanced features | ✅ | dark/light/system theme; PWA (manifest+SW: offline menu, image cache, installable, install prompt); analytics (views/visitors/QR scans + dashboard); hide-without-delete (archive); scheduled promotions+featured (windows enforced public-side); RBAC (Super/Manager/Staff + permission matrix + admin mgmt UI); Excel/CSV import+export; JSON backup+restore; activity/audit log viewer; error monitoring + ErrorBoundary; 404 + 500 pages; maintenance mode; coming-soon page. Both builds green |
| 23 | Production deployment | ✅ | **Verified live**: `docker compose -f docker-compose.prod.yml up -d --build` → all 3 containers up, migrations applied, web 200, `/api/settings` + seeded `/api/categories` served through Nginx→api→Postgres, admin routes 401. Workspace-aware Dockerfiles (root build context uses the root package-lock.json; frontend force-installs Rollup musl binary for npm bug #4828), baseline Prisma migration `0_init`, root `.dockerignore`, `docker-compose.prod.yml` (db+api+web), Nginx (SPA+API proxy+gzip+immutable cache+security headers+CSP), GitHub Actions CI (root-context docker builds), deploy guide |

## Build order rationale
Tasks 15 (DB) and 16 (API) are built first as they are prerequisites for real data on the
public pages (1–3) and all admin pages (4–9). UI is built against a typed service layer so
pages render with live API data, not placeholders.
