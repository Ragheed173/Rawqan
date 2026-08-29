import { prisma } from "../src/lib/prisma.js";
import {
  cloudinaryEnabled,
  deleteAsset,
  uploadBuffer,
} from "../src/lib/cloudinary.js";
import { env } from "../src/config/env.js";
import { recordCatalogChange } from "../src/modules/menu/catalogRevision.js";

const SOURCE_HOST = "res.nunps.com";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const apply = process.argv.includes("--apply");
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const requestedLimit = limitArgument
  ? Number.parseInt(limitArgument.slice("--limit=".length), 10)
  : Number.POSITIVE_INFINITY;

if (!(requestedLimit > 0)) {
  throw new Error("--limit must be a positive integer");
}

function isSourceImage(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === SOURCE_HOST;
  } catch {
    return false;
  }
}

async function downloadImage(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`source returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  if (!contentType?.startsWith("image/")) {
    throw new Error(`source returned unsupported content type ${contentType ?? "unknown"}`);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new Error("source image exceeds 8 MiB");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("downloaded image is empty or exceeds 8 MiB");
  }
  return buffer;
}

const externalImages = (
  await prisma.itemImage.findMany({
    where: { publicId: null, item: { isArchived: false } },
    select: { id: true, itemId: true, url: true, alt: true },
    orderBy: { id: "asc" },
  })
).filter((image) => isSourceImage(image.url));

const selected = externalImages.slice(0, requestedLimit);
console.log(
  `${externalImages.length} external catalog image(s) require mirroring; ${selected.length} selected.`,
);

if (!apply) {
  console.log("Dry run only. Re-run with --apply after reviewing the count.");
  await prisma.$disconnect();
  process.exit(0);
}

if (!cloudinaryEnabled) {
  throw new Error("Cloudinary is not configured; refusing to change catalog URLs");
}

let mirrored = 0;
const failures: { id: string; message: string }[] = [];
const folder = `${env.CLOUDINARY_UPLOAD_FOLDER}/catalog-import`;

for (const [index, image] of selected.entries()) {
  process.stdout.write(`[${index + 1}/${selected.length}] ${image.id} ... `);
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
    console.log("mirrored");
  } catch (error) {
    if (uploadedPublicId) await deleteAsset(uploadedPublicId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "unknown error";
    failures.push({ id: image.id, message });
    console.log(`failed: ${message}`);
  }
}

await prisma.$disconnect();
console.log(`Mirrored ${mirrored}/${selected.length} selected image(s).`);
if (failures.length) {
  console.error("Failed image IDs:");
  for (const failure of failures) console.error(`- ${failure.id}: ${failure.message}`);
  process.exitCode = 1;
}
