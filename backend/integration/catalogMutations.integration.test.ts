import crypto from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import * as modifierService from "../src/modules/menu/modifier.service.js";
import * as itemService from "../src/modules/menu/item.service.js";

const entityIds = new Set<string>();
let categoryId: string | undefined;
let itemId: string | undefined;
let tagId: string | undefined;
let groupId: string | undefined;

afterEach(async () => {
  if (itemId) await prisma.menuItem.deleteMany({ where: { id: itemId } });
  if (tagId) await prisma.tag.deleteMany({ where: { id: tagId } });
  if (groupId) {
    await prisma.modifierOption.deleteMany({ where: { groupId } });
    await prisma.modifierGroup.deleteMany({ where: { id: groupId } });
  }
  if (categoryId)
    await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.catalogChange.deleteMany({
    where: { entityId: { in: [...entityIds] } },
  });
  entityIds.clear();
  categoryId = undefined;
  itemId = undefined;
  tagId = undefined;
  groupId = undefined;
});

afterAll(async () => prisma.$disconnect());

describe("catalog mutation revision coverage", () => {
  it("emits one append-only change per logical modifier and assignment mutation", async () => {
    const suffix = crypto.randomUUID();
    const category = await prisma.category.create({
      data: { slug: `catalog-${suffix}`, name: "Catalog integration" },
    });
    categoryId = category.id;
    const item = await prisma.menuItem.create({
      data: {
        categoryId: category.id,
        slug: `item-${suffix}`,
        name: "Integration item",
        price: "10.00",
      },
    });
    itemId = item.id;
    entityIds.add(item.id);

    const group = await modifierService.createModifierGroup({
      type: "ADD_ON",
      name: "Extras",
      maxSelections: 2,
    });
    groupId = group.id;
    entityIds.add(group.id);
    const option = await modifierService.createModifierOption(group.id, {
      name: "Cheese",
      price: "2.00",
    });
    entityIds.add(option.id);
    await modifierService.updateModifierOption(option.id, {
      name: "Extra cheese",
    });
    await modifierService.replaceMenuItemModifierGroups(item.id, [
      { groupId: group.id, sortOrder: 0 },
    ]);
    await modifierService.deactivateModifierGroup(group.id);

    const changes = await prisma.catalogChange.findMany({
      where: { entityId: { in: [group.id, option.id, item.id] } },
      orderBy: { revision: "asc" },
    });
    expect(
      changes.map(({ entityType, action }) => ({ entityType, action })),
    ).toEqual([
      { entityType: "ModifierGroup", action: "CREATED" },
      { entityType: "ModifierOption", action: "CREATED" },
      { entityType: "ModifierOption", action: "UPDATED" },
      { entityType: "MenuItemModifierGroup", action: "UPDATED" },
      { entityType: "ModifierGroup", action: "DEACTIVATED" },
    ]);
    expect(
      await prisma.modifierGroup.findUnique({
        where: { id: group.id },
        select: { isActive: true },
      }),
    ).toEqual({ isActive: false });
    expect(
      await prisma.modifierOption.findUnique({
        where: { id: option.id },
        select: { isActive: true },
      }),
    ).toEqual({ isActive: false });
    expect(
      await prisma.menuItemModifierGroup.count({
        where: { menuItemId: item.id, groupId: group.id },
      }),
    ).toBe(1);
  });

  it("includes item-tag assignment tombstone information in the atomic item change", async () => {
    const suffix = crypto.randomUUID();
    const category = await prisma.category.create({
      data: { slug: `tags-${suffix}`, name: "Tags integration" },
    });
    categoryId = category.id;
    const item = await prisma.menuItem.create({
      data: {
        categoryId: category.id,
        slug: `tag-item-${suffix}`,
        name: "Tagged item",
        price: "8.00",
      },
    });
    itemId = item.id;
    entityIds.add(item.id);
    const tag = await prisma.tag.create({
      data: { slug: `tag-${suffix}`, label: "Spicy" },
    });
    tagId = tag.id;

    await itemService.update(item.id, { tagIds: [tag.id] });
    const change = await prisma.catalogChange.findFirst({
      where: { entityType: "MenuItem", entityId: item.id },
      orderBy: { revision: "desc" },
    });
    expect(change?.action).toBe("UPDATED");
    expect(change?.payload).toEqual({ tagIds: [tag.id] });
    expect(
      await prisma.itemTag.count({ where: { itemId: item.id, tagId: tag.id } }),
    ).toBe(1);
  });
});
