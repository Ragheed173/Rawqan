# Rawaqan POS production rollout

Status: release-candidate procedure only. Nothing in this document records a
production deployment. Production migrations 3, 4, 5, and 6 remain pending.

## Pre-deploy gate

Do not start until every checkbox has an owner and timestamp.

- [ ] Take a production database snapshot and prove it can be restored.
- [ ] Record deployed frontend/backend commit identifiers and rollback artifacts.
- [ ] Confirm Prisma reports only migrations 3–6 pending.
- [ ] Confirm the backend release is compatible with the additive migrations.
- [ ] Generate one Ed25519 pair in an approved secrets environment. Store PKCS8
  private DER and SPKI public DER as base64; never put the private key in the
  frontend, repository, logs, or support tickets.
- [ ] Verify P01 uses a current Chromium browser, has adequate free disk,
  persistent site storage granted, automatic clock/time zone enabled, and no
  private/incognito mode.
- [ ] Validate the actual printer with all seven fixtures in
  docs/POS_RECEIPT_FIXTURES.html on both configured paper profiles.
- [ ] Keep POS unavailable to restaurant users until canary checks finish.

## Exact environment

Backend runtime:

| Variable | Requirement |
|---|---|
| NODE_ENV | production |
| PORT | Positive listening port; default 4000 |
| DATABASE_URL | Pooled PostgreSQL runtime URL |
| DIRECT_URL | Direct PostgreSQL URL used by Prisma migrations |
| JWT_ACCESS_SECRET | Required, unique random secret, at least 16 characters |
| JWT_REFRESH_SECRET | Required, different unique random secret, at least 16 characters |
| JWT_ACCESS_TTL | Recommended 15m |
| JWT_REFRESH_TTL | Recommended 7d |
| LOGIN_MAX_ATTEMPTS | Recommended 5 |
| LOGIN_LOCK_MINUTES | Recommended 15 |
| CORS_ORIGINS | Exact comma-separated HTTPS frontend origin(s) |
| PUBLIC_SITE_URL | Canonical HTTPS frontend origin |
| POS_OFFLINE_PRIVATE_KEY_BASE64 | Required for POS; Ed25519 PKCS8 DER, backend only |
| POS_OFFLINE_PUBLIC_KEY_BASE64 | Required for POS; matching Ed25519 SPKI DER |
| POS_OFFLINE_CAPABILITY_TTL_DAYS | 1–30; recommended 7 |
| CLOUDINARY_CLOUD_NAME | Required only when image upload is enabled |
| CLOUDINARY_API_KEY | Required only when image upload is enabled |
| CLOUDINARY_API_SECRET | Required only when image upload is enabled |
| CLOUDINARY_UPLOAD_FOLDER | Recommended rawaqan |
| SEED_ADMIN_EMAIL | First-run seed only; do not reuse placeholder |
| SEED_ADMIN_PASSWORD | First-run seed only; strong one-time value |
| SEED_ADMIN_NAME | First-run seed only |

Frontend build:

| Variable | Requirement |
|---|---|
| VITE_API_BASE_URL | Public HTTPS backend API base, ending in /api |
| VITE_SITE_URL | Canonical HTTPS frontend origin |

Verify the Ed25519 key pair in a disposable environment without logging decoded
keys. Signing-key rotation invalidates existing version-2 capabilities and
requires deliberate P01 re-pairing. Device deactivation while offline cannot be
learned until reconnect; the capability TTL is the maximum grace period.

## Deployment order

1. Put the database snapshot reference and application rollback identifiers in
   the change record.
2. Deploy the compatible backend while POS remains unavailable to users.
3. Check backend /health.
4. Using DIRECT_URL, apply migrations in order:
   3_pos_safety_foundation, 4_pos_database_foundation,
   5_pos_application_foundation, 6_safe_equal_bill_splitting.
5. Run Prisma migration status; stop on any failed or unexpected migration.
6. Recheck health, authentication, public menu reads, and POS bootstrap with a
   disposable account/device.
7. Deploy the frontend. Do not force a waiting service worker to activate on a
   browser with pending operations.
8. Create P01 and pair the designated restaurant browser.
9. Wait for bootstrap and the blue offline-ready indicator. Confirm catalog,
   tables, reservations, and current shift are locally visible.
10. Open a controlled shift and create one cash and one Visa invoice.
11. Print the normal, Arabic-modifier, equal-split, and reprint fixtures on the
    real printer; confirm cut, margins, legibility, totals, and RTL.
