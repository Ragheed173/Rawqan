# PostgreSQL POS integration tests

The ordinary backend suite is fast and database-free. A separate CI job now
starts a disposable PostgreSQL 16 service and runs the real transactional POS
suite against it on every push and pull request.

Covered behavior includes opening and closing cashier shifts, table ownership,
order creation and edits, invoice finalization, cash/change calculations,
payments, refunds, split bills, offline-operation idempotency and conflicts,
immutable financial/audit rows, reservations, catalog revisions, and database
constraints/indexes.

The integration runner refuses any database whose name does not contain
`test`. It then destroys and recreates only the approved test database's
`public` schema before every run, so it must never receive a production URL.

## Migration ordering

The deployed migration directories use historical unpadded prefixes (`0` to
`11`). Renaming already-applied migrations would put production migration
history at risk, while lexical sorting places `10` and `11` before `2` on an
empty database. For this disposable CI database only, the runner applies the
unchanged migration SQL files by validated, unique numeric prefix. Production
continues to use `prisma migrate deploy` with its existing recorded history.

## Local execution

Point both variables at a disposable PostgreSQL database whose database name
contains `test`, then run:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/rawaqan_test'
$env:TEST_DIRECT_URL = $env:TEST_DATABASE_URL
npm run test:integration --workspace backend
Remove-Item Env:TEST_DATABASE_URL, Env:TEST_DIRECT_URL
```

The command resets that test database. A successful release candidate must pass
both the ordinary `test` job and the `PostgreSQL POS integration` CI job.
