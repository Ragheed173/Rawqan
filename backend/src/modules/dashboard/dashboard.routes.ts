import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../utils/http.js';
import { serializeItem } from '../menu/menu.serializers.js';

const router = Router();
router.use(requireAuth);

/** Dashboard statistics: counts, recent meals, recent activity. */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [categories, activeCategories, meals, availableMeals, featured, recentItems, recentActivity] =
      await Promise.all([
        prisma.category.count(),
        prisma.category.count({ where: { isActive: true } }),
        prisma.menuItem.count(),
        prisma.menuItem.count({ where: { isAvailable: true } }),
        prisma.menuItem.count({ where: { isFeatured: true } }),
        prisma.menuItem.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: { images: true, tags: { include: { tag: true } } },
        }),
        prisma.activityLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { admin: { select: { name: true } } },
        }),
      ]);

    return sendSuccess(res, {
      totals: { categories, activeCategories, meals, availableMeals, featured },
      recentMeals: recentItems.map(serializeItem),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        summary: a.summary,
        admin: a.admin?.name ?? 'System',
        createdAt: a.createdAt,
      })),
    });
  }),
);

export default router;
