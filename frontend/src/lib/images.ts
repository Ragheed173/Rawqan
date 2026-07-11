/**
 * Delivery-time image optimization (performance).
 *
 * Menu/hero images are stored as full-size Cloudinary URLs (the odd demo item
 * uses Unsplash). Both CDNs support on-the-fly resizing + modern formats, so
 * we rewrite delivery URLs to request only the pixels a slot actually needs
 * (WebP/AVIF via `f_auto`, right-sized via `w_`), instead of shipping the
 * original multi-megapixel upload.
 */

const CLOUDINARY_UPLOAD_SEGMENT = /(\/image\/upload\/)(?!.*\/image\/upload\/)/;

function isCloudinary(url: string): boolean {
  return url.includes('res.cloudinary.com') && CLOUDINARY_UPLOAD_SEGMENT.test(url);
}

function isUnsplash(url: string): boolean {
  return url.includes('images.unsplash.com');
}

/** Returns `url` resized to `width` CSS px (capped upscale) when the CDN supports it. */
export function optimizedImageUrl(url: string, width: number): string {
  if (isCloudinary(url)) {
    // Insert a transformation segment right after `/image/upload/`.
    // `c_limit` never upscales; `f_auto,q_auto` serve AVIF/WebP at auto quality.
    return url.replace(CLOUDINARY_UPLOAD_SEGMENT, `$1f_auto,q_auto,c_limit,w_${width}/`);
  }
  if (isUnsplash(url)) {
    const u = new URL(url);
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    u.searchParams.set('w', String(width));
    u.searchParams.set('q', '70');
    return u.toString();
  }
  return url;
}

/** Default responsive widths for content images (menu cards, galleries). */
export const DEFAULT_IMAGE_WIDTHS = [320, 480, 640, 960, 1280] as const;

/** Widths for full-bleed hero/cover imagery. */
export const HERO_IMAGE_WIDTHS = [640, 960, 1280, 1920] as const;

/**
 * Builds a `srcset` for CDN-resizable URLs. Returns `undefined` for
 * non-resizable sources (uploads served elsewhere keep their single URL).
 */
export function imageSrcSet(url: string, widths: readonly number[] = DEFAULT_IMAGE_WIDTHS): string | undefined {
  if (!isCloudinary(url) && !isUnsplash(url)) return undefined;
  return widths.map((w) => `${optimizedImageUrl(url, w)} ${w}w`).join(', ');
}
