import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { recordActivity } from '../../lib/activityLog.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/http.js';
import multer from 'multer';
import * as menuIo from './menuIo.service.js';
import * as backup from './backup.service.js';

const router = Router();
router.use(requireAuth);

// Spreadsheet uploads: accept xlsx/csv/json via memory storage.
const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Export (Excel / CSV) ────────────────────────────────────
router.get(
  '/export',
  requirePermission('import:manage'),
  validate({ query: z.object({ format: z.enum(['xlsx', 'csv']).optional() }) }),
  asyncHandler(async (req, res) => {
    const format = (req.query.format as 'xlsx' | 'csv') ?? 'xlsx';
    const buffer = await menuIo.exportBuffer(format);
    const type =
      format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `attachment; filename="rawaqan-menu.${format}"`);
    return res.send(buffer);
  }),
);

// ─── Import (Excel / CSV) ────────────────────────────────────
router.post(
  '/import',
  requirePermission('import:manage'),
  fileUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file provided (field name: "file")');
    const result = await menuIo.importBuffer(req.file.buffer);
    recordActivity({
      adminId: req.admin?.sub,
      action: 'CREATE',
      entityType: 'MenuImport',
      summary: `Imported menu: +${result.itemsCreated} items, ${result.itemsUpdated} updated`,
      ip: req.ip,
    });
    return sendSuccess(res, result);
  }),
);

// ─── Backup (download JSON) ──────────────────────────────────
router.get(
  '/backup',
  requirePermission('backup:manage'),
  asyncHandler(async (req, res) => {
    const snapshot = await backup.createBackup();
    recordActivity({ adminId: req.admin?.sub, action: 'CREATE', entityType: 'Backup', ip: req.ip });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rawaqan-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return res.send(JSON.stringify(snapshot, null, 2));
  }),
);

// ─── Restore (upload JSON) ───────────────────────────────────
router.post(
  '/backup/restore',
  requirePermission('backup:manage'),
  fileUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No backup file provided');
    let payload: unknown;
    try {
      payload = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      throw ApiError.badRequest('Invalid JSON backup file');
    }
    const result = await backup.restoreBackup(payload);
    recordActivity({
      adminId: req.admin?.sub,
      action: 'UPDATE',
      entityType: 'Backup',
      summary: `Restored backup: ${result.items} items, ${result.categories} categories`,
      ip: req.ip,
    });
    return sendSuccess(res, result);
  }),
);

export default router;
