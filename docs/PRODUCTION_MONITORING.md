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

Create an HTTPS monitor in UptimeRobot, Better Stack, or an equivalent service:

- URL: `https://rawaqan-api.onrender.com/ready`
- Method: `GET`
- Expected status: `200`
- Interval: 5 minutes
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
