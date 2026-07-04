import type { Response } from 'express';

/** Consistent success envelope: { success, data, meta? }. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function sendCreated<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return sendSuccess(res, data, 201, meta);
}

export function sendNoContent(res: Response) {
  return res.status(204).send();
}
