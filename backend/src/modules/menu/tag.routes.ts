import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/http.js';
import { slugify } from '../../utils/slug.js';
import { serializeTag } from './menu.serializers.js';

const tagSchema = z.object({
  label: z.string().min(1).max(60),
  labelEn: z.string().max(60).optional().nullable(),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional().nullable(),
});
const idParam = z.object({ id: z.string().cuid() });

// Public list (mounted at /api/tags)
export const publicTagRouter = Router();
publicTagRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tags = await prisma.tag.findMany({ orderBy: { label: 'asc' } });
    return sendSuccess(res, tags.map(serializeTag));
  }),
);

// Admin CRUD (mounted at /api/admin/tags)
export const adminTagRouter = Router();
adminTagRouter.use(requireAuth);
adminTagRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tags = await prisma.tag.findMany({ orderBy: { label: 'asc' } });
    return sendSuccess(res, tags.map(serializeTag));
  }),
);
adminTagRouter.post(
  '/',
  validate({ body: tagSchema }),
  asyncHandler(async (req, res) => {
    const tag = await prisma.tag.create({ data: { ...req.body, slug: slugify(req.body.labelEn || req.body.label) } });
    return sendCreated(res, serializeTag(tag));
  }),
);
adminTagRouter.patch(
  '/:id',
  validate({ params: idParam, body: tagSchema.partial() }),
  asyncHandler(async (req, res) => {
    const tag = await prisma.tag.update({ where: { id: req.params.id }, data: req.body });
    return sendSuccess(res, serializeTag(tag));
  }),
);
adminTagRouter.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await prisma.tag.delete({ where: { id: req.params.id } });
    return sendNoContent(res);
  }),
);
