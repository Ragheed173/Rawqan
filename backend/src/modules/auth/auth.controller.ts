import type { Request, Response } from 'express';
import { env, isProd } from '../../config/env.js';
import { ttlToMs } from '../../lib/tokens.js';
import { recordActivity } from '../../lib/activityLog.js';
import { sendSuccess } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import * as authService from './auth.service.js';

const REFRESH_COOKIE = 'rawaqan_rt';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: ttlToMs(env.JWT_REFRESH_TTL),
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

function sessionCtx(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const result = await authService.login(email, password, sessionCtx(req));
  setRefreshCookie(res, result.refreshToken);
  recordActivity({
    adminId: result.admin.id,
    action: 'LOGIN',
    entityType: 'Admin',
    entityId: result.admin.id,
    ip: req.ip,
  });
  return sendSuccess(res, { admin: result.admin, accessToken: result.accessToken });
}

export async function refresh(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!raw) throw ApiError.unauthorized('No active session');
  const result = await authService.refresh(raw, sessionCtx(req));
  setRefreshCookie(res, result.refreshToken);
  return sendSuccess(res, { admin: result.admin, accessToken: result.accessToken });
}

export async function logout(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(raw);
  clearRefreshCookie(res);
  if (req.admin) {
    recordActivity({ adminId: req.admin.sub, action: 'LOGOUT', entityType: 'Admin', ip: req.ip });
  }
  return sendSuccess(res, { message: 'Logged out' });
}

export async function me(req: Request, res: Response) {
  const profile = await authService.getProfile(req.admin!.sub);
  return sendSuccess(res, profile);
}
