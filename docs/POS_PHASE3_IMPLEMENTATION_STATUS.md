# POS Phase 3 — implementation and RC status

Status date: 2026-08-24. Phase 3 plus additive Migration 6 is implemented and
validated in disposable environments. Nothing has been deployed; production
migrations 3–6 remain unapplied.

## Implemented

- Exact integer-minor-unit pricing, payments, change, refunds, shifts, business
  dates, item splits, and deterministic rational equal splits.
- Transactional table/order/item, transfer, merge, bill, invoice, payment,
  discount, void, refund, shift, reservation, and print-audit commands.
- Device/year invoice numbering, ordered idempotent sync, dependency checks,
  request hashes, result replay, cross-tab locking, and restart recovery.
- Dexie v2 local writes plus outbox, offline browser PBKDF2 unlock, capability
  v2 Ed25519 signatures, storage diagnostics, browser receipts, and lazy routes.
- Full catalog/config/table/reservation/shift pull convergence and atomic
  catalog revisions for tags, item-tag changes, image upload/update/reorder/
  delete, spreadsheet import, modifiers/assignments, category reorder, and
  backup restore.
- Shared sales/item/category/hour reports with Asia/Hebron and 04:00 cutoff.
- Operational POS/admin polish: clear transfer/merge/split/payment states,
  complete reservation lifecycle, practical invoice filters/detail, report
  exports, searchable audit, persistence/health diagnostics, and safe retries.
- Hardened browser receipts for 58 mm and 80 mm with RTL/LTR fallback, long
  names/receipts, modifiers, split labels, discount/payment/change, and reprint.

## Equal-split foundation

Migration 6 adds nullable split metadata and immutable allocation line/modifier
snapshots. Rational quantities preserve cases such as quantity two across three
bills as 2/3 on each sibling. Money uses deterministic remainder-first
allocation: 10000 / 3 becomes 3334, 3333, 3333. Reports sum rational quantities
and allocated revenue exactly once. Existing whole invoice-line quantities stay
positive integers. Equal-split refunds are invoice-level monetary refunds in
this version; item-level rational refunds fail closed.

## Final validation

- Backend unit: 17 files, 101 tests passed.
- Frontend: 14 files, 52 tests passed.
- PostgreSQL 16 integration: 4 files, 63 tests passed after migrations 0–6.
- Backend/frontend lint, typecheck, and production builds passed.
- Prisma format, validate, and generate passed.
- Real browser cold offline reload, PIN unlock, local state recovery, offline
  financial workflow, reconnect, and zero-pending convergence passed.
- Frontend production build contains no bcryptjs/Node-crypto warning or bundle.
- Fresh and production-like upgrade migration rehearsals passed.

## Release status

Verdict is **CODE COMPLETE; PHYSICAL/ENVIRONMENT GATES REMAIN**. No known code
blocker remains. The actual restaurant P01 must grant/check persistent storage,
and the physical printer must pass the documented 58 mm/80 mm Arabic fixture
matrix. Production backup, migrations 3–6, deployment, pairing, and pilot are
also unapplied. See POS_RC_RELEASE_REPORT.md and POS_PRODUCTION_ROLLOUT.md. Do
not deploy from this status document.
