# POS Phase 2.5 — PostgreSQL Verification

Verified on 2026-08-23. This verification is database-only: it adds no POS API,
command handler, frontend, Dexie, synchronization endpoint, report, or printing
implementation.

## Isolated test target

- PostgreSQL: `16.14` (`postgres:16-alpine`)
- Target type: disposable local Docker PostgreSQL bound to
  `127.0.0.1:55432`
- Fresh-install database: `rawaqan_phase25_test`, schema `public`
- Upgrade-path database: `rawaqan_phase25_upgrade_test`, schema `public`
- Configuration source: `TEST_DATABASE_URL` and optional `TEST_DIRECT_URL`
- Credentials are intentionally omitted from this record.

The integration runner refuses to run without `TEST_DATABASE_URL`, rejects
non-PostgreSQL URLs, and rejects targets whose database name does not contain
`test`. It maps the validated test URLs to Prisma's runtime `DATABASE_URL` and
`DIRECT_URL` only inside the child processes. No configured application or
production database was used.

## Fresh-install path

An empty `public` schema received all five repository migrations through
`prisma migrate deploy`, the production deployment path:

1. `0_init`
2. `1_media_public_ids`
3. `2_login_lockout`
4. `3_pos_safety_foundation`
5. `4_pos_database_foundation`

Migration 4 applied successfully. Follow-up results were:

- `prisma migrate status`: database schema is up to date; five migrations found
- `prisma validate`: schema valid
- `prisma generate`: Prisma Client `6.19.3` generated successfully

## Existing-database upgrade path

A second empty test database first received migrations 0–2. Representative
legacy rows were then inserted for `Admin`, `RestaurantSettings`,
`OpeningHour`, `Category`, `MenuItem`, `ItemImage`, `Tag`, `ItemTag`, and
`ActivityLog`. Migration 3 was applied, verified, and followed by migration 4.

Observed after migration 4:

- All representative row counts and values remained intact.
- Every seeded legacy CUID was byte-for-byte unchanged.
- Menu/category, image/menu, tag/menu, opening-hour/settings, and activity/admin
  relationships remained intact.
- Phase 1 settings remained `currency = ILS`, `posCurrency = ILS`,
  `businessTimezone = Asia/Hebron`, and `businessDayCutoff = 04:00` after
  migration 4. The pre-Phase-1 EGP value therefore followed the already
  designed EGP-to-ILS transition and was not reversed or damaged by Phase 2.

## Real PostgreSQL test results

The integration suite executed 41 tests against PostgreSQL and passed all 41:

- 38 Phase 2.5 constraint, trigger, delete-policy, compatibility, and index
  checks
- 3 existing PostgreSQL transaction/idempotency-foundation checks

There were no failed constraint or trigger tests. Expected PostgreSQL
rejections were observed for invalid rows and forbidden mutations, including:

- unique table codes and active table assignments
- order version, quantity, release, close/merge, and physical-delete rules
- one open shift per cashier/device, valid close state, and non-negative cash
- invoice arithmetic and refund bounds
- cash/VISA tender rules while allowing multiple payments per invoice
- positive refund values and unique refund line/payment allocations
- reservation time ranges
- sync operation identity, sequence, and processing-state consistency
- physical deletion of orders, invoices, payments, and cashier shifts
- update/delete of all append-only financial snapshots and audit facts

The suite deliberately does not enforce cross-row payment or refund allocation
totals in the database; those remain Phase 3 transactional domain rules.

## Immutability and delete policies

The database rejected updates and deletes for invoice order/table snapshots,
invoice lines and modifiers, order/invoice discounts, invoice voids, refunds and
their allocations, and receipt-print events. Aggregate state transitions that
are intentionally mutable remained possible, while physical deletion of the
protected aggregate roots was rejected.

Observed compatibility behavior:

- Deleting an allowed legacy `Admin` set nullable foreign keys to null while
  actor/cashier snapshots remained unchanged. Admin deactivation preserved both
  the reference and snapshot.
- Deleting a referenced legacy `MenuItem` or `ModifierOption` set its nullable
  historical reference to null while the immutable item/option snapshot stayed
  unchanged.
- `RESTRICT` prevented representative deletion of referenced devices, tables,
  reservations, orders, invoices, payments, refunds, and cashier shifts.
- `CASCADE` was observed only on the intentional non-financial
  `MenuItemModifierGroup` catalog join; its modifier group remained intact.

## BigInt JSON readiness

Passing a Prisma object containing `BigInt` directly to `JSON.stringify` or
Express `res.json` throws `TypeError: Do not know how to serialize a BigInt`.
`backend/src/utils/json.ts` now provides `bigintJsonReplacer` and `toJsonSafe`.
They serialize every monetary `BigInt` as an exact base-10 string, including
values outside JavaScript's safe-integer range, while retaining existing Date
and Prisma `Decimal` JSON behavior. Unit tests cover these cases.

No global response helper was changed, so existing response shapes are
untouched. Phase 3 POS response paths must pass Prisma results through
`toJsonSafe` (or a POS-specific wrapper built on it) before `res.json`.

## Index sanity

PostgreSQL `pg_indexes` confirmed the expected indexes for active table
assignments, open/current orders, invoice business-date/status lookups, payments
by invoice, reservation status/time lookups, open cashier shifts, and sync
device/sequence/status lookups.

No index had a clear enough redundancy case to remove. The most similar pairs
were reviewed and retained:

- Active-assignment and open-shift partial unique indexes enforce current-state
  invariants; their broader composite indexes serve history lookups.
- `sync_operations_device_id_local_sequence_key` supports idempotent identity,
  while `sync_operations_device_id_status_local_sequence_idx` supports queued
  work by device and status.
- `reservations_starts_at_idx` supports time-range scans; the status-leading
  composite supports status-filtered work queues.
- Payment/invoice and business-date indexes support parent lookups and
  date-oriented reporting respectively.

These indexes may become candidates for production usage-statistics review, but
none is presently identified as erroneous or safely removable.

## Migration 4 rollback policy

Migration 4 has no destructive down migration.

1. Create and verify a database snapshot or Neon branch immediately before the
   production migration.
2. Because migration 4 is additive, the pre-Phase-3 application can be rolled
   back while leaving the new unused tables/types in place.
3. Before any real POS data exists, restoring the pre-migration snapshot is an
   available coordinated rollback if the schema itself must be removed.
4. Once real POS financial or audit data exists, do not drop the schema or run
   an improvised down migration. Prefer application rollback plus a fix-forward
   migration. Snapshot restoration is then a business-approved data-loss event
   requiring reconciliation, not a routine deployment rollback.

## Changes required by verification

No change to migration 4 SQL or the Prisma schema was required. Verification
added the PostgreSQL constraint suite, the BigInt serialization helper and unit
tests, and a cross-platform integration runner. The runner invokes local CLI
entry points without a shell and retains the Phase 1 test-database protections.

## Remaining Phase 2 risks

- Verification used stock PostgreSQL 16.14 locally, not the production provider,
  its pooling layer, or its branch/snapshot implementation.
- Production migration duration and lock behavior must still be observed during
  a controlled deployment, even though migration 4 is additive.
- Phase 3 must consistently apply the BigInt response strategy.
- Cross-row allocation, invoice-number issuance, concurrency, and other command
  invariants intentionally remain Phase 3 transactional logic.
- Index usefulness should be reassessed from production query and index-usage
  statistics after representative POS traffic exists.
- Prisma reports the existing `package.json#prisma` seed configuration as
  deprecated for Prisma 7; this does not affect Prisma 6.19.3 verification but
  should be handled during a future Prisma upgrade.

