import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/http.js';
import { recordActivity } from '../../lib/activityLog.js';
import * as service from './settings.service.js';

export async function get(_req: Request, res: Response) {
  return sendSuccess(res, await service.get());
}

export async function update(req: Request, res: Response) {
  const settings = await service.update(req.body);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'UPDATE',
    entityType: 'RestaurantSettings',
    entityId: settings.id,
    summary: 'Updated restaurant settings',
    ip: req.ip,
  });
  return sendSuccess(res, settings);
}

export async function updateHours(req: Request, res: Response) {
  const settings = await service.updateHours(req.body);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'UPDATE',
    entityType: 'OpeningHours',
    summary: 'Updated opening hours',
    ip: req.ip,
  });
  return sendSuccess(res, settings);
}
