import { describe, it, expect } from 'vitest';
import { serializeItem } from '../src/modules/menu/menu.serializers.js';

const DAY = 86_400_000;

// Minimal MenuItem-shaped fixture; serializeItem only reads scalar fields + relations.
function makeItem(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'i1',
    slug: 'item',
    categoryId: 'c1',
    name: 'صنف',
    nameEn: 'Item',
    description: null,
    descriptionEn: null,
    ingredients: null,
    price: 100,
    discountPrice: 80,
    calories: null,
    allergens: null,
    spiceLevel: 'NONE',
    isAvailable: true,
    isArchived: false,
    isFeatured: true,
    featuredFrom: null,
    featuredUntil: null,
    promoFrom: null,
    promoUntil: null,
    viewCount: 0,
    isBestSeller: false,
    isNew: false,
    isVegetarian: false,
    isChefRecommendation: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    tags: [],
  };
  return { ...base, ...overrides } as never;
}

describe('serializeItem — scheduled promo window (discountActive)', () => {
  it('discount active when no promo window set', () => {
    expect(serializeItem(makeItem()).discountActive).toBe(true);
  });

  it('discount inactive when promo window already ended', () => {
    const item = makeItem({ promoFrom: new Date(Date.now() - 2 * DAY), promoUntil: new Date(Date.now() - DAY) });
    expect(serializeItem(item).discountActive).toBe(false);
  });

  it('discount inactive when promo window has not started', () => {
    const item = makeItem({ promoFrom: new Date(Date.now() + DAY) });
    expect(serializeItem(item).discountActive).toBe(false);
  });

  it('discount inactive when there is no discount price', () => {
    expect(serializeItem(makeItem({ discountPrice: null })).discountActive).toBe(false);
  });
});

describe('serializeItem — scheduled featured window (featuredActive)', () => {
  it('featured active when flagged and no window', () => {
    expect(serializeItem(makeItem()).featuredActive).toBe(true);
  });

  it('featured inactive outside its window', () => {
    const item = makeItem({ featuredUntil: new Date(Date.now() - DAY) });
    expect(serializeItem(item).featuredActive).toBe(false);
  });

  it('not featured when flag is false regardless of window', () => {
    expect(serializeItem(makeItem({ isFeatured: false })).featuredActive).toBe(false);
  });
});

describe('serializeItem — image primary selection', () => {
  it('picks the isPrimary image, else the first by sortOrder', () => {
    const withPrimary = serializeItem(
      makeItem({
        images: [
          { id: 'a', url: 'a', alt: null, isPrimary: false, sortOrder: 1 },
          { id: 'b', url: 'b', alt: null, isPrimary: true, sortOrder: 2 },
        ],
      }),
    );
    expect(withPrimary.primaryImage?.id).toBe('b');

    const noPrimary = serializeItem(
      makeItem({
        images: [
          { id: 'x', url: 'x', alt: null, isPrimary: false, sortOrder: 2 },
          { id: 'y', url: 'y', alt: null, isPrimary: false, sortOrder: 1 },
        ],
      }),
    );
    expect(noPrimary.primaryImage?.id).toBe('y'); // lowest sortOrder
  });
});
