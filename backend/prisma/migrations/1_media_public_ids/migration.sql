-- Cloudinary public_id columns for non-item images, so replacing/deleting a
-- logo, cover, or category image can clean up the old asset (Task 22 / H2).

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "image_public_id" TEXT;

-- AlterTable
ALTER TABLE "restaurant_settings" ADD COLUMN "logo_public_id" TEXT;
ALTER TABLE "restaurant_settings" ADD COLUMN "cover_public_id" TEXT;
