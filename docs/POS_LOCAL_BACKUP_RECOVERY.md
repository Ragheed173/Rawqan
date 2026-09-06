# POS local backup recovery

The Windows desktop POS writes one encrypted local snapshot per day to
`Documents\Rawaqan POS Backups`. Version 1.2.2 and later refuses to write a
plaintext fallback: if Windows secure storage is unavailable, the backup fails
and Diagnostics reports the condition.

## What the file protects

- The snapshot contains every IndexedDB table, including unsynchronized
  operations, device state, orders, invoices, payments, and print events.
- New files use the `RWQ-POS-BACKUP-2` envelope with Windows secure-storage
  encryption and a SHA-256 integrity check.
- Encrypted version 1 files remain readable. Plaintext version 1 files are
  deliberately rejected.
- Files are retained for up to 31 snapshot entries.

## Restore procedure

1. Sign in to the desktop POS with an account that has `backup:manage`.
2. Open **POS > Diagnostics**.
3. Confirm pending, failed, and conflict counters are all zero. The restore
   button stays disabled otherwise so unsynchronized financial work cannot be
   overwritten.
4. Select **Restore local backup** and choose a `.rwqbackup` file.
5. Review the snapshot time and confirm the warning.
6. The app first writes a separately named `pre-restore` snapshot, validates the
   selected file and exact table schema, then replaces all tables in one Dexie
   transaction. A validation or write failure leaves the current database
   unchanged.
7. After the automatic reload, verify the shift, latest invoice, and Diagnostics
   counters before resuming sales.

## Important recovery boundary

Windows secure storage normally ties decryption to the Windows user profile
that created the file. Restore on the same cashier computer and Windows account.
For machine-loss recovery, use the synchronized Render/Neon data and the proven
PostgreSQL backup procedure in `DATABASE_BACKUP_RECOVERY.md`; do not delete or
reset the old Windows profile until any unsynchronized local operations have
been recovered.
