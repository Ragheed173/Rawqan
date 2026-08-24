# POS Phase 1 — Safety Foundation

This phase intentionally adds no tables, orders, invoices, payments, refunds,
reservations, shifts, devices, synchronization operations, Dexie, POS UI,
reports, or printing implementation.

## Confirmed foundation configuration

- Restaurant timezone: `Asia/Hebron`
- Business-day cutoff: `04:00`
- Public/POS currency: `ILS` (`NIS`, displayed as `₪`)
- Offline capability target: 7 days (`POS_OFFLINE_CAPABILITY_TTL_DAYS`)
- Future device code: `P01`
- Future invoice format: `RWQ-P01-YYYY-######`

The offline TTL is configuration only. No offline capability is issued or
validated in this phase.

## Authorization changes

The following existing write routes now require explicit permissions:

| Route                                              | Permission    |
| -------------------------------------------------- | ------------- |
| `POST /api/admin/tags`                             | `menu:write`  |
| `PATCH /api/admin/tags/:id`                        | `menu:write`  |
| `DELETE /api/admin/tags/:id`                       | `menu:delete` |
| `POST /api/admin/uploads`                          | `menu:write`  |
| `POST /api/admin/uploads/items/:itemId/images`     | `menu:write`  |
| `PATCH /api/admin/uploads/images/:imageId/primary` | `menu:write`  |
| `DELETE /api/admin/uploads/images/:imageId`        | `menu:delete` |

`SUPER_ADMIN` behavior is unchanged because it owns the complete permission
catalogue. `MANAGER` and `STAFF` keep their previous permission sets. The new
`CASHIER` receives only the confirmed operational POS permissions.

## Admin deactivation migration

`POST /api/admin/admins/:id/deactivate` disables an account and revokes its
active refresh tokens. The first-party admin UI now uses this path.

The legacy `DELETE /api/admin/admins/:id` remains available in Phase 1 to avoid
silently changing existing API semantics. Once immutable financial foreign keys
exist, physical deletion must return `409` for referenced accounts; consumers
should migrate to deactivation before that release.

## Catalog revisions

`catalog_changes.revision` is the monotonic catalog version and future pull
cursor. Category and item create/update/deactivate/restore/delete/reorder paths
write a revision in the same transaction as the catalog mutation. Delete and
deactivate events are retained as tombstones.

Still requiring integration in a later catalog/sync phase:

- tag create/update/delete
- item image upload/delete/set-primary
- spreadsheet menu import

Backup restore emits one global `Catalog/RESTORED` revision. POS pull/bootstrap
endpoints are deliberately not implemented yet.

## Backup boundary

Backup format v2 is explicitly scoped to `MENU_SETTINGS_ONLY` and declares
`POS_FINANCIAL` excluded. Restore code contains an explicit allow-list of menu
and settings models and never performs broad database/schema discovery. Legacy
v1 menu/settings backups remain readable; unknown versions are rejected.

## Tests

Unit/no-database tests:

```bash
npm run test:unit --workspace backend
```

PostgreSQL integration tests use a dedicated database whose name must contain
`test`. The runner applies committed migrations and then exercises real Prisma
transactions, rollback and uniqueness behavior. It never resets or broadly
deletes the database.

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/rawaqan_test?schema=public'
npm run test:integration --workspace backend
```

Use `TEST_DIRECT_URL` as well when the runtime test URL is pooled (for example,
Neon). Future idempotency and financial rollback cases should be added to the
same serial integration suite.
