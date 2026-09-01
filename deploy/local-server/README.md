# Rawaqan local restaurant server

This stack is intentionally isolated from the other Docker projects on the
host. It runs a dedicated PostgreSQL database, the API on the LAN, and a local
web build behind the host's existing Nginx installation.

## Ports

- `${RAWAQAN_BIND_IP}:4000`: API for the cashier desktop application.
- `127.0.0.1:8280`: local web container, reachable through host Nginx only.
- PostgreSQL is internal to the `rawaqan` Docker network and is never published.

## Initial installation

```bash
git clone https://github.com/Ragheed173/Rawqan.git /home/ragheed/docker/rawaqan
cd /home/ragheed/docker/rawaqan/deploy/local-server
cp runtime.env.example runtime.env
chmod 600 runtime.env
```

Fill `runtime.env` with generated secrets, then validate without printing them:

```bash
docker compose --env-file runtime.env -f compose.yml config --quiet
```

Start only the new empty database before restoring a backup:

```bash
docker compose --env-file runtime.env -f compose.yml up -d db
```

Copy a custom-format PostgreSQL dump to the server, then restore it into the
new empty database. This target is the dedicated local container, never Neon.

```bash
docker cp rawaqan-production.dump rawaqan-db-1:/tmp/rawaqan-production.dump
docker exec rawaqan-db-1 pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-owner --no-privileges --exit-on-error \
  /tmp/rawaqan-production.dump
docker exec rawaqan-db-1 rm -f /tmp/rawaqan-production.dump
```

Build and start the API and local web application. API startup automatically
applies any migrations newer than the restored backup.

```bash
docker compose --env-file runtime.env -f compose.yml up -d --build api web
docker compose --env-file runtime.env -f compose.yml ps
```

Install `nginx-rawaqan.conf` through a privileged terminal only after both
containers are healthy. Keep Render unchanged until LAN and cashier tests pass.
