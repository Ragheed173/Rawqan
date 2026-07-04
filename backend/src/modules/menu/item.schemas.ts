import { z } from 'zod';

const spice = z.enum(['NONE', 'MILD', 'MEDIUM', 'HOT']);

export const createItemSchema = z.object({
  categoryId: z.string().cuid(),
  name: z.string().min(1).max(160),
  nameEn: z.string().max(160).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  descriptionEn: z.string().max(2000).optional().nullable(),
  ingredients: z.string().max(2000).optional().nullable(),
  price: z.number().nonnegative(),
  discountPrice: z.number().nonnegative().optional().nullable(),
  calories: z.number().int().nonnegative().optional().nullable(),
  allergens: z.string().max(500).optional().nullable(),
  spiceLevel: spice.optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  isChefRecommendation: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  featuredFrom: z.coerce.date().optional().nullable(),
  featuredUntil: z.coerce.date().optional().nullable(),
  promoFrom: z.coerce.date().optional().nullable(),
  promoUntil: z.coerce.date().optional().nullable(),
  sortOrder: z.number().int().optional(),
  tagIds: z.array(z.string().cuid()).optional(),
})
  .refine((d) => d.discountPrice == null || d.discountPrice < d.price, {
    message: 'Discount price must be lower than the base price',
    path: ['discountPrice'],
  });

export const updateItemSchema = z
  .object({
    categoryId: z.string().cuid().optional(),
    name: z.string().min(1).max(160).optional(),
    nameEn: z.string().max(160).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    descriptionEn: z.string().max(2000).optional().nullable(),
    ingredients: z.string().max(2000).optional().nullable(),
    price: z.number().nonnegative().optional(),
    discountPrice: z.number().nonnegative().optional().nullable(),
    calories: z.number().int().nonnegative().optional().nullable(),
    allergens: z.string().max(500).optional().nullable(),
    spiceLevel: spice.optional(),
    isAvailable: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isBestSeller: z.boolean().optional(),
    isNew: z.boolean().optional(),
    isVegetarian: z.boolean().optional(),
    isChefRecommendation: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    featuredFrom: z.coerce.date().optional().nullable(),
    featuredUntil: z.coerce.date().optional().nullable(),
    promoFrom: z.coerce.date().optional().nullable(),
    promoUntil: z.coerce.date().optional().nullable(),
    sortOrder: z.number().int().optional(),
    tagIds: z.array(z.string().cuid()).optional(),
  });

/**
 * Query-string boolean. `z.coerce.boolean()` is WRONG for query params because
 * `Boolean("false") === true` (any non-empty string is truthy) — so `?archived=false`
 * would parse as `true`. This maps the literal strings instead.
 */
const queryBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1')
  .optional();

export const listItemsQuerySchema = z.object({
  categoryId: z.string().cuid().optional(),
  search: z.string().max(120).optional(),
  featured: queryBool,
  bestSeller: queryBool,
  isNew: queryBool,
  vegetarian: queryBool,
  archived: queryBool,
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'newest', 'name']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const idParamSchema = z.object({ id: z.string().cuid() });
export const slugParamSchema = z.object({ slug: z.string().min(1) });

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
