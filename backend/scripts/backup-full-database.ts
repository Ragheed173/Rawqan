import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCriticalCountsQuery,
  databaseIdentity,
  parseCriticalCounts,
  parsePostgresUrl,
} from "../src/ops/databaseBackup.js";
import {
  backupPathForTool,
  hasLocalPostgresTool,
  postgresToolVersion,
  runPostgresTool,
} from "./postgres-tools.js";

const databaseUrl =
  process.env.BACKUP_DATABASE_URL ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "BACKUP_DATABASE_URL (or DIRECT_URL/DATABASE_URL) is required.",
  );
}

const backendDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backupDirectory = path.resolve(
  backendDirectory,
  process.env.DATABASE_BACKUP_DIR || "../backups",
);
mkdirSync(backupDirectory, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `rawaqan-full-${timestamp}.dump`;
const localDump = backupPathForTool(backupDirectory, filename, true);
const dumpForPgDump = backupPathForTool(
  backupDirectory,
  filename,
  hasLocalPostgresTool("pg_dump"),
);

console.log("Creating a complete PostgreSQL backup (credentials are not logged)...");
runPostgresTool(
  "pg_dump",
  [
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--no-privileges",
    "--file",
    dumpForPgDump,
  ],
  { databaseUrl, backupDirectory },
);

// On Windows the operational fallback is Docker. If pg_dump is installed
// locally, its output is already at localDump; Docker writes through the mount.
const dumpBytes = readFileSync(localDump);
const dumpForPgRestore = backupPathForTool(
  backupDirectory,
  filename,
  hasLocalPostgresTool("pg_restore"),
);
runPostgresTool("pg_restore", ["--list", dumpForPgRestore], {
  backupDirectory,
  capture: true,
});

const counts = parseCriticalCounts(
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
    { databaseUrl, capture: true },
  ),
);

let gitCommit: string | null = null;
try {
  gitCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: path.resolve(backendDirectory, ".."),
    encoding: "utf8",
  }).trim();
} catch {
  // The backup remains valid outside a Git checkout.
}

const source = databaseIdentity(
  parsePostgresUrl("BACKUP_DATABASE_URL", databaseUrl),
);
const manifest = {
  kind: "rawaqan.postgresql-full-backup",
  version: 1,
  createdAt: new Date().toISOString(),
  source,
  dump: {
    filename,
    bytes: statSync(localDump).size,
    sha256: createHash("sha256").update(dumpBytes).digest("hex"),
    format: "PostgreSQL custom",
    tool: postgresToolVersion("pg_dump"),
  },
  criticalTableCounts: counts,
  gitCommit,
};
const manifestPath = `${localDump}.manifest.json`;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});

console.log(`Backup verified: ${localDump}`);
console.log(`Manifest written: ${manifestPath}`);
console.log("Next: copy both files to encrypted storage, then run db:restore:verify against a disposable test database.");
