import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { updateHoursSchema, updateSettingsSchema } from './settings.schemas.js';
import * as controller from './settings.controller.js';

// Public (mounted at /api/settings)
export const publicSettingsRouter = Router();
publicSettingsRouter.get('/', asyncHandler(controller.get));

// Admin (mounted at /api/admin/settings)
export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAuth);
adminSettingsRouter.get('/', asyncHandler(controller.get));
adminSettingsRouter.patch(
  '/',
  requirePermission('settings:write'),
  validate({ body: updateSettingsSchema }),
  asyncHandler(controller.update),
);
adminSettingsRouter.patch(
  '/hours',
  requirePermission('settings:write'),
  validate({ body: updateHoursSchema }),
  asyncHandler(controller.updateHours),
);
