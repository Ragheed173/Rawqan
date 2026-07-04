import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

/**
 * Single shared PrismaClient. In dev we cache on globalThis so tsx hot-reload
 * doesn't exhaust the connection pool with new clients on every reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
