import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SortKey = 'popular' | 'price_asc' | 'price_desc' | 'newest' | 'name';

export interface MenuFilterState {
  bestSeller: boolean;
  isNew: boolean;
  vegetarian: boolean;
  featured: boolean;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'الأكثر رواجاً' },
  { key: 'price_asc', label: 'السعر ↑' },
  { key: 'price_desc', label: 'السعر ↓' },
  { key: 'newest', label: 'الأحدث' },
  { key: 'name', label: 'الاسم' },
];

const FILTERS: { key: keyof MenuFilterState; label: string }[] = [
  { key: 'bestSeller', label: 'الأكثر مبيعاً' },
  { key: 'featured', label: 'مميز' },
  { key: 'isNew', label: 'جديد' },
  { key: 'vegetarian', label: 'نباتي' },
];

interface MenuToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  filters: MenuFilterState;
  onToggleFilter: (key: keyof MenuFilterState) => void;
  onClear: () => void;
  activeCount: number;
}

/** Search bar + sort + filter chips (Task 2). Sticky-friendly, fully responsive. */
export function MenuToolbar({
  search,
  onSearch,
  sort,
  onSort,
  filters,
  onToggleFilter,
  onClear,
  activeCount,
}: MenuToolbarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="ابحث عن طبق..."
            className="pr-10"
            aria-label="بحث في القائمة"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="مسح البحث"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            aria-label="ترتيب"
            className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filters[f.key];
          return (
            <button
              key={f.key}
              onClick={() => onToggleFilter(f.key)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                active
                  ? 'border-accent bg-accent text-accent-foreground shadow-gold'
                  : 'border-border bg-card text-foreground/70 hover:border-accent/50',
              )}
            >
              {f.label}
            </button>
          );
        })}
        {activeCount > 0 && (
          <button onClick={onClear} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> مسح ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}

export { SORTS, FILTERS };
