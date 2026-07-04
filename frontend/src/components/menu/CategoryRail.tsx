import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

interface CategoryRailProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Sticky, horizontally-scrollable category navigation. The active chip is
 * scrolled into view as the user scroll-spies through sections (Task 2).
 */
export function CategoryRail({ categories, activeId, onSelect }: CategoryRailProps) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId || !railRef.current) return;
    const chip = railRef.current.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId]);

  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-lg md:top-20">
      <div ref={railRef} className="no-scrollbar flex gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            data-cat={cat.id}
            onClick={() => onSelect(cat.id)}
            aria-current={activeId === cat.id}
            className={cn(
              'shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-all',
              activeId === cat.id
                ? 'bg-primary text-primary-foreground shadow-soft'
                : 'bg-card text-foreground/70 hover:bg-muted',
            )}
          >
            {cat.name}
            <span className="mr-1.5 text-xs opacity-60">{cat.itemCount || cat.items?.length || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
