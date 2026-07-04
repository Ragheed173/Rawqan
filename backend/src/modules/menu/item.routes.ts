import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createItemSchema,
  idParamSchema,
  listItemsQuerySchema,
  slugParamSchema,
  updateItemSchema,
} from './item.schemas.js';
import * as controller from './item.controller.js';

// Public (mounted at /api/items)
export const publicItemRouter = Router();
publicItemRouter.get('/', validate({ query: listItemsQuerySchema }), asyncHandler(controller.listPublic));
publicItemRouter.get('/:slug', validate({ params: slugParamSchema }), asyncHandler(controller.getPublicBySlug));

// Admin (mounted at /api/admin/items)
export const adminItemRouter = Router();
adminItemRouter.use(requireAuth);
adminItemRouter.get('/', validate({ query: listItemsQuerySchema }), asyncHandler(controller.listAdmin));
adminItemRouter.post(
  '/',
  requirePermission('menu:write'),
  validate({ body: createItemSchema }),
  asyncHandler(controller.create),
);
adminItemRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getById));
adminItemRouter.patch(
  '/:id',
  requirePermission('menu:write'),
  validate({ params: idParamSchema, body: updateItemSchema }),
  asyncHandler(controller.update),
);
adminItemRouter.delete(
  '/:id',
  requirePermission('menu:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.remove),
);
adminItemRouter.post(
  '/:id/duplicate',
  requirePermission('menu:write'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.duplicate),
);
