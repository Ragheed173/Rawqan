import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  nameEn: z.string().max(120).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  imagePublicId: z.string().max(300).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const reorderSchema = z.object({
  order: z.array(z.object({ id: z.string().cuid(), sortOrder: z.number().int() })).min(1),
});

export const idParamSchema = z.object({ id: z.string().cuid() });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
