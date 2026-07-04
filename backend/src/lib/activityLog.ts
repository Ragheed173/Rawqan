import type { ActivityAction, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

interface LogInput {
  adminId?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

/**
 * Fire-and-forget audit log write. Never throws into the request path —
 * a failed log must not fail the underlying operation.
 */
export function recordActivity(input: LogInput): void {
  prisma.activityLog
    .create({
      data: {
        adminId: input.adminId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata,
        ip: input.ip,
      },
    })
    .catch((err) => {
       
      console.error('[activityLog] failed to write:', err);
    });
}
