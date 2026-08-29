import { env } from "../../config/env.js";
import {
  cloudinaryEnabled,
  deleteAsset,
  uploadBuffer,
} from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { recordCatalogChange } from "../menu/catalogRevision.js";

const SOURCE_HOST = "res.nunps.com";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export interface CatalogImageMirrorFailure {
  id: string;
  message: string;
}

export interface CatalogImageMirrorBatchResult {
  selected: number;
  mirrored: number;
  failures: CatalogImageMirrorFailure[];
  nextCursor: string | null;
  hasMore: boolean;
  remaining: number;
}

export function isExternalCatalogImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === SOURCE_HOST;
  } catch {
    return false;
  }
}

async function fetchSourceImage(urlValue: string): Promise<Response> {
  let currentUrl = new URL(urlValue);
  const signal = AbortSignal.timeout(30_000);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isExternalCatalogImageUrl(currentUrl.toString())) {
      throw new Error("source image host is not allowed");
    }

    const response = await fetch(currentUrl, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
      redirect: "manual",
      signal,
    });

    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("source returned a redirect without a location");
    currentUrl = new URL(location, currentUrl);
  }

  throw new Error("source returned too many redirects");
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetchSourceImage(url);
  if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  if (!contentType?.startsWith("image/")) {
    throw new Error(`source returned unsupported content type ${contentType ?? "unknown"}`);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("source image exceeds 8 MiB");
  if (!response.body) throw new Error("source returned an empty body");

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("source image exceeds 8 MiB");
    }
    chunks.push(Buffer.from(value));
  }

  if (totalBytes === 0) throw new Error("source returned an empty image");
  return Buffer.concat(chunks, totalBytes);
}

const externalImageWhere = {
  publicId: null,
  url: { startsWith: `https://${SOURCE_HOST}/` },
} as const;

export async function mirrorExternalCatalogImageBatch(input: {
  cursor?: string;
  limit: number;
}): Promise<CatalogImageMirrorBatchResult> {
  if (!cloudinaryEnabled) throw new Error("Cloudinary is not configured");

  const images = await prisma.itemImage.findMany({
    where: {
      ...externalImageWhere,
      ...(input.cursor ? { id: { gt: input.cursor } } : {}),
    },
    select: { id: true, itemId: true, url: true, alt: true },
    orderBy: { id: "asc" },
    take: input.limit,
  });

  let mirrored = 0;
  const failures: CatalogImageMirrorFailure[] = [];
  const folder = `${env.CLOUDINARY_UPLOAD_FOLDER}/catalog-import`;

  for (const image of images) {
    let uploadedPublicId: string | undefined;
    try {
      const buffer = await downloadImage(image.url);
      const uploaded = await uploadBuffer(buffer, folder);
      uploadedPublicId = uploaded.publicId;

      await prisma.$transaction(async (tx) => {
        const updated = await tx.itemImage.updateMany({
          where: { id: image.id, url: image.url, publicId: null },
          data: { url: uploaded.url, publicId: uploaded.publicId },
        });
        if (updated.count !== 1) {
          throw new Error("catalog image changed while it was being mirrored");
        }
        await recordCatalogChange(tx, {
          entityType: "ItemImage",
          entityId: image.id,
          action: "UPDATED",
          payload: {
            itemId: image.itemId,
            imageId: image.id,
            url: uploaded.url,
            publicId: uploaded.publicId,
            alt: image.alt,
          },
        });
      });

      mirrored += 1;
    } catch (error) {
      if (uploadedPublicId) await deleteAsset(uploadedPublicId).catch(() => undefined);
      failures.push({
        id: image.id,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const nextCursor = images.at(-1)?.id ?? null;
  const [hasMoreImage, remaining] = await Promise.all([
    nextCursor
      ? prisma.itemImage.findFirst({
          where: { ...externalImageWhere, id: { gt: nextCursor } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.itemImage.count({ where: externalImageWhere }),
  ]);

  return {
    selected: images.length,
    mirrored,
    failures,
    nextCursor,
    hasMore: Boolean(hasMoreImage),
    remaining,
  };
}
