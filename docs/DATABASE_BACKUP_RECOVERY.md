# Full database backup and recovery

The admin dashboard backup is intentionally limited to menu/settings data. It
does not contain authentication, audit, POS operational, or POS financial rows.
Use this procedure for production disaster recovery.

## Safety rules

- Run the backup after the shift is closed and POS diagnostics shows zero
  pending, failed, and conflicting operations.
- Never paste a database URL into chat, source control, screenshots, or command
  history. Set it as a temporary terminal environment variable.
- Store the `.dump` and matching `.manifest.json` together in encrypted storage.
- Never test a restore against production. The restore tool refuses database
  names that do not contain `test`, `restore`, `staging`, or `sandbox`, and also
  refuses the source database identity.
- A backup is not proven until its checksum, archive listing, restore, and
  critical financial table counts all pass.

## Create the full backup

From the repository root, set `BACKUP_DATABASE_URL` to Neon's direct (not
pooler) connection URL in the current terminal only, then run:

```powershell
$secret = Read-Host "Neon direct database URL" -AsSecureString
$env:BACKUP_DATABASE_URL = [Net.NetworkCredential]::new('', $secret).Password
npm run db:backup:full
Remove-Item Env:BACKUP_DATABASE_URL
$secret = $null
```

The command uses installed PostgreSQL 16 tools when available and otherwise
uses the pinned `postgres:16-alpine` Docker image. Output is written under the
ignored `backups/` directory by default. The manifest contains no password or
connection URL.

Copy both generated files to encrypted storage and record the date, filename,
SHA-256, operator, and current application commit in the operations log.

## Prove the restore

Create a disposable Neon database/branch with a name such as
`rawaqan_restore_test`. Set its direct URL and pass the dump path:

```powershell
$secret = Read-Host "Disposable restore-test database URL" -AsSecureString
$env:RESTORE_DATABASE_URL = [Net.NetworkCredential]::new('', $secret).Password
npm run db:restore:verify -- .\backups\rawaqan-full-YYYY-MM-DDTHH-MM-SS.dump
Remove-Item Env:RESTORE_DATABASE_URL
$secret = $null
```

The verifier checks the file checksum, restores with `--exit-on-error`, then
compares migration, order, invoice, payment, cashier-shift, and sync-operation
counts with the backup manifest. Delete the disposable restore database only
after recording a successful result.

## Schedule

- Nightly: one full database backup after closing shift.
- Before every migration/deployment: one additional full backup.
- Retention: 7 daily, 4 weekly, and 12 monthly encrypted copies.
- Monthly: restore the newest backup to a disposable database and record proof.
- Keep at least one encrypted copy outside Neon/Render to avoid a single-vendor
  failure.

## Tool qualification record

On 2026-08-29 the backup and restore tools were exercised against two disposable
PostgreSQL 16 databases in Docker. The source contained one representative
order, paid invoice, cash payment, open cashier shift, and completed sync
operation. Archive listing and SHA-256 validation passed, the complete archive
restored successfully, and all six critical-table counts matched.

The exercise also found that a brand-new empty database cannot currently run
`prisma migrate deploy` directly because migration directory names `10_*` and
`11_*` sort before `2_*`. Existing production was not affected because `0–9`
were already applied, and a full dump restore does not replay migrations. Fix
and continuously test fresh-database migration ordering before treating a
migration-only rebuild as a recovery path.
