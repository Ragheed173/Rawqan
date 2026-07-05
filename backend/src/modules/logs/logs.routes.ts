import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../utils/http.js';

const router = Router();
router.use(requireAuth, requirePermission('logs:read'));

const query = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']).optional(),
  entityType: z.string().max(60).optional(),
});

/** Paginated activity/audit log (Task 22). */
router.get(
  '/',
  validate({ query }),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 25, action, entityType } = req.query as z.infer<typeof query>;
    const where = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { name: true, email: true } } },
      }),
    ]);

    return sendSuccess(
      res,
      logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        summary: l.summary,
        admin: l.admin?.name ?? 'System',
        adminEmail: l.admin?.email ?? null,
        ip: l.ip,
        createdAt: l.createdAt,
      })),
      200,
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    );
  }),
);

export default router;
