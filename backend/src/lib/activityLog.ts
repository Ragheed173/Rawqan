import type { ActivityAction, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";

export interface LogInput {
  adminId?: string | null;
  actorNameSnapshot?: string | null;
  actorRoleSnapshot?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  operationId?: string | null;
  deviceId?: string | null;
  reason?: string | null;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  ip?: string;
}

export type ActivityLogClient =
  | Pick<PrismaClient, "activityLog">
  | Pick<Prisma.TransactionClient, "activityLog">;

/**
 * Awaited audit write. Financial modules must inject their Prisma transaction
 * client so the audit row commits or rolls back with the financial operation.
 */
export function writeActivity(
  input: LogInput,
  client: ActivityLogClient = prisma,
) {
  return client.activityLog.create({
    data: {
      adminId: input.adminId ?? null,
      actorNameSnapshot: input.actorNameSnapshot ?? null,
      actorRoleSnapshot: input.actorRoleSnapshot ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      operationId: input.operationId ?? null,
      deviceId: input.deviceId ?? null,
      reason: input.reason ?? null,
      summary: input.summary,
      metadata: input.metadata,
      beforeData: input.beforeData,
      afterData: input.afterData,
      ip: input.ip,
    },
  });
}

/**
 * Fire-and-forget audit log write. Never throws into the request path —
 * a failed log must not fail the underlying operation.
 */
export function recordActivity(
  input: LogInput,
  client: ActivityLogClient = prisma,
): void {
  writeActivity(input, client).catch((err) => {
    console.error("[activityLog] failed to write:", err);
  });
}
