# Rawaqan POS release-candidate report

Report date: 2026-08-24  
Scope: QA and hardening only; no production deploy, migration, device pairing,
credential rotation, Render change, Vercel change, or Neon change was performed.

## 1. Verdict

**CODE COMPLETE — PHYSICAL/ENVIRONMENT GATES REMAIN**

The code-level financial, migration, browser crypto, synchronization, catalog,
receipt-rendering, administration, diagnostics, and cold-offline gates pass.
There are no known remaining code blockers. Restaurant pilot authorization
remains blocked on physical/environment checks that cannot be simulated:

- **RELEASE BLOCKER — printer:** the real printer model, driver, 58 mm/80 mm
  profiles, Arabic output, cutting, and physical reprint have not been tested.
- **RELEASE BLOCKER — storage policy:** the automated Chromium profile reported
  that persistent storage was not granted. The real P01 must grant/pin storage
  and pass the documented close/reopen test before accepting transactions.
- **RELEASE BLOCKER — deployment:** production backup, migrations 3–6, backend
  and frontend release, P01 pairing, and the controlled restaurant pilot have
  not been performed and were explicitly outside this pass.

No code defect currently requires a schema redesign or destructive migration.

## 2. Findings by severity

### Release blockers fixed

- Browser bcrypt was replaced by a browser-native PBKDF2-SHA256 verifier signed
  inside capability v2. Backend PIN storage remains bcrypt.
- Cold offline navigation originally returned HTML but missed hashed modules
  because Vite asset responses varied by request headers. Service-worker v5 now
  installs only after an atomic POS precache, records a readiness sentinel,
  waits for cache writes, and ignores Vary only for immutable hashed assets.
- Equal split uses Migration 6 rational allocation facts and deterministic
  integer-minor-unit remainders; reports do not double count.
- CASHIER could replay privileged discount/void/refund operation types through
  sync. Push now applies per-operation authorization and validates device
  identity; authorization tests cover the bypass.

### High issues fixed

- Normal receipts previously lacked immutable invoice lines. Initial/reprint,
  modifiers, tender/change, split metadata, Arabic RTL, 58 mm, and 80 mm are
  rendered from local invoice snapshots.
- Interrupted browser sync now requeues SYNCING rows under a cross-tab lock.
- Pull/bootstrap now converge full catalog, tables, reservations, current shift,
  timezone, cutoff, and receipt configuration transactionally where required.
- Boolean IndexedDB index lookups hid menu items in a real browser; catalog
  reads now filter the collection safely.
- Local merge now points every source table at the surviving order.
- POS connectivity is based on backend health events as well as browser network
  state, so an interface that remains technically online does not imply the API
  is reachable.
- Tag, item-image, spreadsheet-import, and restore paths now emit catalog
  changes atomically with their data writes.

### Medium / low / cosmetic

- **MEDIUM, deferred:** npm audit reports three high findings in Prisma CLI
  tooling through deepmerge-ts and two moderate findings in ExcelJS/uuid. The
  standard non-breaking audit fix was applied. Remaining suggested changes
  require a Prisma-major migration or ExcelJS downgrade and were not forced in
  this RC.
- **MEDIUM, documented:** deactivation and signing-key rotation cannot be
  learned during a network outage. Device rejection occurs at reconnect; the
  offline capability TTL bounds the grace period.
- **LOW, deferred:** Prisma package.json configuration is deprecated for Prisma
  7; Prisma 6.19.3 emits a warning but validates and migrates correctly.
- Admin POS now has usable table/device management, filtered reports and
  exports, invoice lookup/detail, reservation overview, audit search, and
  permission-gated valid refund/void controls.

## 3. Real-browser offline evidence

Executed in the in-app Chromium browser against a disposable PostgreSQL 16
database using fake account/device data only.

- Online authentication, P01 recognition, capability v2 issuance, catalog,
  table and open-shift bootstrap passed.
- Offline commands exercised: open table/order, normal item, required variant,
  Arabic add-on, quantity, bill request, item split, three-way equal split
  (4667/4667/4666), cash tender/change, Visa, invoices, receipt print action,
  and table release.
- Browser reload required PIN again and restored local shift/order/invoice
  state. PIN 2468 was accepted with Web Crypto while both app origins were down.
- Final cold-start gate stopped both frontend and backend. /pos loaded from the
  service worker, progressed through local storage verification to the offline
  unlock screen, then restored the table dashboard.
