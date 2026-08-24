import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { recordCatalogChange } from "../menu/catalogRevision.js";

export const BACKUP_KIND = "rawaqan.menu-settings" as const;
export const BACKUP_VERSION = 2 as const;
export const BACKUP_SCOPE = "MENU_SETTINGS_ONLY" as const;
export const BACKUP_EXCLUDED_DOMAINS = [
  "AUTH",
  "AUDIT",
  "ANALYTICS",
  "POS_OPERATIONAL",
  "POS_FINANCIAL",
] as const;

/**
 * Portable JSON snapshot of the menu domain + settings (Task 22). Operational
 * tables (admins, tokens, logs, analytics) are intentionally excluded so a
 * backup can be shared/restored safely without leaking credentials.
 */
export async function createBackup() {
  const [settings, openingHours, categories, items, images, tags, itemTags, modifierGroups, modifierOptions, menuItemModifierGroups] =
    await Promise.all([
      prisma.restaurantSettings.findFirst(),
      prisma.openingHour.findMany(),
      prisma.category.findMany(),
      prisma.menuItem.findMany(),
      prisma.itemImage.findMany(),
      prisma.tag.findMany(),
      prisma.itemTag.findMany(),
      prisma.modifierGroup.findMany(),
      prisma.modifierOption.findMany(),
      prisma.menuItemModifierGroup.findMany(),
    ]);

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    scope: BACKUP_SCOPE,
    excludedDomains: BACKUP_EXCLUDED_DOMAINS,
    createdAt: new Date().toISOString(),
    data: { settings, openingHours, categories, items, images, tags, itemTags, modifierGroups, modifierOptions, menuItemModifierGroups },
  };
}

const backupDataSchema = z.object({
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  openingHours: z.array(z.record(z.string(), z.unknown())),
  categories: z.array(z.record(z.string(), z.unknown())),
  items: z.array(z.record(z.string(), z.unknown())),
  images: z.array(z.record(z.string(), z.unknown())),
  tags: z.array(z.record(z.string(), z.unknown())),
  itemTags: z.array(z.record(z.string(), z.unknown())),
  modifierGroups: z.array(z.record(z.string(), z.unknown())).default([]),
  modifierOptions: z.array(z.record(z.string(), z.unknown())).default([]),
  menuItemModifierGroups: z.array(z.record(z.string(), z.unknown())).default([]),
});

const legacyBackupSchema = z.object({
  version: z.literal(1),
  data: backupDataSchema,
});

const menuSettingsBackupSchema = z.object({
  kind: z.literal(BACKUP_KIND),
  version: z.literal(BACKUP_VERSION),
  scope: z.literal(BACKUP_SCOPE),
  excludedDomains: z
    .array(z.string())
    .refine(
      (domains) => domains.includes("POS_FINANCIAL"),
      "POS_FINANCIAL must be excluded",
    ),
  createdAt: z.string().datetime(),
  data: backupDataSchema,
});

export type BackupData = z.infer<typeof backupDataSchema>;

/** Parses v2 menu/settings backups while preserving restore support for v1. */
export function parseBackupPayload(payload: unknown): BackupData {
  const envelope = z
    .union([legacyBackupSchema, menuSettingsBackupSchema])
    .parse(payload);
  return envelope.data;
}

export interface RestoreResult {
  categories: number;
  items: number;
  images: number;
  tags: number;
  modifierGroups: number;
  modifierOptions: number;
  menuItemModifierGroups: number;
}

/**
 * Restores a snapshot. Wipes the menu domain + settings and recreates them in a
 * single transaction so a failed restore rolls back cleanly.
 */
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  const { settings, openingHours, categories, items, images, tags, itemTags, modifierGroups, modifierOptions, menuItemModifierGroups } =
    parseBackupPayload(payload);

  return prisma.$transaction(async (tx) => {
    // Delete in FK-safe order (children first).
    await tx.menuItemModifierGroup.deleteMany();
    await tx.modifierOption.deleteMany();
    await tx.modifierGroup.deleteMany();
    await tx.itemTag.deleteMany();
    await tx.itemImage.deleteMany();
    await tx.menuItem.deleteMany();
    await tx.category.deleteMany();
    await tx.tag.deleteMany();
    await tx.openingHour.deleteMany();
    await tx.restaurantSettings.deleteMany();

    if (settings)
      await tx.restaurantSettings.create({ data: settings as never });
    if (openingHours.length)
      await tx.openingHour.createMany({ data: openingHours as never[] });
    if (tags.length) await tx.tag.createMany({ data: tags as never[] });
    if (categories.length)
      await tx.category.createMany({ data: categories as never[] });
    if (items.length) await tx.menuItem.createMany({ data: items as never[] });
    if (images.length)
      await tx.itemImage.createMany({ data: images as never[] });
    if (itemTags.length)
      await tx.itemTag.createMany({ data: itemTags as never[] });
    if (modifierGroups.length) await tx.modifierGroup.createMany({ data: modifierGroups as never[] });
    if (modifierOptions.length) await tx.modifierOption.createMany({ data: modifierOptions as never[] });
    if (menuItemModifierGroups.length) await tx.menuItemModifierGroup.createMany({ data: menuItemModifierGroups as never[] });

    // One global revision tells future POS clients to replace their catalog
    // snapshot after a destructive menu/settings restore.
    await recordCatalogChange(tx, {
      entityType: "Catalog",
      entityId: "menu-settings",
      action: "RESTORED",
      payload: { backupVersion: BACKUP_VERSION },
    });

    return {
      categories: categories.length,
      items: items.length,
      images: images.length,
      tags: tags.length,
      modifierGroups: modifierGroups.length,
      modifierOptions: modifierOptions.length,
      menuItemModifierGroups: menuItemModifierGroups.length,
    };
  });
}
