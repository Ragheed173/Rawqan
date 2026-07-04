import type { Category, ItemImage, MenuItem, Tag } from '@prisma/client';
import { decimalToNumber } from '../../utils/serializers.js';

type ItemWithRelations = MenuItem & {
  images?: ItemImage[];
  tags?: { tag: Tag }[];
};

export function serializeImage(img: ItemImage) {
  return {
    id: img.id,
    url: img.url,
    alt: img.alt,
    isPrimary: img.isPrimary,
    sortOrder: img.sortOrder,
  };
}

export function serializeTag(tag: Tag) {
  return { id: tag.id, slug: tag.slug, label: tag.label, labelEn: tag.labelEn, color: tag.color };
}

/** True if a time window [from, until] contains `now` (nulls = open-ended). */
function windowActive(from: Date | null, until: Date | null, now: Date): boolean {
  if (from && from > now) return false;
  if (until && until < now) return false;
  return true;
}

export function serializeItem(item: ItemWithRelations) {
  const images = (item.images ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  const now = new Date();
  const discount = decimalToNumber(item.discountPrice);
  // A discount only applies inside its promo window (Task 22 scheduled promotions).
  const discountActive = discount != null && windowActive(item.promoFrom, item.promoUntil, now);
  const featuredActive = item.isFeatured && windowActive(item.featuredFrom, item.featuredUntil, now);
  return {
    id: item.id,
    slug: item.slug,
    categoryId: item.categoryId,
    name: item.name,
    nameEn: item.nameEn,
    description: item.description,
    descriptionEn: item.descriptionEn,
    ingredients: item.ingredients,
    price: decimalToNumber(item.price),
    discountPrice: discount,
    discountActive,
    calories: item.calories,
    allergens: item.allergens,
    spiceLevel: item.spiceLevel,
    isAvailable: item.isAvailable,
    isArchived: item.isArchived,
    isFeatured: item.isFeatured,
    featuredActive,
    featuredFrom: item.featuredFrom,
    featuredUntil: item.featuredUntil,
    promoFrom: item.promoFrom,
    promoUntil: item.promoUntil,
    viewCount: item.viewCount,
    isBestSeller: item.isBestSeller,
    isNew: item.isNew,
    isVegetarian: item.isVegetarian,
    isChefRecommendation: item.isChefRecommendation,
    sortOrder: item.sortOrder,
    primaryImage: primary ? serializeImage(primary) : null,
    images: images.map(serializeImage),
    tags: (item.tags ?? []).map((t) => serializeTag(t.tag)),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

type CategoryWithItems = Category & { items?: ItemWithRelations[]; _count?: { items: number } };

export function serializeCategory(category: CategoryWithItems) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    nameEn: category.nameEn,
    description: category.description,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    itemCount: category._count?.items ?? category.items?.length ?? 0,
    items: category.items ? category.items.map(serializeItem) : undefined,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
