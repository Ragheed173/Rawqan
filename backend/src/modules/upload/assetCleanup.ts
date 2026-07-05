import { prisma } from '../../lib/prisma.js';
import { deleteAssets } from '../../lib/cloudinary.js';

/**
 * Deletes Cloudinary assets that are no longer referenced by ANY item_images row.
 * A duplicated meal shares its source's publicIds, so deleting one copy must not
 * destroy an asset another copy still uses. Call AFTER the owning rows are removed.
 * Best-effort — never throws.
 */
export async function deleteOrphanedAssets(publicIds: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(publicIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return;

  const stillReferenced = new Set(
    (
      await prisma.itemImage.findMany({
        where: { publicId: { in: unique } },
        select: { publicId: true },
      })
    ).map((r) => r.publicId),
  );

  await deleteAssets(unique.filter((id) => !stillReferenced.has(id)));
}
