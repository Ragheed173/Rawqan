/**
 * Per-account brute-force lockout (pure logic, no I/O — unit-testable).
 *
 * After `maxAttempts` consecutive failed logins an account is locked for
 * `lockMs`. Complements the IP-based rate limiter: the limiter throttles a
 * single origin, this stops distributed credential-stuffing against one account.
 */
export interface LockoutConfig {
  maxAttempts: number;
  lockMs: number;
}

/** Milliseconds still remaining on a lock, or 0 if not locked. */
export function lockRemainingMs(lockedUntil: Date | null, now: Date): number {
  if (!lockedUntil) return 0;
  const remaining = lockedUntil.getTime() - now.getTime();
  return remaining > 0 ? remaining : 0;
}

/**
 * The Admin fields to persist after a failed attempt. Reaching the threshold
 * arms the lock and resets the counter (so the next window starts clean).
 */
export function failureUpdate(
  currentAttempts: number,
  cfg: LockoutConfig,
  now: Date,
): { failedLoginAttempts: number; lockedUntil: Date | null } {
  const attempts = currentAttempts + 1;
  if (attempts >= cfg.maxAttempts) {
    return { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + cfg.lockMs) };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null };
}
