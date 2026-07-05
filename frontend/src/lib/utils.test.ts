import { describe, it, expect } from 'vitest';
import { cn, formatPrice, discountPercent } from './utils';

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4'); // later wins
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});

describe('formatPrice', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(undefined)).toBe('');
  });

  it('formats a number with a currency, no fractional digits (locale-agnostic)', () => {
    const out = formatPrice(120, 'EGP');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/[.,]\d0/); // no ".00" / trailing cents
    // Different amounts must format differently.
    expect(formatPrice(120, 'EGP')).not.toBe(formatPrice(999, 'EGP'));
  });
});

describe('discountPercent', () => {
  it('computes the rounded percentage off', () => {
    expect(discountPercent(100, 80)).toBe(20);
    expect(discountPercent(690, 780 >= 690 ? undefined : 780)).toBeNull();
  });

  it('returns null when there is no valid discount', () => {
    expect(discountPercent(100)).toBeNull();
    expect(discountPercent(100, null)).toBeNull();
    expect(discountPercent(100, 100)).toBeNull(); // not lower
    expect(discountPercent(100, 120)).toBeNull(); // higher than price
  });
});