- Reconnect processed the durable outbox from 13 pending operations to zero.
  Database evidence showed 14 SUCCEEDED operations total, two orders, five
  distinct invoice numbers, two split groups, and two payments totaling 22000
  minor units; the paid table was AVAILABLE.
- Transfer, merge, reservation lifecycle, shift close, discounts, voids, and
  refunds additionally pass command-level PostgreSQL tests. Browser close/reopen
  semantics are equivalent to the proven full reload because unlock state is
  memory-only; this must still be repeated on physical P01.

No claim is made that a physical receipt printed.

## 4. Browser crypto and offline authentication

- Frontend bcryptjs dependency and bundle path: removed.
- Capability: Ed25519, strict EdDSA header/segments, device/user/expiry payload.
- PIN verifier: PBKDF2-SHA256, 600,000 iterations, 16-byte random salt, 32-byte
  result, constant-time byte comparison.
- Brute force: five failures persist a 15-minute local lock.
- Plaintext/reversible PIN: none stored.
- Session: unlock state is memory-only; reload/reopen rechecks capability expiry
  and requires PIN.
- Legacy capability v1: fails closed and instructs re-pair.
- Production bundle scan found no bcryptjs, Node crypto, private signing key
  name, JWT refresh secret, or RC browser secret.

## 5. Service worker / IndexedDB / recovery

- Versioned shell, asset, image, and anonymous-public-API caches are separated.
- Financial, POS, auth, and admin API responses are never cached.
- Financial POST/PATCH writes stay in Dexie plus outbox, never Cache Storage.
- A new worker waits; activation is blocked while operations are pending.
- Complete POS shell/chunks are precached before worker installation succeeds.
- Dexie v1 to v2 preservation, exact string BigInts/rationals, outbox durability,
  transaction rollback, unavailable storage, blocked upgrade, quota failure,
  and eviction risk have dedicated handling or diagnostics.
- Never clear site data during recovery. Keep P01 open, stop new writes, record
  diagnostics, reconnect, and retry.

## 6. Sync and financial integrity

Passing coverage includes same operation ID/same hash, different hash conflict,
duplicate retries, lost-response retry, dependency ordering/missing dependency,
failed/restarted SYNCING recovery, duplicate invoice/payment/refund/split IDs,
unique local sequence, transaction rollback, and append-only financial facts.
Server PROCESSING state is written inside the command transaction, so a crash
cannot commit an indefinitely PROCESSING row without its transaction outcome.

## 7. Reports and business time

PostgreSQL and domain tests verify gross/discount/refund/net totals, Cash, Visa,
invoice count/average, void facts, item quantity/revenue, category revenue,
hourly grouping, peak hour, and equal-split rational aggregation exactly once.
Asia/Hebron and the 04:00 cutoff are used in frontend and backend. Winter,
summer, and DST fallback hours are tested. No report labels net sales as profit.

## 8. Catalog revision completeness

- Category/item existing paths: covered.
- Tags: create/update/delete emit events atomically.
- Item images: bulk upload, metadata update, reorder, delete, and primary
  promotion emit one atomic change per logical mutation.
- Spreadsheet import: category/item writes and events share transactions.
- Backup/restore: version 2 includes modifiers/assignments and emits a global
  RESTORED event; version 1 remains accepted additively.
- Variants/add-ons now have permission-protected ModifierGroup and
  ModifierOption CRUD/deactivation plus MenuItemModifierGroup assignment
  replacement. Each logical mutation emits one atomic revision; deactivation
  retains tombstones. Item-tag replacement includes the resulting tag IDs in
  the atomic MenuItem change.
- Pull uses a transactional full current snapshot, so devices learn new,
  changed, unavailable, deactivated items and all variant/add-on state.

## 9. Permission and security audit

CASHIER is restricted to operational POS. Backend and sync replay tests prove it
cannot discount, void, refund, read financial reports/audit, manage devices or
tables, or change menu/prices. SUPER_ADMIN retains the privileged operations.
Routes rely on backend RBAC, not hidden buttons.

Ed25519 private material remains backend-only. Capability parsing/signature and
expiry are strict. Login and pairing/PIN endpoints are rate limited, refresh
tokens are hashed, cookies use production security settings, CORS is allowlist
based, Helmet/CSP remains enabled, and sensitive values are not logged. The
repository secret scan found only documented placeholder PostgreSQL URLs.

## 10. API, performance, and accessibility

- POS BigInts and rational numerator/denominator values serialize as decimal
  strings; frontend code keeps exact integer arithmetic.
