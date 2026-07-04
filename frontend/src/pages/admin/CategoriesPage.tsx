import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyImage } from '@/components/shared/LazyImage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Seo } from '@/components/shared/Seo';
import { CategoryFormDialog } from '@/components/admin/CategoryFormDialog';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdminCategories, adminKeys } from '@/hooks/admin/useAdminQueries';
import { adminCategoryService } from '@/services/admin/admin.service';
import { getApiErrorMessage } from '@/lib/apiClient';
import type { Category } from '@/types';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data: categories, isLoading } = useAdminCategories();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: adminKeys.categories });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminCategoryService.update(id, { isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const reorderMutation = useMutation({
    mutationFn: adminCategoryService.reorder,
    onSuccess: invalidate,
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategoryService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('تم حذف القسم');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const move = (index: number, dir: -1 | 1) => {
    if (!categories) return;
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((c, i) => ({ id: c.id, sortOrder: i })));
  };

  return (
    <>
      <Seo title="الأقسام" />
      <PageHeader
        title="الأقسام"
        subtitle="نظّم قائمتك في أقسام"
        action={
          <Button variant="gold" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> قسم جديد
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : categories && categories.length ? (
        <div className="space-y-3">
          {categories.map((cat, i) => (
            <Card key={cat.id} className="flex items-center gap-4 p-4">
              <div className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || reorderMutation.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="تحريك لأعلى"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === categories.length - 1 || reorderMutation.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="تحريك لأسفل"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              <LazyImage
                src={cat.imageUrl ?? undefined}
                alt={cat.name}
                wrapperClassName="h-16 w-16 shrink-0 rounded-xl"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display font-semibold text-foreground">{cat.name}</h3>
                  {!cat.isActive && <Badge variant="muted">مخفي</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{cat.itemCount} صنف</p>
              </div>

              <div className="flex items-center gap-1.5">
                <Switch
                  checked={cat.isActive}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: cat.id, isActive: v })}
                  aria-label="تفعيل القسم"
                />
                <Button variant="ghost" size="icon" onClick={() => setEditing(cat)} aria-label="تعديل">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting(cat)}
                  aria-label="حذف"
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
          icon={FolderPlus}
          title="لا توجد أقسام"
          description="ابدأ بإضافة أول قسم لقائمتك."
          action={
            <Button variant="gold" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> قسم جديد
            </Button>
          }
        />
      )}

      <CategoryFormDialog open={creating} onOpenChange={setCreating} />
      <CategoryFormDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} category={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`حذف "${deleting?.name}"؟`}
        description="سيتم حذف القسم وكل الأصناف بداخله. لا يمكن التراجع."
        confirmLabel="حذف"
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </>
  );
}
