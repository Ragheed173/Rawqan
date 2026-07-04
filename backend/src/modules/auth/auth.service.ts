import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  ttlToMs,
} from '../../lib/tokens.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../../config/permissions.js';
import type { Admin } from '@prisma/client';

export interface SessionContext {
  userAgent?: string;
  ip?: string;
}

function publicAdmin(admin: Admin) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    roleLabel: ROLE_LABELS[admin.role],
    permissions: ROLE_PERMISSIONS[admin.role],
    lastLoginAt: admin.lastLoginAt,
  };
}

async function issueSession(admin: Admin, ctx: SessionContext) {
  const accessToken = signAccessToken({ sub: admin.id, email: admin.email, role: admin.role });
  const { raw, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));

  await prisma.refreshToken.create({
    data: { adminId: admin.id, tokenHash: hash, expiresAt, userAgent: ctx.userAgent, ip: ctx.ip },
  });

  return { accessToken, refreshToken: raw, refreshExpiresAt: expiresAt };
}

export async function login(email: string, password: string, ctx: SessionContext) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  // Constant-ish failure path — same error whether email or password is wrong.
  if (!admin || !admin.isActive || !(await verifyPassword(password, admin.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  const session = await issueSession(admin, ctx);
  return { admin: publicAdmin(admin), ...session };
}

/** Rotates a refresh token: validate → revoke old → issue new. */
export async function refresh(rawToken: string, ctx: SessionContext) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { admin: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid or expired session');
  }
  if (!existing.admin.isActive) throw ApiError.forbidden('Account disabled');

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const session = await issueSession(existing.admin, ctx);
  return { admin: publicAdmin(existing.admin), ...session };
}

export async function logout(rawToken?: string) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getProfile(adminId: string) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) throw ApiError.notFound('Admin not found');
  return publicAdmin(admin);
}
