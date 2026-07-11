import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_IMAGE_WIDTHS, imageSrcSet, optimizedImageUrl } from '@/lib/images';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Wrapper className (image itself fills it). */
  wrapperClassName?: string;
  /** Enables the hover zoom effect (Task 1/2: image zoom). */
  zoom?: boolean;
  /** Candidate widths for the responsive srcset (CDN-resizable sources only). */
  widths?: readonly number[];
}

/**
 * Native lazy-loaded, async-decoded image with a shimmer placeholder and a
 * graceful fallback. Used across menu cards, galleries and hero art.
 */
export function LazyImage({
  wrapperClassName,
  zoom = false,
  className,
  alt = '',
  onLoad,
  src,
  sizes,
  widths = DEFAULT_IMAGE_WIDTHS,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Right-size CDN images: srcset lets the browser pick the smallest fit,
  // and the plain src falls back to a mid-size variant instead of the original.
  const srcSet = src ? imageSrcSet(src, widths) : undefined;
  const effectiveSrc = src && srcSet ? optimizedImageUrl(src, widths[Math.min(2, widths.length - 1)]) : src;

  return (
    <div className={cn('relative overflow-hidden bg-muted/50', wrapperClassName)}>
      {!loaded && !errored && <div className="skeleton absolute inset-0" />}
      {errored ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
          لا توجد صورة
        </div>
      ) : (
        <img
          loading="lazy"
          decoding="async"
          alt={alt}
          src={effectiveSrc}
          srcSet={srcSet}
          sizes={srcSet ? (sizes ?? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw') : sizes}
          className={cn(
            // Opacity-only reveal: the old blur-up animated `filter`, which
            // Lighthouse flags ("filter-related property may move pixels").
            'h-full w-full object-cover transition-opacity duration-700',
            loaded ? 'opacity-100' : 'opacity-0',
            zoom && 'group-hover:scale-105',
            className,
          )}
          onLoad={(e) => {
            setLoaded(true);
            onLoad?.(e);
          }}
          onError={() => setErrored(true)}
          {...props}
        />
      )}
    </div>
  );
}
