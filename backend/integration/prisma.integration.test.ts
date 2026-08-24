import crypto from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { writeActivity } from "../src/lib/activityLog.js";

const operationIds = new Set<string>();
const categoryIds = new Set<string>();

afterEach(async () => {
  await prisma.activityLog.deleteMany({
    where: { operationId: { in: [...operationIds] } },
  });
  await prisma.category.deleteMany({ where: { id: { in: [...categoryIds] } } });
  operationIds.clear();
  categoryIds.clear();
});

afterAll(async () => prisma.$disconnect());

describe("PostgreSQL transaction foundation", () => {
  it("commits an awaited audit row through the transaction client", async () => {
    const operationId = crypto.randomUUID();
    operationIds.add(operationId);
    await prisma.$transaction((tx) =>
      writeActivity(
        {
          action: "POS_SYNC_APPLIED",
          entityType: "IntegrationProbe",
          operationId,
          actorNameSnapshot: "Integration Test",
        },
        tx,
      ),
    );
    expect(await prisma.activityLog.count({ where: { operationId } })).toBe(1);
  });

  it("rolls back the audit row when a later transaction step fails", async () => {
    const operationId = crypto.randomUUID();
    operationIds.add(operationId);
    await expect(
      prisma.$transaction(async (tx) => {
        await writeActivity(
          {
            action: "INVOICE_CREATED",
            entityType: "IntegrationProbe",
            operationId,
          },
          tx,
        );
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    expect(await prisma.activityLog.count({ where: { operationId } })).toBe(0);
  });

  it("surfaces PostgreSQL unique-constraint conflicts for future idempotency tests", async () => {
    const slug = `integration-${crypto.randomUUID()}`;
    const category = await prisma.category.create({
      data: { slug, name: "Integration Test" },
    });
    categoryIds.add(category.id);
    await expect(
      prisma.category.create({ data: { slug, name: "Duplicate" } }),
    ).rejects.toMatchObject({
      code: "P2002",
    });
  });
});
