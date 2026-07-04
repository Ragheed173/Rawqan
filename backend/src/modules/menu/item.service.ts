import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { uniqueSlug } from '../../utils/slug.js';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from './item.schemas.js';

const itemInclude = {
  images: true,
  tags: { include: { tag: true } },
} satisfies Prisma.MenuItemInclude;

const slugExists = (slug: string, excludeId?: string) =>
  prisma.menuItem
    .findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } })
    .then(Boolean);

async function assertCategory(categoryId: string) {
  const exists = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!exists) throw ApiError.badRequest('categoryId does not reference an existing category');
}

function buildOrderBy(sort?: ListItemsQuery['sort']): Prisma.MenuItemOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }];
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'name':
      return [{ name: 'asc' }];
    case 'popular':
      return [{ isBestSeller: 'desc' }, { isFeatured: 'desc' }, { sortOrder: 'asc' }];
    default:
      return [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
  }
}

/** Where-clause fragment: item is featured *and* within its schedule window (if any). */
function featuredNow(now: Date): Prisma.MenuItemWhereInput {
  return {
    isFeatured: true,
    AND: [
      { OR: [{ featuredFrom: null }, { featuredFrom: { lte: now } }] },
      { OR: [{ featuredUntil: null }, { featuredUntil: { gte: now } }] },
    ],
  };
}

/** Public, filtered listing. Only available, non-archived items in active categories. */
export function listPublic(q: ListItemsQuery) {
  const now = new Date();
  const where: Prisma.MenuItemWhereInput = {
    isAvailable: true,
    isArchived: false,
    category: { isActive: true },
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.featured ? featuredNow(now) : {}),
    ...(q.bestSeller ? { isBestSeller: true } : {}),
    ...(q.isNew ? { isNew: true } : {}),
    ...(q.vegetarian ? { isVegetarian: true } : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { nameEn: { contains: q.search, mode: 'insensitive' } },
            { description: { contains: q.search, mode: 'insensitive' } },
            { ingredients: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  return prisma.menuItem.findMany({
    where,
    orderBy: buildOrderBy(q.sort),
    take: q.limit,
    include: itemInclude,
  });
}

export async function getPublicBySlug(slug: string) {
  const item = await prisma.menuItem.findUnique({ where: { slug }, include: itemInclude });
  if (!item || !item.isAvailable || item.isArchived) throw ApiError.notFound('Item not found');
  return item;
}

/** Related items: same category, available, non-archived, excluding the current item. */
export function getRelated(item: { id: string; categoryId: string }, limit = 6) {
  return prisma.menuItem.findMany({
    where: { categoryId: item.categoryId, isAvailable: true, isArchived: false, NOT: { id: item.id } },
    orderBy: [{ isBestSeller: 'desc' }, { sortOrder: 'asc' }],
    take: limit,
    include: itemInclude,
  });
}

export function listAdmin(q: ListItemsQuery) {
  const where: Prisma.MenuItemWhereInput = {
    // Archived items are hidden by default; `archived=true` shows only them.
    isArchived: q.archived ?? false,
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
  };
  return prisma.menuItem.findMany({ where, orderBy: buildOrderBy(q.sort), include: itemInclude });
}

export async function getById(id: string) {
  const item = await prisma.menuItem.findUnique({ where: { id }, include: itemInclude });
  if (!item) throw ApiError.notFound('Item not found');
  return item;
}

export async function create(input: CreateItemInput) {
  await assertCategory(input.categoryId);
  const { tagIds, ...rest } = input;
  const slug = await uniqueSlug(input.nameEn || input.name, (s) => slugExists(s));
  const max = await prisma.menuItem.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });
  return prisma.menuItem.create({
    data: {
      ...rest,
      slug,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
      ...(tagIds?.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
    },
    include: itemInclude,
  });
}

export async function update(id: string, input: UpdateItemInput) {
  const current = await getById(id);
  if (input.categoryId) await assertCategory(input.categoryId);
  // discountPrice vs price cross-field validation against the merged state
  const nextPrice = input.price ?? Number(current.price);
  if (input.discountPrice != null && input.discountPrice >= nextPrice) {
    throw ApiError.badRequest('Discount price must be lower than the base price');
  }
  const { tagIds, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    if (tagIds) {
      await tx.itemTag.deleteMany({ where: { itemId: id } });
      if (tagIds.length) {
        await tx.itemTag.createMany({ data: tagIds.map((tagId) => ({ itemId: id, tagId })) });
      }
    }
    return tx.menuItem.update({ where: { id }, data: rest, include: itemInclude });
  });
}

export async function remove(id: string) {
  await getById(id);
  await prisma.menuItem.delete({ where: { id } });
}

/** Deep-duplicates an item (new slug, copied images/tags, marked unavailable). */
export async function duplicate(id: string) {
  const source = await getById(id);
  const slug = await uniqueSlug(`${source.nameEn || source.name}-copy`, (s) => slugExists(s));
  return prisma.menuItem.create({
    data: {
      categoryId: source.categoryId,
      slug,
      name: `${source.name} (نسخة)`,
      nameEn: source.nameEn ? `${source.nameEn} (copy)` : null,
      description: source.description,
      descriptionEn: source.descriptionEn,
      ingredients: source.ingredients,
      price: source.price,
      discountPrice: source.discountPrice,
      calories: source.calories,
      allergens: source.allergens,
      spiceLevel: source.spiceLevel,
      isAvailable: false,
      isFeatured: source.isFeatured,
      isBestSeller: source.isBestSeller,
      isNew: source.isNew,
      isVegetarian: source.isVegetarian,
      isChefRecommendation: source.isChefRecommendation,
      sortOrder: source.sortOrder + 1,
      images: {
        create: source.images.map((img) => ({
          url: img.url,
          publicId: img.publicId,
          alt: img.alt,
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary,
        })),
      },
      tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
    },
    include: itemInclude,
  });
}
