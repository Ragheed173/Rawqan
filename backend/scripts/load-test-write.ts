import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import {
  addOrderItem,
  finalizeInvoice,
  openOrder,
} from "../src/modules/pos/pos.commands.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const target = new URL(connectionString);
const databaseName = target.pathname.slice(1).toLowerCase();
const disposable = /(test|audit|restore|staging|sandbox|soak)/.test(databaseName);
if (!disposable || process.env.ALLOW_WRITE_LOAD_TEST !== "true") {
  throw new Error(
    "Write load tests require a disposable database and ALLOW_WRITE_LOAD_TEST=true. Production is refused.",
  );
}

function positiveInteger(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw new Error(`${name} must be between 1 and ${maximum}.`);
  return value;
}

const durationSeconds = positiveInteger("LOAD_TEST_DURATION_SECONDS", 30, 1_800);
const concurrencyLevels = (process.env.LOAD_TEST_CONCURRENCY_LEVELS ?? "1,5,10,25")
  .split(",")
  .map(Number);
if (
  !concurrencyLevels.length ||
  concurrencyLevels.some((value) => !Number.isInteger(value) || value < 1 || value > 50)
) throw new Error("LOAD_TEST_CONCURRENCY_LEVELS must contain integers from 1 to 50.");

const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);

function percentile(values: number[], percentage: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage) - 1)] ?? 0);
}

async function prepare(level: number) {
  const actor = await prisma.admin.create({
    data: {
      email: `write-load-${runId}-${level}@rawaqan.test`,
      name: `Write Load ${level}`,
      passwordHash: "not-used-by-load-test",
      role: "CASHIER",
    },
  });
  const device = await prisma.posDevice.create({
    data: { code: `WL${runId}${level}`.toUpperCase(), name: `Write load ${level}` },
  });
  const category = await prisma.category.create({
    data: { slug: `write-load-${runId}-${level}`, name: "Write load" },
  });
  const item = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      slug: `write-load-item-${runId}-${level}`,
      name: "Write load item",
      price: "10.00",
    },
  });
  const tables = await Promise.all(
    Array.from({ length: level }, (_, index) =>
      prisma.diningTable.create({
        data: {
          code: `WL-${runId}-${level}-${index}`.toUpperCase(),
          displayName: `Worker ${index + 1}`,
          capacity: 4,
          sortOrder: index,
        },
      }),
    ),
  );
  return { actor, device, item, tables };
}

async function runLevel(concurrency: number) {
  const fixture = await prepare(concurrency);
  const deadline = performance.now() + durationSeconds * 1_000;
  const latencies: number[] = [];
  const failures: string[] = [];
  let sales = 0;

  await Promise.all(fixture.tables.map(async (table) => {
    while (performance.now() < deadline) {
      const started = performance.now();
      try {
        const context = {
          actorId: fixture.actor.id,
          deviceId: fixture.device.id,
          operationId: randomUUID(),
        };
        const order = await openOrder({ tableId: table.id, guestCount: 2 }, context);
        await addOrderItem(order.id, {
          expectedVersion: 1,
          menuItemId: fixture.item.id,
          quantity: 1,
        }, { ...context, operationId: randomUUID() });
        await finalizeInvoice({
          orderId: order.id,
          expectedVersion: 2,
          payments: [{ method: "CASH", amountMinor: 1_000n, tenderedMinor: 1_000n }],
        }, { ...context, operationId: randomUUID() });
        sales += 1;
        latencies.push(performance.now() - started);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }));

  const report = {
    concurrency,
    durationSeconds,
    completedSales: sales,
    salesPerSecond: Number((sales / durationSeconds).toFixed(2)),
    failures: failures.length,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: Math.round(Math.max(...latencies, 0)),
    },
    sampleErrors: [...new Set(failures)].slice(0, 5),
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
}

try {
  for (const concurrency of concurrencyLevels) await runLevel(concurrency);
} finally {
  await prisma.$disconnect();
}
