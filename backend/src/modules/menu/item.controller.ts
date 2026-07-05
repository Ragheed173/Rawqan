import type { Request, Response } from 'express';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/http.js';
import { recordActivity } from '../../lib/activityLog.js';
import * as service from './item.service.js';
import { track } from '../analytics/analytics.service.js';
import { serializeItem } from './menu.serializers.js';

export async function listPublic(req: Request, res: Response) {
  const items = await service.listPublic(req.query as never);
  return sendSuccess(res, items.map(serializeItem));
}

export async function getPublicBySlug(req: Request, res: Response) {
  const item = await service.getPublicBySlug(req.params.slug);
  const related = await service.getRelated(item);
  track({
    type: 'ITEM_VIEW',
    itemId: item.id,
    categoryId: item.categoryId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, { ...serializeItem(item), related: related.map(serializeItem) });
}

export async function listAdmin(req: Request, res: Response) {
  const { data, total, page, pageSize } = await service.listAdmin(req.query as never);
  return sendSuccess(res, data.map(serializeItem), 200, {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function getById(req: Request, res: Response) {
  const item = await service.getById(req.params.id);
  return sendSuccess(res, serializeItem(item));
}

export async function create(req: Request, res: Response) {
  const item = await service.create(req.body);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'CREATE',
    entityType: 'MenuItem',
    entityId: item.id,
    summary: `Created meal "${item.name}"`,
    ip: req.ip,
  });
  return sendCreated(res, serializeItem(item));
}

export async function update(req: Request, res: Response) {
  const item = await service.update(req.params.id, req.body);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'UPDATE',
    entityType: 'MenuItem',
    entityId: item.id,
    summary: `Updated meal "${item.name}"`,
    ip: req.ip,
  });
  return sendSuccess(res, serializeItem(item));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'DELETE',
    entityType: 'MenuItem',
    entityId: req.params.id,
    ip: req.ip,
  });
  return sendNoContent(res);
}

export async function duplicate(req: Request, res: Response) {
  const item = await service.duplicate(req.params.id);
  recordActivity({
    adminId: req.admin?.sub,
    action: 'CREATE',
    entityType: 'MenuItem',
    entityId: item.id,
    summary: `Duplicated meal into "${item.name}"`,
    ip: req.ip,
  });
  return sendCreated(res, serializeItem(item));
}
