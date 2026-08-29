# Read-only production load gate

The load gate exercises only safe `GET` endpoints. Its default mix covers API
readiness, categories, and the full public catalog. It never logs in, opens a
shift, creates orders, records analytics, or mutates production data.

Default launch gate:

- 120 measured requests after warm-up
- 4 concurrent workers (the verified temporary limit on free Render)
- routes: `/ready`, `/api/categories`, `/api/items`
- allowed error rate: at most 1%
- allowed p95 latency after warm-up: at most 2500 ms
- per-request timeout: 75 seconds to tolerate the accepted free-Render wake-up

Run against production from the repository root:

```powershell
$env:LOAD_TEST_BASE_URL = 'https://rawaqan-api.onrender.com'
npm run test:load:readonly
Remove-Item Env:LOAD_TEST_BASE_URL
```

Increase concurrency gradually and stop immediately if error rate rises, p95
exceeds the threshold, or the POS reports connectivity trouble. Do not load-test
authenticated or state-changing POS routes against production. Re-run this gate
after infrastructure, database, query, or catalog-size changes and record the
result in the release report.

## Production baseline — 2026-08-29

After warming the service, 120 mixed requests at concurrency 4 completed with
zero failures: 4.90 requests/second, p50 798 ms, p95 1304 ms, p99 1806 ms, and
maximum 1909 ms. The 2500 ms launch gate passed.

At concurrency 6, all 120 requests still returned `200`, but p95 reached 2510
ms and narrowly failed the latency gate. Until Render is upgraded and the test
is repeated, treat 4 simultaneous full read requests as the verified operating
envelope. This is sufficient for the current single cashier device; it is not a
claim that the free instance is ready for multiple busy branches.
