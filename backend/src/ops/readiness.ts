import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export interface DatabaseReadiness {
  latencyMs: number;
}

type DatabaseProbe = () => Promise<unknown>;

const defaultProbe: DatabaseProbe = () => prisma.$queryRaw`SELECT 1`;

export async function checkDatabaseReadiness(
  probe: DatabaseProbe = defaultProbe,
  timeoutMs = env.HEALTH_DATABASE_TIMEOUT_MS,
): Promise<DatabaseReadiness> {
  const startedAt = performance.now();
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      probe(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database readiness check timed out")),
          timeoutMs,
        );
        timeout.unref();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  return { latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) };
}
