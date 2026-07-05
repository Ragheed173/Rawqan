import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { uploadBuffer } from '../../lib/cloudinary.js';
import { deleteOrphanedAssets } from './assetCleanup.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/http.js';
import { serializeImage } from '../menu/menu.serializers.js';
import { upload } from './multer.js';

const router = Router();
router.use(requireAuth);

const itemParam = z.object({ itemId: z.string().cuid() });
const imageParam = z.object({ imageId: z.string().cuid() });

/** Generic single-file upload → returns a Cloudinary URL (used for logos, covers, category images). */
router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file provided (field name: "file")');
    const folder = typeof req.body.folder === 'string' ? `rawaqan/${req.body.folder}` : undefined;
    const result = await uploadBuffer(req.file.buffer, folder);
    return sendCreated(res, result);
  }),
);

/** Uploads one or more images and attaches them to a menu item. */
router.post(
  '/items/:itemId/images',
  validate({ params: itemParam }),
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw ApiError.badRequest('No files provided (field name: "files")');

    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.itemId },
      include: { images: true },
    });
    if (!item) throw ApiError.notFound('Item not found');

    const uploads = await Promise.all(files.map((f) => uploadBuffer(f.buffer, 'rawaqan/items')));
    const order = item.images.length;
    const created = await prisma.$transaction(
      uploads.map((u, idx) =>
        prisma.itemImage.create({
          data: {
            itemId: item.id,
            url: u.url,
            publicId: u.publicId,
            sortOrder: order + idx,
            isPrimary: item.images.length === 0 && idx === 0,
          },
        }),
      ),
    );
    return sendCreated(res, created.map(serializeImage));
  }),
);

/** Deletes an image (Cloudinary asset + DB row); promotes a new primary if needed. */
router.delete(
  '/images/:imageId',
  validate({ params: imageParam }),
  asyncHandler(async (req, res) => {
    const image = await prisma.itemImage.findUnique({ where: { id: req.params.imageId } });
    if (!image) throw ApiError.notFound('Image not found');
    await prisma.itemImage.delete({ where: { id: image.id } });
    // Only destroy the Cloudinary asset if no other row (e.g. a duplicated meal)
    // still references the same publicId.
    await deleteOrphanedAssets([image.publicId]);

    if (image.isPrimary) {
      const next = await prisma.itemImage.findFirst({
        where: { itemId: image.itemId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) await prisma.itemImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    return sendNoContent(res);
  }),
);

/** Marks an image as the primary for its item. */
router.patch(
  '/images/:imageId/primary',
  validate({ params: imageParam }),
  asyncHandler(async (req, res) => {
    const image = await prisma.itemImage.findUnique({ where: { id: req.params.imageId } });
    if (!image) throw ApiError.notFound('Image not found');
    await prisma.$transaction([
      prisma.itemImage.updateMany({ where: { itemId: image.itemId }, data: { isPrimary: false } }),
      prisma.itemImage.update({ where: { id: image.id }, data: { isPrimary: true } }),
    ]);
    return sendSuccess(res, { message: 'Primary image updated' });
  }),
);

export default router;
