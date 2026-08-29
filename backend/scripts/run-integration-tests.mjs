import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error(
    "TEST_DATABASE_URL is required for PostgreSQL integration tests.",
  );
  process.exit(1);
}

function assertTestDatabaseUrl(label, value) {
  let databaseName;
  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error("not PostgreSQL");
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    console.error(`${label} must be a valid PostgreSQL URL.`);
    process.exit(1);
  }

  // The runner applies migrations. Refuse ambiguously named runtime and direct
  // databases to reduce the chance of targeting production by mistake.
  if (!databaseName.toLowerCase().includes("test")) {
    console.error(
      `Refusing integration tests: ${label} database name "${databaseName}" must contain "test".`,
    );
    process.exit(1);
  }
}

const testDirectUrl = process.env.TEST_DIRECT_URL ?? testDatabaseUrl;
assertTestDatabaseUrl("TEST_DATABASE_URL", testDatabaseUrl);
assertTestDatabaseUrl("TEST_DIRECT_URL", testDirectUrl);

const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  DIRECT_URL: testDirectUrl,
};
const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const prismaCli = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url),
);
const vitestCli = fileURLToPath(
  new URL("../../node_modules/vitest/vitest.mjs", import.meta.url),
);

function run(cli, args, input) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: backendDirectory,
    env,
    ...(input === undefined
      ? { stdio: "inherit" }
      : { input, stdio: ["pipe", "inherit", "inherit"] }),
  });
  if (result.error) {
    console.error(`Failed to launch ${cli}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// These migrations were originally named with unpadded numeric prefixes. Prisma
// sorts directory names lexically, which puts 10/11 before 2 on a new database.
// Production already has the original history, so renaming deployed migrations
// would be unsafe. The disposable integration database instead applies the same
// immutable SQL files in their intended numeric order.
const migrationsDirectory = path.join(
  backendDirectory,
  "prisma",
  "migrations",
);
const migrations = readdirSync(migrationsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
  .map((entry) => ({
    name: entry.name,
    sequence: Number(entry.name.match(/^(\d+)_/)?.[1]),
  }))
  .sort((left, right) =>
    left.sequence === right.sequence
      ? left.name.localeCompare(right.name)
      : left.sequence - right.sequence,
  );

if (!migrations.length || migrations.some(({ sequence }) => !Number.isSafeInteger(sequence))) {
  console.error("No valid numerically prefixed migrations were found.");
  process.exit(1);
}
if (new Set(migrations.map(({ sequence }) => sequence)).size !== migrations.length) {
  console.error("Migration numeric prefixes must be unique.");
  process.exit(1);
}

console.log(`Resetting approved disposable database and applying ${migrations.length} migrations...`);
run(
  prismaCli,
  ["db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
  'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;\n',
);
for (const migration of migrations) {
  console.log(`Applying integration migration ${migration.name}`);
  run(prismaCli, [
    "db",
    "execute",
    "--file",
    path.join("prisma", "migrations", migration.name, "migration.sql"),
    "--schema",
    "prisma/schema.prisma",
  ]);
}
run(vitestCli, ["run", "--config", "vitest.integration.config.ts"]);