12. Disconnect both frontend/backend connectivity, close and reopen the POS
    browser, unlock with PIN, create a test invoice, and print it.
13. Reconnect. Require pending count 0; verify no duplicate invoice/payment and
    reconcile the report and drawer before allowing pilot sales.

## First P01 setup

1. In the main-admin user screen, set a unique 4–12 digit POS PIN. The backend
   retains bcrypt; the browser receives only a signed PBKDF2-SHA256 verifier
   using 600,000 iterations and a random 16-byte salt.
2. In /admin/pos/devices, create code P01 with a clear restaurant name and keep
   it active.
3. On the physical P01 browser, authenticate as the authorized user, enter the
   PIN, and select Pair this browser. Never transfer the browser profile.
4. Pairing automatically requests persistent storage. Open `/pos/diagnostics`,
   verify the explicit Granted / Not granted / Unsupported state, and use the
   retry action where supported. If it remains not granted, do not start the
   pilot until browser/OS policy is corrected; normal POS use is not blocked by
   the warning itself.
5. Open /pos and confirm P01, capability expiry, zero pending operations, full
   catalog/table cache, and offline-ready state.
6. Reload online, then disconnect, close/reopen, reload /pos, enter the PIN,
   and verify the same open shift/order/invoice state.
7. Reconnect and verify pending returns to zero.

## Manual pilot smoke

Use test products and reverse them under the authorized main admin before
accepting guests:

1. Open shift with counted opening cash.
2. Open a table; add a normal item, required variant, add-on, quantity change,
   and Arabic note.
3. Transfer it to a free table. Open a second order and merge it; confirm the
   survivor and both table assignments.
4. Request bill; exercise item split and equal split with three shares. Confirm
   sibling numbers and exact remainder allocation.
5. Pay one cash with tender/change, one Visa, and one Cash+Visa split.
6. Print initial and reprint receipts; confirm reprint marking.
7. As CASHIER, prove discount, void, refund, reports, audit, device/table config,
   and menu/price changes are rejected. As SUPER_ADMIN, test discount, unpaid
   void, partial refund, and full refund.
8. Create/edit/seat/cancel a reservation and prove an overlapping booking is
   rejected.
9. Disconnect network. Repeat order/modifier/note, bill, split, payment, print,
   and release. Reload and close/reopen; unlock with PIN and verify state.
10. Reconnect; require ordered sync completion and pending 0. Compare invoice
    count, cash, Visa, discounts, refunds, net sales, item/category/hour totals,
    and drawer expectation.
11. Close shift with actual cash and record the difference.

## 58 mm / 80 mm printer procedure

1. Open docs/POS_RECEIPT_FIXTURES.html in the P01 browser. Select 58 mm, then
   each of the seven fixtures.
2. Choose the real printer, matching 58 mm paper, 100% scale, minimum/zero
   margins supported by the driver, no headers/footers, portrait, and one copy.
3. Confirm no clipped Arabic glyphs, correct RTL, readable long names/modifiers,
   exact totals/change, equal-split label, reprint band, and no unintended blank
   pages. Confirm the 24-line fixture breaks/cuts acceptably.
4. Repeat all seven at 80 mm with the matching driver profile.
5. Power-cycle printer and P01, print normal and reprint again, and record
   browser, OS, printer model, driver/firmware, paper width, profile, date, and
   tester. Browser printing is the supported fallback; do not add ESC/POS until
   the model is known.

## Rollback

- Roll back only to builds that understand the additive schema already present.
- Do not edit financial rows, delete migration records, run migrate reset, or
  manually drop POS tables. Financial facts and snapshots are append-only.
- If migration fails before POS traffic, stop rollout, preserve logs, keep POS
  disabled, and restore the verified snapshot under the recovery procedure.
- If behavior fails after migrations succeed, leave the additive schema,
  roll back frontend/backend together, and keep POS disabled.
- Replace a broken service worker with a new versioned worker, activating it only
  when the device outbox is zero. Never clear site data with pending operations.
- On sync trouble, stop new writes on P01, keep browser/IndexedDB intact, record
  diagnostics, restore connectivity, and retry.

## Code-complete handoff

As of 2026-08-24, there are no known remaining code blockers. Automated totals
are 101 backend unit, 52 frontend, and 63 PostgreSQL integration tests. The only
remaining release gates are the physical printer matrix, real-P01 persistent
storage close/reopen/reconnect proof, and the production backup/migrations 3–6/
deployment/pairing/pilot sequence above.
