import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const BACKUP_VERSION = 1;

/**
 * Portable JSON snapshot of the menu domain + settings (Task 22). Operational
 * tables (admins, tokens, logs, analytics) are intentionally excluded so a
 * backup can be shared/restored safely without leaking credentials.
 */
export async function createBackup() {
  const [settings, openingHours, categories, items, images, tags, itemTags] = await Promise.all([
    prisma.restaurantSettings.findFirst(),
    prisma.openingHour.findMany(),
    prisma.category.findMany(),
    prisma.menuItem.findMany(),
    prisma.itemImage.findMany(),
    prisma.tag.findMany(),
    prisma.itemTag.findMany(),
  ]);

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: { settings, openingHours, categories, items, images, tags, itemTags },
  };
}

// Loose validation — we trust our own export shape but guard the envelope.
const backupSchema = z.object({
  version: z.number(),
  data: z.object({
    settings: z.record(z.string(), z.unknown()).nullable().optional(),
    openingHours: z.array(z.record(z.string(), z.unknown())),
    categories: z.array(z.record(z.string(), z.unknown())),
    items: z.array(z.record(z.string(), z.unknown())),
    images: z.array(z.record(z.string(), z.unknown())),
    tags: z.array(z.record(z.string(), z.unknown())),
    itemTags: z.array(z.record(z.string(), z.unknown())),
  }),
});

export interface RestoreResult {
  categories: number;
  items: number;
  images: number;
  tags: number;
}

/**
 * Restores a snapshot. Wipes the menu domain + settings and recreates them in a
 * single transaction so a failed restore rolls back cleanly.
 */
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  const parsed = backupSchema.parse(payload);
  const { settings, openingHours, categories, items, images, tags, itemTags } = parsed.data;

  return prisma.$transaction(async (tx) => {
    // Delete in FK-safe order (children first).
    await tx.itemTag.deleteMany();
    await tx.itemImage.deleteMany();
    await tx.menuItem.deleteMany();
    await tx.category.deleteMany();
    await tx.tag.deleteMany();
    await tx.openingHour.deleteMany();
    await tx.restaurantSettings.deleteMany();

    if (settings) await tx.restaurantSettings.create({ data: settings as never });
    if (openingHours.length) await tx.openingHour.createMany({ data: openingHours as never[] });
    if (tags.length) await tx.tag.createMany({ data: tags as never[] });
    if (categories.length) await tx.category.createMany({ data: categories as never[] });
    if (items.length) await tx.menuItem.createMany({ data: items as never[] });
    if (images.length) await tx.itemImage.createMany({ data: images as never[] });
    if (itemTags.length) await tx.itemTag.createMany({ data: itemTags as never[] });

    return {
      categories: categories.length,
      items: items.length,
      images: images.length,
      tags: tags.length,
    };
  });
}
