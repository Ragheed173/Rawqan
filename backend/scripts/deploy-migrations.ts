import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  orderNumericMigrations,
  pendingDestructiveMigrations,
} from "../src/ops/migrationSafety.js";

const MIGRATION_TABLE = "_prisma_migrations";
const BOOTSTRAP_GUARD_TABLE = "_rawaqan_empty_database_bootstrap";
const TRANSACTIONAL_TABLES = [
  "orders",
  "order_items",
  "invoices",
  "payments",
  "refunds",
  "cashier_shifts",
  "sync_operations",
] as const;

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for migrations.");
}

function safeDatabaseName(value: string) {
  try {
    const parsed = new URL(value);
    if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
      throw new Error("not PostgreSQL");
    }
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("Migration database URL must be a valid PostgreSQL URL.");
  }
}

const targetDatabase = safeDatabaseName(databaseUrl);
const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const migrationsDirectory = path.join(
  backendDirectory,
  "prisma",
  "migrations",
);
const prismaCli = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url),
);
const migrations = orderNumericMigrations(
  readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);

function runPrisma(args: string[]) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: backendDirectory,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`Could not start Prisma CLI: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Prisma CLI failed with status ${result.status ?? "unknown"}.`);
  }
}

interface TableRow {
  table_name: string;
}

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

interface CountRow {
  count: bigint;
}

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

async function tableNames() {
  const rows = await prisma.$queryRaw<TableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  return new Set(rows.map(({ table_name }) => table_name));
}

async function appliedMigrationState(hasMigrationTable: boolean) {
  if (!hasMigrationTable) {
    return { appliedNames: new Set<string>(), failedCount: 0 };
  }
  const rows = await prisma.$queryRawUnsafe<MigrationRow[]>(
    `SELECT migration_name, finished_at, rolled_back_at FROM "${MIGRATION_TABLE}"`,
  );
  return {
    appliedNames: new Set(
      rows
        .filter(({ finished_at, rolled_back_at }) => finished_at && !rolled_back_at)
        .map(({ migration_name }) => migration_name),
    ),
    failedCount: rows.filter(
      ({ finished_at, rolled_back_at }) => !finished_at && !rolled_back_at,
    ).length,
  };
}

async function transactionalRowCount(existingTables: Set<string>) {
  let total = 0n;
  for (const table of TRANSACTIONAL_TABLES) {
    if (!existingTables.has(table)) continue;
    const rows = await prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*) AS count FROM "${table}"`,
    );
    total += rows[0]?.count ?? 0n;
  }
  return total;
}

async function bootstrapEmptyDatabase() {
  console.log(
    `Bootstrapping verified empty database ${targetDatabase} in numeric migration order...`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE "${BOOTSTRAP_GUARD_TABLE}" (` +
      '"id" INTEGER PRIMARY KEY, "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${BOOTSTRAP_GUARD_TABLE}" ("id") VALUES (1)`,
  );
  await prisma.$disconnect();

  for (const migration of migrations) {
    console.log(`Applying bootstrap migration ${migration.name}`);
    runPrisma([
      "db",
      "execute",
      "--file",
      path.join("prisma", "migrations", migration.name, "migration.sql"),
      "--schema",
      "prisma/schema.prisma",
    ]);
    runPrisma([
      "migrate",
      "resolve",
      "--applied",
      migration.name,
      "--schema",
      "prisma/schema.prisma",
    ]);
  }

  const cleanupClient = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    await cleanupClient.$executeRawUnsafe(
      `DROP TABLE "${BOOTSTRAP_GUARD_TABLE}"`,
    );
  } finally {
    await cleanupClient.$disconnect();
  }
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
}

async function main() {
  const existingTables = await tableNames();
  if (existingTables.has(BOOTSTRAP_GUARD_TABLE)) {
    throw new Error(
      "An interrupted empty-database bootstrap was detected. Refusing automatic recovery; rebuild the empty target or restore a verified full backup.",
    );
  }

  const hasMigrationTable = existingTables.has(MIGRATION_TABLE);
  const { appliedNames, failedCount } =
    await appliedMigrationState(hasMigrationTable);
  const userTables = [...existingTables].filter(
    (name) => name !== MIGRATION_TABLE,
  );

  if (userTables.length === 0 && appliedNames.size === 0 && failedCount === 0) {
    await bootstrapEmptyDatabase();
    return;
  }

  if (!hasMigrationTable) {
    throw new Error(
      "The target contains application tables but has no Prisma migration history. Refusing to guess or modify it.",
    );
  }

  const destructivePending = pendingDestructiveMigrations(
    migrations,
    appliedNames,
  );
  if (destructivePending.length > 0) {
    const rowCount = await transactionalRowCount(existingTables);
    if (rowCount > 0n) {
      throw new Error(
        `Refusing destructive historical migrations on a database containing transactional data. Pending: ${destructivePending.join(", ")}.`,
      );
    }
  }

  await prisma.$disconnect();
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
