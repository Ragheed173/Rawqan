import { describe, it, expect } from 'vitest';
import { ttlToMs, hashToken, generateRefreshToken } from '../src/lib/tokens.js';

describe('ttlToMs', () => {
  it('parses common TTL strings', () => {
    expect(ttlToMs('15m')).toBe(900_000);
    expect(ttlToMs('7d')).toBe(604_800_000);
    expect(ttlToMs('1h')).toBe(3_600_000);
    expect(ttlToMs('30s')).toBe(30_000);
  });

  it('returns 0 for malformed input', () => {
    expect(ttlToMs('nonsense')).toBe(0);
    expect(ttlToMs('')).toBe(0);
  });
});

describe('refresh token hashing', () => {
  it('hashToken is deterministic and non-reversible-looking', () => {
    const h1 = hashToken('abc');
    const h2 = hashToken('abc');
    expect(h1).toBe(h2);
    expect(h1).not.toBe('abc');
    expect(h1).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it('generateRefreshToken returns a raw + matching hash, unique each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.hash).toBe(hashToken(a.raw));
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});
