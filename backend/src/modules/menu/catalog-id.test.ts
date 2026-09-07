import { describe, expect, it } from 'vitest';
import { createItemSchema, updateItemSchema, listItemsQuerySchema, idParamSchema } from './item.schemas.js';
import { idParamSchema as categoryParams, reorderSchema } from './category.schemas.js';

describe('imported catalog identifiers', () => {
  it('accepts imported categories on creation, update, filtering and ordering', () => {
    expect(createItemSchema.safeParse({ categoryId: 'rawkaan-cat-392', name: 'وجبة', price: 15 }).success).toBe(true);
    expect(updateItemSchema.safeParse({ categoryId: 'rawkaan-cat-392' }).success).toBe(true);
    expect(listItemsQuerySchema.safeParse({ categoryId: 'rawkaan-cat-392' }).success).toBe(true);
    expect(categoryParams.safeParse({ id: 'rawkaan-cat-392' }).success).toBe(true);
    expect(reorderSchema.safeParse({ order: [{ id: 'rawkaan-cat-392', sortOrder: 0 }] }).success).toBe(true);
  });
  it('allows loading imported meals for editing while retaining CUID support', () => {
    expect(idParamSchema.safeParse({ id: 'rawkaan-item-123' }).success).toBe(true);
    expect(idParamSchema.safeParse({ id: 'clh12345678901234567890123' }).success).toBe(true);
  });
  it('rejects arbitrary identifiers and identifiers of the wrong entity', () => {
    for (const id of ['', '../items', 'rawkaan-cat-392', 'rawkaan-item-abc']) {
      expect(idParamSchema.safeParse({ id }).success).toBe(false);
    }
  });
});
