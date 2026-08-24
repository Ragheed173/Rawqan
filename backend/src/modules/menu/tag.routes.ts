import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/http.js";
import { slugify } from "../../utils/slug.js";
import { serializeTag } from "./menu.serializers.js";
import { recordCatalogChange } from "./catalogRevision.js";

const tagSchema = z.object({
  label: z.string().min(1).max(60),
  labelEn: z.string().max(60).optional().nullable(),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/)
    .optional()
    .nullable(),
});
const idParam = z.object({ id: z.string().cuid() });

// Public list (mounted at /api/tags)
export const publicTagRouter = Router();
publicTagRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tags = await prisma.tag.findMany({ orderBy: { label: "asc" } });
    return sendSuccess(res, tags.map(serializeTag));
  }),
);

// Admin CRUD (mounted at /api/admin/tags)
export const adminTagRouter = Router();
adminTagRouter.use(requireAuth);
adminTagRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tags = await prisma.tag.findMany({ orderBy: { label: "asc" } });
    return sendSuccess(res, tags.map(serializeTag));
  }),
);
adminTagRouter.post(
  "/",
  requirePermission("menu:write"),
  validate({ body: tagSchema }),
  asyncHandler(async (req, res) => {
    const tag = await prisma.$transaction(async (tx) => {
      const created = await tx.tag.create({ data: { ...req.body, slug: slugify(req.body.labelEn || req.body.label) } });
      await recordCatalogChange(tx, { entityType: "Tag", entityId: created.id, action: "CREATED", payload: serializeTag(created) });
      return created;
    });
    return sendCreated(res, serializeTag(tag));
  }),
);
adminTagRouter.patch(
  "/:id",
  requirePermission("menu:write"),
  validate({ params: idParam, body: tagSchema.partial() }),
  asyncHandler(async (req, res) => {
    const tag = await prisma.$transaction(async (tx) => {
      const updated = await tx.tag.update({ where: { id: req.params.id }, data: req.body });
      await recordCatalogChange(tx, { entityType: "Tag", entityId: updated.id, action: "UPDATED", payload: serializeTag(updated) });
      return updated;
    });
    return sendSuccess(res, serializeTag(tag));
  }),
);
adminTagRouter.delete(
  "/:id",
  requirePermission("menu:delete"),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      await tx.tag.delete({ where: { id: req.params.id } });
      await recordCatalogChange(tx, { entityType: "Tag", entityId: req.params.id, action: "DELETED" });
    });
    return sendNoContent(res);
  }),
);
