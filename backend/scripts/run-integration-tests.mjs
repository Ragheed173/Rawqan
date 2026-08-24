import { spawnSync } from "node:child_process";
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
const prismaCli = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url),
);
const vitestCli = fileURLToPath(
  new URL("../../node_modules/vitest/vitest.mjs", import.meta.url),
);

function run(cli, args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Failed to launch ${cli}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(prismaCli, ["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
run(vitestCli, ["run", "--config", "vitest.integration.config.ts"]);
