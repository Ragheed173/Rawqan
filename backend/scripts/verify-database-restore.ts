import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  assertSafeRestoreTarget,
  buildCriticalCountsQuery,
  parseCriticalCounts,
  type DatabaseIdentity,
} from "../src/ops/databaseBackup.js";
import {
  backupPathForTool,
  hasLocalPostgresTool,
  runPostgresTool,
} from "./postgres-tools.js";

interface BackupManifest {
  kind: "rawaqan.postgresql-full-backup";
  version: 1;
  source: DatabaseIdentity;
  dump: { filename: string; bytes: number; sha256: string };
  criticalTableCounts: Record<string, string>;
}

const restoreUrl =
  process.env.RESTORE_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!restoreUrl) {
  throw new Error("RESTORE_DATABASE_URL (or TEST_DATABASE_URL) is required.");
}

const requestedDump = process.argv[2];
if (!requestedDump) {
  throw new Error(
    "Pass the .dump path: npm run db:restore:verify -- <backup-file.dump>",
  );
}
const invocationDirectory = process.env.INIT_CWD || process.cwd();
const dumpPath = path.resolve(invocationDirectory, requestedDump);
if (!existsSync(dumpPath)) throw new Error(`Backup not found: ${dumpPath}`);
const manifestPath = `${dumpPath}.manifest.json`;
if (!existsSync(manifestPath)) {
  throw new Error(`Backup manifest not found: ${manifestPath}`);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BackupManifest;
if (
  manifest.kind !== "rawaqan.postgresql-full-backup" ||
  manifest.version !== 1
) {
  throw new Error("Unsupported or invalid backup manifest.");
}
if (manifest.dump.filename !== path.basename(dumpPath)) {
  throw new Error("Backup filename does not match its manifest.");
}
const actualHash = createHash("sha256")
  .update(readFileSync(dumpPath))
  .digest("hex");
if (actualHash !== manifest.dump.sha256) {
  throw new Error("Backup checksum mismatch; refusing to restore a damaged file.");
}

const target = assertSafeRestoreTarget(restoreUrl, manifest.source);
console.log(
  `Restoring only to approved disposable database ${target.database} on ${target.host}...`,
);
const toolDump = backupPathForTool(
  path.dirname(dumpPath),
  path.basename(dumpPath),
  hasLocalPostgresTool("pg_restore"),
);
runPostgresTool(
  "pg_restore",
  [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--dbname",
    target.database,
    toolDump,
  ],
  { databaseUrl: restoreUrl, backupDirectory: path.dirname(dumpPath) },
);

const restoredCounts = parseCriticalCounts(
  runPostgresTool(
    "psql",
    [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--tuples-only",
      "--no-align",
      "--command",
      buildCriticalCountsQuery(),
    ],
    { databaseUrl: restoreUrl, capture: true },
  ),
);

for (const [table, expected] of Object.entries(
  manifest.criticalTableCounts,
)) {
  if (restoredCounts[table] !== expected) {
    throw new Error(
      `Restore verification failed for ${table}: expected ${expected}, got ${restoredCounts[table] ?? "missing"}.`,
    );
  }
}

console.log("Restore verification passed. Critical financial and operational table counts match the backup manifest.");