- Stable POS error codes/envelopes cover conflicts, versions, authorization,
  shifts, storage, auth, and financial validation.
- /pos and admin POS pages are lazy. Dexie is isolated to POS chunks; bcrypt is
  absent; no chart dependency enters the cashier path.
- Production build transforms 2240 modules. Largest emitted chunks are React
  vendor 232.38 kB (74.32 kB gzip), motion vendor 114.22 kB (37.74 kB gzip),
  Dexie/schema 98.49 kB (33.12 kB gzip), and query vendor 85.82 kB
  (29.25 kB gzip).
- Critical controls have labels, visible focus, non-color text status, RTL,
  dialog focus management, and approximately 44–48 px touch targets. Physical
  tablet accessibility remains part of the P01 canary.

## 11. Validation totals

| Check | Result |
|---|---|
| Backend unit | 17 files, 101 tests passed |
| Frontend | 14 files, 52 tests passed |
| PostgreSQL 16 integration | 4 files, 63 tests passed |
| Backend lint / typecheck / build | Passed |
| Frontend lint / typecheck / production build | Passed |
| Prisma format / validate / generate | Passed; deprecation warning only |
| Git diff check | Passed; line-ending warnings only |
| Format scripts | Not present in either workspace; Prisma formatter ran |
| npm audit | 0 critical; 3 high in Prisma CLI/config (`deepmerge-ts`); 2 moderate in ExcelJS transitive `uuid` |
| Bundle critical scan | No bcrypt/Node crypto/private-key/JWT-secret match |
| Secret scan | Placeholder/example database URLs only |

## 12. Disposable PostgreSQL and migration rehearsal

Fresh install applied all seven migrations. Recorded migration durations:

| Migration | Time |
|---|---:|
| 0_init | 412 ms |
| 1_media_public_ids | 15 ms |
| 2_login_lockout | 13 ms |
| 3_pos_safety_foundation | 67 ms |
| 4_pos_database_foundation | 1,137 ms |
| 5_pos_application_foundation | 16 ms |
| 6_safe_equal_bill_splitting | 124 ms |

Upgrade simulation applied 0–2, seeded representative admin, category, menu
item, image, tag/join, settings, opening hours, and audit data with fixed IDs,
then deployed 3–6 in 6.584 seconds total. All nine representative legacy
entities remained present, IDs and two failed-login attempts were preserved,
legacy ILS settings mapped to POS currency, and Asia/Hebron/04:00 defaults were
valid. No migration failed. Only the Prisma 7 configuration deprecation warning
was emitted. Disposable containers were removed after verification.

## 13. Production facts and remaining procedure

- Exact pending production migrations:
  3_pos_safety_foundation,
  4_pos_database_foundation,
  5_pos_application_foundation,
  6_safe_equal_bill_splitting.
- Exact environment, first-P01 procedure, 58/80 mm printer checks, manual pilot,
  deployment order, and rollback rules are in POS_PRODUCTION_ROLLOUT.md.
- Seven printable fixtures are in POS_RECEIPT_FIXTURES.html.
- Production remains untouched.

## 14. Intentionally deferred

- Actual printer/driver/firmware and drawer integration until hardware is known.
- Vendor-specific ESC/POS.
- Real P01 persistent-storage policy and physical close/reopen proof.
- Privileged discount/void/refund while fully offline: current CASHIER workflow
  correctly denies them; authorized online SUPER_ADMIN paths are supported.
- Prisma 7 migration and ExcelJS dependency replacement/downgrade.
- New product scope outside the approved POS release candidate.

## 15. Final release boundary

### CODE COMPLETE

- Catalog mutations, operator/admin UX, receipt renderer, persistence request
  and status, diagnostics, safe service-worker update, sync conflict retention,
  Web Crypto PIN, RBAC presentation, Arabic operational errors, and rapid-click
  guards are implemented and validated.
- Exact remaining code blockers: **none known**.

### PHYSICAL RELEASE GATES

1. Printer gate: identify the real thermal printer and validate 58/80 mm,
   Arabic/RTL, alignment, long and offline receipts, and reprints.
2. P01 storage gate: verify persistence is granted/checked on the real cashier
   device; close/reopen offline, restore state, reconnect, and reach zero pending.
3. Deployment gate: take the production backup, apply migrations 3–6, deploy
   compatible backend/frontend, pair P01, and complete the controlled pilot.

The code is ready for the restaurant pilot once these physical/environmental
gates pass. Production deployment is not authorized by this report.
