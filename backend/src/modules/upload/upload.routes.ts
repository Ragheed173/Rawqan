import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";
import { uploadBuffer } from "../../lib/cloudinary.js";
import { deleteOrphanedAssets } from "./assetCleanup.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/http.js";
import { serializeImage } from "../menu/menu.serializers.js";
import { upload } from "./multer.js";
import { recordCatalogChange } from "../menu/catalogRevision.js";
import { cloudinaryEnabled } from "../../lib/cloudinary.js";
import { mirrorExternalCatalogImageBatch } from "./catalogImageMirror.service.js";

const router = Router();
router.use(requireAuth);

const itemParam = z.object({ itemId: z.string().cuid() });
const imageParam = z.object({ imageId: z.string().cuid() });
const imagePatch = z.object({ alt: z.string().trim().max(200).nullable().optional(), sortOrder: z.number().int().optional() });
const imageOrder = z.object({ images: z.array(z.object({ id: z.string().cuid(), sortOrder: z.number().int() })).min(1) });
const mirrorBatch = z.object({
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(5).default(3),
});

/** Mirrors imported third-party catalog images into the restaurant's Cloudinary account. */
router.post(
  "/catalog/mirror-external",
  requirePermission("import:manage"),
  validate({ body: mirrorBatch }),
  asyncHandler(async (req, res) => {
    if (!cloudinaryEnabled) throw ApiError.internal("Cloudinary is not configured");
    const result = await mirrorExternalCatalogImageBatch(req.body);
    return sendSuccess(res, result);
  }),
);

/** Generic single-file upload → returns a Cloudinary URL (used for logos, covers, category images). */
router.post(
  "/",
  requirePermission("menu:write"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file)
      throw ApiError.badRequest('No file provided (field name: "file")');
    const folder =
      typeof req.body.folder === "string"
        ? `rawaqan/${req.body.folder}`
        : undefined;
    const result = await uploadBuffer(req.file.buffer, folder);
    return sendCreated(res, result);
  }),
);

/** Uploads one or more images and attaches them to a menu item. */
router.post(
  "/items/:itemId/images",
  requirePermission("menu:write"),
  validate({ params: itemParam }),
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length)
      throw ApiError.badRequest('No files provided (field name: "files")');

    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.itemId },
      include: { images: true },
    });
    if (!item) throw ApiError.notFound("Item not found");

    const uploads = await Promise.all(
      files.map((f) => uploadBuffer(f.buffer, "rawaqan/items")),
    );
    const order = item.images.length;
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const [idx, uploaded] of uploads.entries()) {
        const image = await tx.itemImage.create({ data: { itemId: item.id, url: uploaded.url, publicId: uploaded.publicId, sortOrder: order + idx, isPrimary: item.images.length === 0 && idx === 0 } });
        rows.push(image);
      }
      await recordCatalogChange(tx, { entityType: "ItemImage", entityId: item.id, action: "CREATED", payload: { itemId: item.id, imageIds: rows.map((row) => row.id) } });
      return rows;
    });
    return sendCreated(res, created.map(serializeImage));
  }),
);

/** Deletes an image (Cloudinary asset + DB row); promotes a new primary if needed. */
router.delete(
  "/images/:imageId",
  requirePermission("menu:delete"),
  validate({ params: imageParam }),
  asyncHandler(async (req, res) => {
    const image = await prisma.itemImage.findUnique({
      where: { id: req.params.imageId },
    });
    if (!image) throw ApiError.notFound("Image not found");
    await prisma.$transaction(async (tx) => {
      await tx.itemImage.delete({ where: { id: image.id } });
      let promotedId: string | undefined;
      if (image.isPrimary) {
        const next = await tx.itemImage.findFirst({ where: { itemId: image.itemId }, orderBy: { sortOrder: "asc" } });
        if (next) {
          await tx.itemImage.update({ where: { id: next.id }, data: { isPrimary: true } });
          promotedId = next.id;
        }
      }
      await recordCatalogChange(tx, { entityType: "ItemImage", entityId: image.id, action: "DELETED", payload: { itemId: image.itemId, promotedId } });
    });
    // Only destroy the Cloudinary asset if no other row (e.g. a duplicated meal)
    // still references the same publicId.
    await deleteOrphanedAssets([image.publicId]);

    return sendNoContent(res);
  }),
);

/** Updates printable alt text/order metadata for an existing item image. */
router.patch(
  "/images/:imageId",
  requirePermission("menu:write"),
  validate({ params: imageParam, body: imagePatch }),
  asyncHandler(async (req, res) => {
    const image = await prisma.$transaction(async (tx) => {
      const updated = await tx.itemImage.update({ where: { id: req.params.imageId }, data: req.body });
      await recordCatalogChange(tx, { entityType: "ItemImage", entityId: updated.id, action: "UPDATED", payload: serializeImage(updated) });
      return updated;
    });
    return sendSuccess(res, serializeImage(image));
  }),
);

/** Reorders all supplied images as one logical catalog revision. */
router.patch(
  "/items/:itemId/images/reorder",
  requirePermission("menu:write"),
  validate({ params: itemParam, body: imageOrder }),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      const owned = await tx.itemImage.count({ where: { itemId: req.params.itemId, id: { in: req.body.images.map((image: { id: string }) => image.id) } } });
      if (owned !== req.body.images.length) throw ApiError.badRequest("Every image must belong to the selected item");
      for (const image of req.body.images) await tx.itemImage.update({ where: { id: image.id }, data: { sortOrder: image.sortOrder } });
      await recordCatalogChange(tx, { entityType: "ItemImage", entityId: req.params.itemId, action: "UPDATED", payload: { order: req.body.images } });
    });
    return sendSuccess(res, { updated: req.body.images.length });
  }),
);

/** Marks an image as the primary for its item. */
router.patch(
  "/images/:imageId/primary",
  requirePermission("menu:write"),
  validate({ params: imageParam }),
  asyncHandler(async (req, res) => {
    const image = await prisma.itemImage.findUnique({
      where: { id: req.params.imageId },
    });
    if (!image) throw ApiError.notFound("Image not found");
    await prisma.$transaction(async (tx) => {
      await tx.itemImage.updateMany({ where: { itemId: image.itemId }, data: { isPrimary: false } });
      const primary = await tx.itemImage.update({ where: { id: image.id }, data: { isPrimary: true } });
      await recordCatalogChange(tx, { entityType: "ItemImage", entityId: primary.id, action: "UPDATED", payload: serializeImage(primary) });
    });
    return sendSuccess(res, { message: "Primary image updated" });
  }),
);

export default router;
