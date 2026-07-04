import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Wrapper className (image itself fills it). */
  wrapperClassName?: string;
  /** Enables the hover zoom effect (Task 1/2: image zoom). */
  zoom?: boolean;
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
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

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
          className={cn(
            'h-full w-full object-cover transition-all duration-700',
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-md',
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
