import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '../src/utils/slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates Latin', () => {
    expect(slugify('Wagyu Steak')).toBe('wagyu-steak');
    expect(slugify('  Truffle   Pasta  ')).toBe('truffle-pasta');
  });

  it('preserves Arabic letters', () => {
    expect(slugify('ستيك واغيو')).toBe('ستيك-واغيو');
  });

  it('collapses separators and trims', () => {
    expect(slugify('a---b__c!!!')).toBe('a-b-c');
  });

  it('falls back for empty/symbol-only input', () => {
    expect(slugify('!!!')).toMatch(/^item-[a-z0-9]+$/);
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when unused', async () => {
    const s = await uniqueSlug('Best Seller', async () => false);
    expect(s).toBe('best-seller');
  });

  it('appends an incrementing suffix on collisions', async () => {
    const taken = new Set(['best-seller', 'best-seller-2']);
    const s = await uniqueSlug('Best Seller', async (candidate) => taken.has(candidate));
    expect(s).toBe('best-seller-3');
  });
});
