import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/http.js';
import * as service from './analytics.service.js';

const trackSchema = z.object({
  type: z.enum(['PAGE_VIEW', 'ITEM_VIEW', 'CATEGORY_VIEW', 'QR_SCAN']),
  itemId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  path: z.string().max(300).optional(),
});

// Public tracking endpoint (mounted at /api/analytics)
export const publicAnalyticsRouter = Router();
publicAnalyticsRouter.post(
  '/track',
  validate({ body: trackSchema }),
  asyncHandler(async (req, res) => {
    service.track({ ...req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    return sendSuccess(res, { ok: true }, 202);
  }),
);

// Admin analytics (mounted at /api/admin/analytics)
const summaryQuery = z.object({ days: z.coerce.number().int().min(1).max(365).optional() });

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(requireAuth, requirePermission('analytics:read'));
adminAnalyticsRouter.get(
  '/',
  validate({ query: summaryQuery }),
  asyncHandler(async (req, res) => {
    const days = (req.query as { days?: number }).days ?? 30;
    return sendSuccess(res, await service.summary(days));
  }),
);
