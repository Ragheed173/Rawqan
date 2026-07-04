import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createCategorySchema,
  idParamSchema,
  reorderSchema,
  updateCategorySchema,
} from './category.schemas.js';
import * as controller from './category.controller.js';

// Public routes (mounted at /api/categories)
export const publicCategoryRouter = Router();
publicCategoryRouter.get('/', asyncHandler(controller.listPublic));

// Admin routes (mounted at /api/admin/categories, all behind requireAuth)
export const adminCategoryRouter = Router();
adminCategoryRouter.use(requireAuth);
adminCategoryRouter.get('/', asyncHandler(controller.listAdmin));
adminCategoryRouter.post(
  '/',
  requirePermission('category:write'),
  validate({ body: createCategorySchema }),
  asyncHandler(controller.create),
);
adminCategoryRouter.patch(
  '/reorder',
  requirePermission('category:write'),
  validate({ body: reorderSchema }),
  asyncHandler(controller.reorder),
);
adminCategoryRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getById));
adminCategoryRouter.patch(
  '/:id',
  requirePermission('category:write'),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  asyncHandler(controller.update),
);
adminCategoryRouter.delete(
  '/:id',
  requirePermission('category:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.remove),
);
