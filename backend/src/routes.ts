import { Router } from 'express';
import authRouter from './modules/auth/auth.routes.js';
import { publicCategoryRouter, adminCategoryRouter } from './modules/menu/category.routes.js';
import { publicItemRouter, adminItemRouter } from './modules/menu/item.routes.js';
import { publicTagRouter, adminTagRouter } from './modules/menu/tag.routes.js';
import { publicSettingsRouter, adminSettingsRouter } from './modules/settings/settings.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';
import uploadRouter from './modules/upload/upload.routes.js';
import { publicQrRouter, adminQrRouter } from './modules/qr/qr.routes.js';
import adminsRouter from './modules/admins/admins.routes.js';
import { publicAnalyticsRouter, adminAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import dataRouter from './modules/data/data.routes.js';
import logsRouter from './modules/logs/logs.routes.js';

export const apiRouter = Router();

// ─── Public API ──────────────────────────────────────────────
apiRouter.use('/auth', authRouter);
apiRouter.use('/categories', publicCategoryRouter);
apiRouter.use('/items', publicItemRouter);
apiRouter.use('/tags', publicTagRouter);
apiRouter.use('/settings', publicSettingsRouter);
apiRouter.use('/qr', publicQrRouter);
apiRouter.use('/analytics', publicAnalyticsRouter);

// ─── Admin API (each router self-guards with requireAuth) ────
apiRouter.use('/admin/categories', adminCategoryRouter);
apiRouter.use('/admin/items', adminItemRouter);
apiRouter.use('/admin/tags', adminTagRouter);
apiRouter.use('/admin/settings', adminSettingsRouter);
apiRouter.use('/admin/dashboard', dashboardRouter);
apiRouter.use('/admin/uploads', uploadRouter);
apiRouter.use('/admin/qr', adminQrRouter);
apiRouter.use('/admin/admins', adminsRouter);
apiRouter.use('/admin/analytics', adminAnalyticsRouter);
apiRouter.use('/admin/menu', dataRouter);
apiRouter.use('/admin/logs', logsRouter);
