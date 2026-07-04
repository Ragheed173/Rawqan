import { Router } from 'express';
import { z } from 'zod';
import type { Admin } from '@prisma/client';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { recordActivity } from '../../lib/activityLog.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/http.js';
import { ROLE_LABELS } from '../../config/permissions.js';

const roleEnum = z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF']);

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
  role: roleEnum,
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const idParam = z.object({ id: z.string().cuid() });

function publicAdmin(a: Admin) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    roleLabel: ROLE_LABELS[a.role],
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
  };
}

const router = Router();
router.use(requireAuth, requirePermission('admin:manage'));

// Expose the role catalogue for the UI
router.get(
  '/roles',
  asyncHandler(async (_req, res) =>
    sendSuccess(
      res,
      Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    ),
  ),
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
    return sendSuccess(res, admins.map(publicAdmin));
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { email, name, password, role } = req.body as z.infer<typeof createSchema>;
    const passwordHash = await hashPassword(password);
    const admin = await prisma.admin.create({ data: { email, name, passwordHash, role } });
    recordActivity({
      adminId: req.admin?.sub,
      action: 'CREATE',
      entityType: 'Admin',
      entityId: admin.id,
      summary: `Created admin "${name}" (${role})`,
      ip: req.ip,
    });
    return sendCreated(res, publicAdmin(admin));
  }),
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = req.body as z.infer<typeof updateSchema>;

    // Guard: don't allow demoting/deactivating the last active super admin.
    if (body.role !== undefined || body.isActive === false) {
      const target = await prisma.admin.findUnique({ where: { id } });
      if (target?.role === 'SUPER_ADMIN') {
        const superAdmins = await prisma.admin.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
        const losingSuper = body.role !== undefined && body.role !== 'SUPER_ADMIN';
        const deactivating = body.isActive === false;
        if (superAdmins <= 1 && (losingSuper || deactivating)) {
          throw ApiError.badRequest('Cannot remove the last active super admin');
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const admin = await prisma.admin.update({ where: { id }, data });
    recordActivity({
      adminId: req.admin?.sub,
      action: 'UPDATE',
      entityType: 'Admin',
      entityId: id,
      summary: `Updated admin "${admin.name}"`,
      ip: req.ip,
    });
    return sendSuccess(res, publicAdmin(admin));
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (id === req.admin?.sub) throw ApiError.badRequest('You cannot delete your own account');
    const target = await prisma.admin.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound('Admin not found');
    if (target.role === 'SUPER_ADMIN') {
      const superAdmins = await prisma.admin.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
      if (superAdmins <= 1) throw ApiError.badRequest('Cannot delete the last super admin');
    }
    await prisma.admin.delete({ where: { id } });
    recordActivity({
      adminId: req.admin?.sub,
      action: 'DELETE',
      entityType: 'Admin',
      entityId: id,
      summary: `Deleted admin "${target.name}"`,
      ip: req.ip,
    });
    return sendNoContent(res);
  }),
);

export default router;
