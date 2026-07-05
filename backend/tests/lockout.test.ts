import { describe, it, expect } from 'vitest';
import { lockRemainingMs, failureUpdate, type LockoutConfig } from '../src/modules/auth/lockout.js';

const cfg: LockoutConfig = { maxAttempts: 5, lockMs: 15 * 60_000 };
const now = new Date('2026-07-05T12:00:00.000Z');

describe('lockRemainingMs', () => {
  it('returns 0 when never locked', () => {
    expect(lockRemainingMs(null, now)).toBe(0);
  });

  it('returns 0 when the lock has expired', () => {
    expect(lockRemainingMs(new Date(now.getTime() - 1000), now)).toBe(0);
  });

  it('returns remaining ms while locked', () => {
    expect(lockRemainingMs(new Date(now.getTime() + 60_000), now)).toBe(60_000);
  });
});

describe('failureUpdate', () => {
  it('increments below the threshold without locking', () => {
    expect(failureUpdate(0, cfg, now)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
    expect(failureUpdate(3, cfg, now)).toEqual({ failedLoginAttempts: 4, lockedUntil: null });
  });

  it('locks and resets the counter on the Nth failure', () => {
    const out = failureUpdate(4, cfg, now); // 5th attempt
    expect(out.failedLoginAttempts).toBe(0);
    expect(out.lockedUntil).toEqual(new Date(now.getTime() + cfg.lockMs));
  });

  it('locks immediately when maxAttempts is 1', () => {
    const out = failureUpdate(0, { maxAttempts: 1, lockMs: 1000 }, now);
    expect(out.lockedUntil).toEqual(new Date(now.getTime() + 1000));
  });
});
