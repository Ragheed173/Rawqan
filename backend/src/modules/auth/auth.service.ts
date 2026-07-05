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
import { failureUpdate, lockRemainingMs, type LockoutConfig } from './lockout.js';
import type { Admin } from '@prisma/client';

const LOCKOUT: LockoutConfig = {
  maxAttempts: env.LOGIN_MAX_ATTEMPTS,
  lockMs: env.LOGIN_LOCK_MINUTES * 60_000,
};

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
  const now = new Date();

  // Locked account: reject before touching the password to avoid probing.
  if (admin) {
    const remainingMs = lockRemainingMs(admin.lockedUntil, now);
    if (remainingMs > 0) {
      const minutes = Math.ceil(remainingMs / 60_000);
      throw ApiError.tooMany(`Account locked. Try again in ${minutes} minute(s).`);
    }
  }

  // Constant-ish failure path — same error whether email or password is wrong.
  const authenticated =
    admin && admin.isActive && (await verifyPassword(password, admin.passwordHash));
  if (!authenticated) {
    // Count failures for existing accounts so repeated guesses trip the lock.
    if (admin) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: failureUpdate(admin.failedLoginAttempts, LOCKOUT, now),
      });
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Success clears any accumulated failures / lock.
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: now, failedLoginAttempts: 0, lockedUntil: null },
  });
  pruneRefreshTokens(); // opportunistic cleanup
  const session = await issueSession(admin, ctx);
  return { admin: publicAdmin(admin), ...session };
}

/**
 * Rotates a refresh token: validate → revoke old → issue new.
 * Reuse detection: presenting an already-revoked token means a rotated token was
 * replayed (likely theft) — respond by revoking ALL of that admin's sessions.
 */
export async function refresh(rawToken: string, ctx: SessionContext) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { admin: true },
  });

  if (!existing) throw ApiError.unauthorized('Invalid or expired session');

  if (existing.revokedAt) {
    // Token reuse → breach signal. Kill every active session for this admin.
    await prisma.refreshToken.updateMany({
      where: { adminId: existing.adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Session revoked — please sign in again');
  }

  if (existing.expiresAt < new Date()) throw ApiError.unauthorized('Invalid or expired session');
  if (!existing.admin.isActive) throw ApiError.forbidden('Account disabled');

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const session = await issueSession(existing.admin, ctx);
  return { admin: publicAdmin(existing.admin), ...session };
}

/**
 * Prunes expired tokens and long-revoked ones. Fire-and-forget from the login
 * path so the table doesn't grow unbounded (no cron needed for a single venue).
 */
export function pruneRefreshTokens(): void {
  const revokedCutoff = new Date(Date.now() - 7 * 86_400_000); // keep revoked 7d for reuse detection
  prisma.refreshToken
    .deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: revokedCutoff } }],
      },
    })
    .catch((err) => console.error('[auth] token prune failed:', err));
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
