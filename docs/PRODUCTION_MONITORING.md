# Production health monitoring

Rawaqan exposes two intentionally different unauthenticated endpoints. Neither
returns secrets, database hosts, credentials, or raw errors.

- `GET /health` is a process liveness check. It returns `200` while the Node API
  can answer HTTP requests.
- `GET /ready` is the production readiness check. It returns `200` only after a
  bounded `SELECT 1` succeeds against PostgreSQL, and returns `503` otherwise.

## Render

After the deployment containing this endpoint is live, open the Rawaqan API
service in Render, then set **Settings → Health Check Path** to `/ready`. Keep
the API's public URL as `https://rawaqan-api.onrender.com`.

The current free Render instance can take 50 seconds or more to wake. This is an
accepted temporary launch risk; configure any external monitor with a timeout
of at least 70 seconds and require two consecutive failures before alerting.

## External monitor

The repository includes `.github/workflows/production-readiness.yml`. GitHub
Actions calls `/ready` twice per hour, permits the accepted free-Render wake-up
delay, retries transient network failures, and fails the workflow unless both
the API and PostgreSQL report ready. The 30-minute interval detects outages
without continuously keeping the free instance awake.

In the GitHub account that owns the scheduled workflow, enable Actions email
notifications and choose failed workflows only. Scheduled-workflow alerts go
to the user associated with the schedule. Run the workflow manually once from
**Actions → Production readiness → Run workflow** and confirm the green result.

For faster phone/SMS escalation, optionally create an HTTPS monitor in
UptimeRobot, Better Stack, or an equivalent service:

- URL: `https://rawaqan-api.onrender.com/ready`
- Method: `GET`
- Expected status: `200`
- Interval: 30 minutes while using free Render; reduce it after upgrading
- Request timeout: at least 70 seconds while Render remains on the free plan
- Alert after: 2 consecutive failures
- Recovery notification: enabled
- Contacts: restaurant owner and technical operator

Add a second HTTPS monitor for the public frontend URL. After setup, force one
test alert (or temporarily use an invalid path) and confirm both contacts receive
the failure and recovery notifications.

## Deployment check

After every backend deployment, verify both responses before using the POS:

```powershell
Invoke-RestMethod https://rawaqan-api.onrender.com/health
Invoke-RestMethod https://rawaqan-api.onrender.com/ready
```

The second command must report `status: ready` and `database.status: ok`. A
`503` means the API process is alive but PostgreSQL cannot be used; do not start
a cashier shift until readiness recovers.

## Incident procedure

When monitoring fails, use this order and preserve evidence:

1. Stop starting new shifts. If the POS is already offline-ready, existing
   offline work may continue only when the manager accepts the temporary risk.
2. Open Render and check whether the service is `Live`, waking from sleep, or
   has a failed deployment. Do not redeploy repeatedly.
3. Check `/health`. If it fails, inspect the latest Render runtime logs. If it
   succeeds while `/ready` fails, treat PostgreSQL as unavailable and check Neon.
4. On P01, open POS diagnostics and record the pending, retryable-failure, and
   conflict counts. Never clear browser data, unregister the service worker, or
   delete IndexedDB while any count is nonzero.
5. After service recovery, press **Retry / reconnect** once and wait. Recheck
   diagnostics; do not repeatedly click while a request is running.
6. Any financial conflict remains preserved for manager review. Never edit
   invoice, payment, refund, shift, migration, or sync rows directly.
7. Before a rollback or database restore, close operations if possible, take a
   fresh full backup, and follow `docs/DATABASE_BACKUP_RECOVERY.md`. Restore only
   into a disposable verification database first.

Record the incident start/end time, affected device, last successful sync,
deployment commit, diagnostics counts, and the corrective action. This creates
the minimum audit trail needed to distinguish a platform outage from a POS
state conflict.
