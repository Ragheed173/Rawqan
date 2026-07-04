import { useEffect, useMemo, useRef, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Seo } from '@/components/shared/Seo';
import { EmptyState } from '@/components/shared/EmptyState';
import { MenuCard } from '@/components/menu/MenuCard';
import { MenuCardSkeleton } from '@/components/menu/MenuCardSkeleton';
import { CategoryRail } from '@/components/menu/CategoryRail';
import { MenuToolbar, type MenuFilterState, type SortKey } from '@/components/menu/MenuToolbar';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/button';
import { useCategories, useSettings } from '@/hooks/useMenu';
import { useDebounce } from '@/hooks/useDebounce';
import type { Category, MenuItem } from '@/types';

const EMPTY_FILTERS: MenuFilterState = {
  bestSeller: false,
  isNew: false,
  vegetarian: false,
  featured: false,
};

const effPrice = (i: MenuItem) => (i.discountActive ? (i.discountPrice ?? i.price) : i.price);

function sortItems(items: MenuItem[], sort: SortKey): MenuItem[] {
  const copy = [...items];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => effPrice(a) - effPrice(b));
    case 'price_desc':
      return copy.sort((a, b) => effPrice(b) - effPrice(a));
    case 'newest':
      return copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    case 'popular':
    default:
      return copy.sort(
        (a, b) => Number(b.isBestSeller) - Number(a.isBestSeller) || a.sortOrder - b.sortOrder,
      );
  }
}

function matchesFilters(item: MenuItem, f: MenuFilterState, term: string): boolean {
  if (f.bestSeller && !item.isBestSeller) return false;
  if (f.featured && !item.isFeatured) return false;
  if (f.isNew && !item.isNew) return false;
  if (f.vegetarian && !item.isVegetarian) return false;
  if (term) {
    const hay = `${item.name} ${item.nameEn ?? ''} ${item.description ?? ''} ${item.ingredients ?? ''}`.toLowerCase();
    if (!hay.includes(term.toLowerCase())) return false;
  }
  return true;
}

export default function MenuPage() {
  const { data: settings } = useSettings();
  const { data: categories, isLoading } = useCategories();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');
  const [filters, setFilters] = useState<MenuFilterState>(EMPTY_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 250);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const currency = settings?.currency ?? 'EGP';

  const activeCount =
    Object.values(filters).filter(Boolean).length + (debouncedSearch.trim() ? 1 : 0);
  const isFiltering = activeCount > 0;

  // Category sections filtered/sorted for browse mode
  const sections = useMemo(() => {
    if (!categories) return [] as { category: Category; items: MenuItem[] }[];
    return categories
      .map((category) => ({
        category,
        items: sortItems(category.items ?? [], sort),
      }))
      .filter((s) => s.items.length > 0);
  }, [categories, sort]);

  // Flat filtered results for search/filter mode
  const filteredResults = useMemo(() => {
    if (!categories) return [] as MenuItem[];
    const all = categories.flatMap((c) => c.items ?? []);
    return sortItems(
      all.filter((it) => matchesFilters(it, filters, debouncedSearch)),
      sort,
    );
  }, [categories, filters, debouncedSearch, sort]);

  // Scroll-spy over category sections (browse mode only)
  useEffect(() => {
    if (isFiltering || !sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id.replace('cat-', ''));
      },
      { rootMargin: '-140px 0px -60% 0px', threshold: [0, 0.25, 0.5] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isFiltering, sections]);

  const scrollToCategory = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  const toggleFilter = (key: keyof MenuFilterState) =>
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
  };

  return (
    <>
      <Seo title="القائمة" description="تصفّح قائمة روقان الكاملة — مقبلات، أطباق رئيسية، حلويات ومشروبات." />

      {/* Header band */}
      <section className="bg-secondary pb-8 pt-28 text-secondary-foreground md:pt-36">
        <div className="container text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-accent">قائمتنا</span>
          <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">اكتشف نكهاتنا</h1>
          <p className="mx-auto mt-3 max-w-xl text-white/60">
            مكوّنات طازجة وأطباق مُعدّة بعناية لتجربة طعام لا تُنسى.
          </p>
        </div>
      </section>

      <div className="container pb-24">
        {/* Sticky category rail */}
        {!isFiltering && categories && categories.length > 0 && (
          <CategoryRail categories={sections.map((s) => s.category)} activeId={activeId} onSelect={scrollToCategory} />
        )}

        {/* Toolbar */}
        <div className="py-6">
          <MenuToolbar
            search={search}
            onSearch={setSearch}
            sort={sort}
            onSort={setSort}
            filters={filters}
            onToggleFilter={toggleFilter}
            onClear={clearAll}
            activeCount={activeCount}
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MenuCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Filter/search results */}
        {!isLoading && isFiltering && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{filteredResults.length} نتيجة</p>
            {filteredResults.length ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredResults.map((item, i) => (
                  <MenuCard key={item.id} item={item} currency={currency} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="لا توجد نتائج"
                description="جرّب تعديل البحث أو مسح عوامل التصفية."
                action={
                  <Button variant="gold" onClick={clearAll}>
                    مسح الكل
                  </Button>
                }
              />
            )}
          </>
        )}

        {/* Browse mode: grouped sections */}
        {!isLoading && !isFiltering && (
          <div className="space-y-16">
            {sections.length ? (
              sections.map(({ category, items }) => (
                <section
                  key={category.id}
                  id={`cat-${category.id}`}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(category.id, el);
                    else sectionRefs.current.delete(category.id);
                  }}
                  className="scroll-mt-32"
                >
                  <SectionHeading
                    align="start"
                    title={category.name}
                    subtitle={category.description ?? undefined}
                    className="mb-6"
                  />
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item, i) => (
                      <MenuCard key={item.id} item={item} currency={currency} index={i} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState
                icon={UtensilsCrossed}
                title="القائمة قيد التحضير"
                description="سيتم إضافة الأطباق قريباً. تابعونا!"
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
