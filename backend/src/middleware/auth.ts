import type { RequestHandler } from 'express';
import type { AdminRole } from '@prisma/client';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { roleHas, type Permission } from '../config/permissions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AccessTokenPayload;
    }
  }
}

/** Requires a valid Bearer access token; attaches the decoded admin to req. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }
  const token = header.slice(7);
  try {
    req.admin = verifyAccessToken(token);
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};

/** Restricts a route to specific admin roles. Use after requireAuth. */
export const requireRole =
  (...roles: AdminRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.admin) return next(ApiError.unauthorized());
    if (!roles.includes(req.admin.role)) return next(ApiError.forbidden('Insufficient role'));
    next();
  };

/** Restricts a route to holders of a permission (Task 22 RBAC). Use after requireAuth. */
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.admin) return next(ApiError.unauthorized());
    if (!roleHas(req.admin.role, permission)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
