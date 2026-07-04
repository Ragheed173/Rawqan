import type { Request, Response } from 'express';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/http.js';
import { recordActivity } from '../../lib/activityLog.js';
import * as service from './category.service.js';
import { serializeCategory } from './menu.serializers.js';

export async function listPublic(_req: Request, res: Response) {
  const categories = await service.listPublic();
  return sendSuccess(res, categories.map(serializeCategory));
}

export async function listAdmin(_req: Request, res: Response) {
  const categories = await service.listAdmin();
  return sendSuccess(res, categories.map(serializeCategory));
}

export async function getById(req: Request, res: Response) {
  const category = await service.getById(req.params.id);
  return sendSuccess(res, serializeCategory(category));
}

export async function create(req: Request, res: Response) {
  const category = await service.create(req.body);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'CREATE',
    entityType: 'Category',
    entityId: category.id,
    summary: `Created category "${category.name}"`,
    ip: req.ip,
  });
  return sendCreated(res, serializeCategory(category));
}

export async function update(req: Request, res: Response) {
  const category = await service.update(req.params.id, req.body);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'UPDATE',
    entityType: 'Category',
    entityId: category.id,
    summary: `Updated category "${category.name}"`,
    ip: req.ip,
  });
  return sendSuccess(res, serializeCategory(category));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'DELETE',
    entityType: 'Category',
    entityId: req.params.id,
    ip: req.ip,
  });
  return sendNoContent(res);
}

export async function reorder(req: Request, res: Response) {
  const categories = await service.reorder(req.body.order);
  return sendSuccess(res, categories.map(serializeCategory));
}
