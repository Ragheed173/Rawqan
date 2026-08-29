const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const SAFE_RESTORE_NAME = /(test|restore|staging|sandbox)/i;

export const CRITICAL_BACKUP_TABLES = [
  "_prisma_migrations",
  "orders",
  "invoices",
  "payments",
  "cashier_shifts",
  "sync_operations",
] as const;

export interface DatabaseIdentity {
  host: string;
  port: string;
  database: string;
}

export function parsePostgresUrl(label: string, value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${label} must use postgresql:// or postgres://.`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !database) {
    throw new Error(`${label} must include a host and database name.`);
  }
  return parsed;
}

export function databaseIdentity(parsed: URL): DatabaseIdentity {
  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
  };
}

export function assertSafeRestoreTarget(
  targetUrl: string,
  source?: DatabaseIdentity,
): DatabaseIdentity {
  const target = databaseIdentity(
    parsePostgresUrl("RESTORE_DATABASE_URL", targetUrl),
  );
  if (!SAFE_RESTORE_NAME.test(target.database)) {
    throw new Error(
      `Refusing restore: target database "${target.database}" must contain test, restore, staging, or sandbox.`,
    );
  }
  if (
    source &&
    source.host === target.host &&
    source.port === target.port &&
    source.database === target.database
  ) {
    throw new Error("Refusing restore: source and target are the same database.");
  }
  return target;
}

export function buildCriticalCountsQuery() {
  const pairs = CRITICAL_BACKUP_TABLES.map(
    (table) =>
      `'${table}', (SELECT count(*)::text FROM public."${table}")`,
  );
  return `SELECT json_build_object(${pairs.join(", ")})::text;`;
}

export function parseCriticalCounts(output: string): Record<string, string> {
  const candidate = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("{") && line.endsWith("}"));
  if (!candidate) throw new Error("Could not read verification counts from PostgreSQL.");
  const parsed = JSON.parse(candidate) as Record<string, unknown>;
  return Object.fromEntries(
    CRITICAL_BACKUP_TABLES.map((table) => {
      const value = parsed[table];
      if (typeof value !== "string" && typeof value !== "number") {
        throw new Error(`Missing verification count for ${table}.`);
      }
      return [table, String(value)];
    }),
  );
}
