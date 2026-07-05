import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { uniqueSlug } from '../../utils/slug.js';
import { deleteOrphanedAssets } from '../upload/assetCleanup.js';
import { deleteAssets } from '../../lib/cloudinary.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.schemas.js';

const slugExists = (slug: string, excludeId?: string) =>
  prisma.category
    .findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } })
    .then(Boolean);

/** Public listing — active categories only, ordered, with active/available items. */
export function listPublic() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { isAvailable: true, isArchived: false },
        orderBy: { sortOrder: 'asc' },
        include: { images: true, tags: { include: { tag: true } } },
      },
    },
  });
}

/** Admin listing — everything, with item counts. */
export function listAdmin() {
  return prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { items: true } } },
  });
}

export async function getBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      items: {
        where: { isAvailable: true, isArchived: false },
        orderBy: { sortOrder: 'asc' },
        include: { images: true, tags: { include: { tag: true } } },
      },
    },
  });
  if (!category || !category.isActive) throw ApiError.notFound('Category not found');
  return category;
}

export async function getById(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

export async function create(input: CreateCategoryInput) {
  const slug = await uniqueSlug(input.nameEn || input.name, (s) => slugExists(s));
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({
    data: {
      slug,
      name: input.name,
      nameEn: input.nameEn ?? null,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      imagePublicId: input.imagePublicId ?? null,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
      isActive: input.isActive ?? true,
    },
    include: { _count: { select: { items: true } } },
  });
}

export async function update(id: string, input: UpdateCategoryInput) {
  const current = await getById(id);
  // If the image is being replaced/removed, clean up the previous Cloudinary asset.
  if (
    input.imagePublicId !== undefined &&
    current.imagePublicId &&
    current.imagePublicId !== input.imagePublicId
  ) {
    await deleteAssets([current.imagePublicId]);
  }
  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.imagePublicId !== undefined ? { imagePublicId: input.imagePublicId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { _count: { select: { items: true } } },
  });
}

export async function remove(id: string) {
  const current = await getById(id);
  // Collect every Cloudinary asset owned by this category's items before the
  // cascade delete removes the rows, then clean them up best-effort.
  const images = await prisma.itemImage.findMany({
    where: { item: { categoryId: id } },
    select: { publicId: true },
  });
  await prisma.category.delete({ where: { id } }); // cascades to items/images/tags
  await deleteOrphanedAssets(images.map((img) => img.publicId));
  if (current.imagePublicId) await deleteAssets([current.imagePublicId]);
}

export async function reorder(order: { id: string; sortOrder: number }[]) {
  await prisma.$transaction(
    order.map((o) => prisma.category.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
  );
  return listAdmin();
}
