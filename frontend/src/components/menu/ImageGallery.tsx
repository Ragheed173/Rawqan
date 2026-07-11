import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LazyImage } from '@/components/shared/LazyImage';
import { cn } from '@/lib/utils';
import type { ItemImage } from '@/types';

/** Dish gallery: large active image with thumbnail strip and crossfade (Task 3). */
export function ImageGallery({ images, name }: { images: ItemImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [{ id: 'none', url: '', alt: name, isPrimary: true, sortOrder: 0 }];
  const current = list[Math.min(active, list.length - 1)];

  return (
    <div className="space-y-3">
      <div className="group relative aspect-square overflow-hidden rounded-3xl border border-border bg-muted md:aspect-[4/3]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="h-full w-full"
          >
            <LazyImage
              src={current.url}
              alt={current.alt ?? name}
              wrapperClassName="h-full w-full"
              sizes="(min-width: 1024px) 50vw, 100vw"
              zoom
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {list.length > 1 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          {list.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              aria-label={`صورة ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                i === active ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <LazyImage
                src={img.url}
                alt={img.alt ?? ''}
                wrapperClassName="h-full w-full"
                widths={[96, 160]}
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
