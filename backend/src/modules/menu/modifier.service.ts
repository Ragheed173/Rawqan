import type { ModifierGroupType, ModifierPriceType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { recordCatalogChange } from "./catalogRevision.js";

const groupInclude = {
  options: { orderBy: { sortOrder: "asc" as const } },
  menuItems: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.ModifierGroupInclude;

export interface ModifierGroupInput {
  type: ModifierGroupType;
  name: string;
  nameEn?: string | null;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ModifierOptionInput {
  name: string;
  nameEn?: string | null;
  priceType?: ModifierPriceType;
  price?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export function listModifierGroups() {
  return prisma.modifierGroup.findMany({
    include: groupInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export function createModifierGroup(input: ModifierGroupInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.modifierGroup.create({ data: input, include: groupInclude });
    await recordCatalogChange(tx, {
      entityType: "ModifierGroup",
      entityId: group.id,
      action: "CREATED",
      payload: { type: group.type, name: group.name },
    });
    return group;
  });
}

export async function updateModifierGroup(id: string, input: Partial<ModifierGroupInput>) {
  const current = await prisma.modifierGroup.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound("Modifier group not found");
  return prisma.$transaction(async (tx) => {
    const group = await tx.modifierGroup.update({ where: { id }, data: input, include: groupInclude });
    const action = current.isActive && group.isActive === false ? "DEACTIVATED" : !current.isActive && group.isActive ? "RESTORED" : "UPDATED";
    await recordCatalogChange(tx, {
      entityType: "ModifierGroup",
      entityId: id,
      action,
      payload: { type: group.type, name: group.name },
    });
    return group;
  });
}

export async function deactivateModifierGroup(id: string) {
  const current = await prisma.modifierGroup.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound("Modifier group not found");
  return prisma.$transaction(async (tx) => {
    await tx.modifierOption.updateMany({ where: { groupId: id }, data: { isActive: false } });
    const group = await tx.modifierGroup.update({ where: { id }, data: { isActive: false }, include: groupInclude });
    await recordCatalogChange(tx, {
      entityType: "ModifierGroup",
      entityId: id,
      action: "DEACTIVATED",
      payload: { optionIds: group.options.map((option) => option.id) },
    });
    return group;
  });
}

export async function createModifierOption(groupId: string, input: ModifierOptionInput) {
  const group = await prisma.modifierGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw ApiError.notFound("Modifier group not found");
  return prisma.$transaction(async (tx) => {
    const option = await tx.modifierOption.create({ data: { ...input, groupId } });
    await recordCatalogChange(tx, {
      entityType: "ModifierOption",
      entityId: option.id,
      action: "CREATED",
      payload: { groupId },
    });
    return option;
  });
}

export async function updateModifierOption(id: string, input: Partial<ModifierOptionInput>) {
  const current = await prisma.modifierOption.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound("Modifier option not found");
  return prisma.$transaction(async (tx) => {
    const option = await tx.modifierOption.update({ where: { id }, data: input });
    const action = current.isActive && option.isActive === false ? "DEACTIVATED" : !current.isActive && option.isActive ? "RESTORED" : "UPDATED";
    await recordCatalogChange(tx, {
      entityType: "ModifierOption",
      entityId: id,
      action,
      payload: { groupId: option.groupId },
    });
    return option;
  });
}

export async function deactivateModifierOption(id: string) {
  const current = await prisma.modifierOption.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound("Modifier option not found");
  return updateModifierOption(id, { isActive: false });
}

export async function replaceMenuItemModifierGroups(
  menuItemId: string,
  assignments: { groupId: string; sortOrder: number }[],
) {
  const [item, groups] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { id: true } }),
    prisma.modifierGroup.findMany({ where: { id: { in: assignments.map((assignment) => assignment.groupId) } }, select: { id: true } }),
  ]);
  if (!item) throw ApiError.notFound("Item not found");
  if (groups.length !== new Set(assignments.map((assignment) => assignment.groupId)).size) {
    throw ApiError.badRequest("One or more modifier groups do not exist");
  }
  return prisma.$transaction(async (tx) => {
    await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId } });
    if (assignments.length) {
      await tx.menuItemModifierGroup.createMany({
        data: assignments.map((assignment) => ({ menuItemId, ...assignment })),
      });
    }
    await recordCatalogChange(tx, {
      entityType: "MenuItemModifierGroup",
      entityId: menuItemId,
      action: "UPDATED",
      payload: { assignments },
    });
    return tx.menuItemModifierGroup.findMany({ where: { menuItemId }, orderBy: { sortOrder: "asc" } });
  });
}
