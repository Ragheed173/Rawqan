import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyImage } from '@/components/shared/LazyImage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Seo } from '@/components/shared/Seo';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdminCategories, useAdminItems, adminKeys } from '@/hooks/admin/useAdminQueries';
import { adminItemService } from '@/services/admin/admin.service';
import { useDebounce } from '@/hooks/useDebounce';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPrice } from '@/lib/utils';
import type { MenuItem } from '@/types';

export default function MealsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: categories } = useAdminCategories();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Server-side filtering + pagination; reset to page 1 when filters change.
  useEffect(() => setPage(1), [debouncedSearch, categoryId, showArchived]);
  const { data: result, isLoading } = useAdminItems({
    archived: showArchived,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    page,
    pageSize: 20,
  });
  const meta = result?.meta;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'items'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: adminKeys.dashboard });
  };

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => adminItemService.duplicate(id),
    onSuccess: (item) => {
      invalidate();
      toast.success('تم نسخ الوجبة', { description: 'النسخة مخفية حتى تُراجعها' });
      navigate(`/admin/meals/${item.id}`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Deferred-undo delete (Task 17): the DELETE request fires only after the
  // 5s undo window lapses, so an undone deletion never touches the server.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const performDelete = (meal: MenuItem) => {
    setHiddenIds((prev) => new Set(prev).add(meal.id));
    const timer = setTimeout(async () => {
      timers.current.delete(meal.id);
      try {
        await adminItemService.remove(meal.id);
        invalidate();
      } catch (err) {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(meal.id);
          return next;
        });
        toast.error(getApiErrorMessage(err));
      }
    }, 5000);
    timers.current.set(meal.id, timer);

    toast('تم حذف الوجبة', {
      description: meal.name,
      action: {
        label: 'تراجع',
        onClick: () => {
          const t = timers.current.get(meal.id);
          if (t) clearTimeout(t);
          timers.current.delete(meal.id);
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(meal.id);
            return next;
          });
        },
      },
    });
  };

  // Server already filters/paginates; only hide items in the undo window.
  const filtered = useMemo(
    () => (result?.data ?? []).filter((m) => !hiddenIds.has(m.id)),
    [result, hiddenIds],
  );

  const catName = (id: string) => categories?.find((c) => c.id === id)?.name ?? '';

  return (
    <>
      <Seo title="الوجبات" />
      <PageHeader
        title="الوجبات"
        subtitle="أضف وعدّل أطباق قائمتك"
        action={
          <Button asChild variant="gold">
            <Link to="/admin/meals/new">
              <Plus className="h-4 w-4" /> وجبة جديدة
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن وجبة..."
            className="pr-10"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm shadow-soft"
          aria-label="تصفية بالقسم"
        >
          <option value="">كل الأقسام</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowArchived((v) => !v)}
          aria-pressed={showArchived}
          className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-medium transition-colors ${
            showArchived ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-foreground/70'
          }`}
        >
          {showArchived ? 'المؤرشفة' : 'النشطة'}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((meal) => (
            <Card key={meal.id} className="flex items-center gap-4 p-3">
              <LazyImage
                src={meal.primaryImage?.url ?? undefined}
                alt={meal.name}
                wrapperClassName="h-16 w-16 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-display font-semibold text-foreground">{meal.name}</h3>
                  {!meal.isAvailable && <Badge variant="muted">غير متوفر</Badge>}
                  {meal.isFeatured && <Badge variant="gold">مميز</Badge>}
                  {meal.isBestSeller && <Badge>الأكثر مبيعاً</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {catName(meal.categoryId)} · {formatPrice(meal.discountPrice ?? meal.price)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="ghost" size="icon" aria-label="تعديل">
                  <Link to={`/admin/meals/${meal.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="نسخ"
                  onClick={() => duplicateMutation.mutate(meal.id)}
                  disabled={duplicateMutation.isPending}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  onClick={() => setDeleting(meal)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UtensilsCrossed}
          title={search || categoryId ? 'لا توجد نتائج' : 'لا توجد وجبات'}
          description={search || categoryId ? 'جرّب تعديل البحث.' : 'ابدأ بإضافة أول وجبة.'}
          action={
            !search && !categoryId ? (
              <Button asChild variant="gold">
                <Link to="/admin/meals/new">
                  <Plus className="h-4 w-4" /> وجبة جديدة
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {meta.page} / {meta.totalPages} · {meta.total} وجبة
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            aria-label="التالي"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`حذف "${deleting?.name}"؟`}
        description="لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        onConfirm={() => {
          if (deleting) performDelete(deleting);
        }}
      />
    </>
  );
}
