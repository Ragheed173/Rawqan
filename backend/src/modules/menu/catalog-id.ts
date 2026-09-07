import { z } from 'zod';

// The imported restaurant catalog uses stable IDs alongside Prisma CUIDs.
export const categoryIdSchema = z.union([z.string().cuid(), z.string().regex(/^rawkaan-cat-\d+$/)]);
export const itemIdSchema = z.union([z.string().cuid(), z.string().regex(/^rawkaan-item-\d+$/)]);
export const imageIdSchema = z.union([z.string().cuid(), z.string().regex(/^rawkaan-image-\d+$/)]);
