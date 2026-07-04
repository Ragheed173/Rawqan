import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/shared/Seo';
import { ItemImageManager } from '@/components/admin/ItemImageManager';
import { useAdminCategories, useAdminTags, adminKeys } from '@/hooks/admin/useAdminQueries';
import { adminItemService, type ItemInput } from '@/services/admin/admin.service';
import { getApiErrorMessage } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    categoryId: z.string().min(1, 'اختر قسماً'),
    name: z.string().min(1, 'الاسم مطلوب').max(160),
    nameEn: z.string().max(160).optional(),
    description: z.string().max(2000).optional(),
    ingredients: z.string().max(2000).optional(),
    price: z.coerce.number().nonnegative('سعر غير صالح'),
    discountPrice: z.union([z.coerce.number().nonnegative(), z.literal('')]).optional(),
    calories: z.union([z.coerce.number().int().nonnegative(), z.literal('')]).optional(),
    allergens: z.string().max(500).optional(),
    spiceLevel: z.enum(['NONE', 'MILD', 'MEDIUM', 'HOT']),
    featuredFrom: z.string().optional(),
    featuredUntil: z.string().optional(),
    promoFrom: z.string().optional(),
    promoUntil: z.string().optional(),
  })
  .refine((d) => d.discountPrice === '' || d.discountPrice == null || Number(d.discountPrice) < d.price, {
    message: 'سعر الخصم يجب أن يكون أقل من السعر',
    path: ['discountPrice'],
  });
type FormValues = z.infer<typeof schema>;

/** ISO string → value accepted by <input type="datetime-local"> (or ''). */
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');
/** datetime-local value → ISO (or null when empty). */
const toIso = (v?: string) => (v ? new Date(v).toISOString() : null);

const FLAGS = [
  { key: 'isAvailable', label: 'متوفر' },
  { key: 'isFeatured', label: 'مميز' },
  { key: 'isBestSeller', label: 'الأكثر مبيعاً' },
  { key: 'isNew', label: 'جديد' },
  { key: 'isVegetarian', label: 'نباتي' },
  { key: 'isChefRecommendation', label: 'اختيار الشيف' },
] as const;

type FlagKey = (typeof FLAGS)[number]['key'];

export default function MealEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: categories } = useAdminCategories();
  const { data: tags } = useAdminTags();

  const { data: item, isLoading } = useQuery({
    queryKey: adminKeys.item(id ?? ''),
    queryFn: () => adminItemService.get(id!),
    enabled: !isNew,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues & { flags: Record<FlagKey, boolean>; tagIds: string[]; isArchived: boolean }>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      spiceLevel: 'NONE',
      flags: { isAvailable: true, isFeatured: false, isBestSeller: false, isNew: false, isVegetarian: false, isChefRecommendation: false },
      tagIds: [],
      isArchived: false,
    },
  });

  const flags = watch('flags');
  const tagIds = watch('tagIds');
  const isArchived = watch('isArchived');

  useEffect(() => {
    if (item) {
      reset({
        categoryId: item.categoryId,
        name: item.name,
        nameEn: item.nameEn ?? '',
        description: item.description ?? '',
        ingredients: item.ingredients ?? '',
        price: item.price,
        discountPrice: item.discountPrice ?? '',
        calories: item.calories ?? '',
        allergens: item.allergens ?? '',
        spiceLevel: item.spiceLevel,
        featuredFrom: toLocalInput(item.featuredFrom),
        featuredUntil: toLocalInput(item.featuredUntil),
        promoFrom: toLocalInput(item.promoFrom),
        promoUntil: toLocalInput(item.promoUntil),
        flags: {
          isAvailable: item.isAvailable,
          isFeatured: item.isFeatured,
          isBestSeller: item.isBestSeller,
          isNew: item.isNew,
          isVegetarian: item.isVegetarian,
          isChefRecommendation: item.isChefRecommendation,
        },
        tagIds: item.tags.map((t) => t.id),
        isArchived: item.isArchived,
      });
    }
  }, [item, reset]);

  const buildPayload = (values: FormValues): ItemInput => ({
    categoryId: values.categoryId,
    name: values.name,
    nameEn: values.nameEn || null,
    description: values.description || null,
    ingredients: values.ingredients || null,
    price: values.price,
    discountPrice: values.discountPrice === '' || values.discountPrice == null ? null : Number(values.discountPrice),
    calories: values.calories === '' || values.calories == null ? null : Number(values.calories),
    allergens: values.allergens || null,
    spiceLevel: values.spiceLevel,
    featuredFrom: toIso(values.featuredFrom),
    featuredUntil: toIso(values.featuredUntil),
    promoFrom: toIso(values.promoFrom),
    promoUntil: toIso(values.promoUntil),
    ...flags,
    isArchived,
    tagIds,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'items'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: adminKeys.dashboard });
  };

  const createMutation = useMutation({
    mutationFn: (data: ItemInput) => adminItemService.create(data),
    onSuccess: (created) => {
      invalidate();
      toast.success('تم إنشاء الوجبة', { description: 'أضف صوراً الآن' });
      navigate(`/admin/meals/${created.id}`, { replace: true });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ItemInput) => adminItemService.update(id!, data),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: adminKeys.item(id!) });
      toast.success('تم حفظ التغييرات');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const onSubmit = (values: FormValues) => {
    const payload = buildPayload(values);
    if (isNew) createMutation.mutate(payload);
    else updateMutation.mutate(payload);
  };

  const toggleTag = (tagId: string) =>
    setValue('tagIds', tagIds.includes(tagId) ? tagIds.filter((t) => t !== tagId) : [...tagIds, tagId]);

  const saving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <Seo title={isNew ? 'وجبة جديدة' : 'تعديل الوجبة'} />
      <nav className="mb-4">
        <Link to="/admin/meals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> الوجبات
        </Link>
      </nav>
      <PageHeader title={isNew ? 'وجبة جديدة' : item?.name ?? 'تعديل الوجبة'} />

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
        {/* Main fields */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم (عربي)</Label>
                <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                <Input id="nameEn" dir="ltr" {...register('nameEn')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">القسم</Label>
              <select
                id="categoryId"
                {...register('categoryId')}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm shadow-soft"
              >
                <option value="">اختر قسماً</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea id="description" {...register('description')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingredients">المكونات</Label>
              <Textarea id="ingredients" {...register('ingredients')} />
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h3 className="font-display font-semibold">التسعير والتفاصيل</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price">السعر</Label>
                <Input id="price" type="number" step="0.01" {...register('price')} aria-invalid={!!errors.price} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPrice">سعر الخصم</Label>
                <Input id="discountPrice" type="number" step="0.01" {...register('discountPrice')} />
                {errors.discountPrice && <p className="text-xs text-destructive">{errors.discountPrice.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="calories">السعرات</Label>
                <Input id="calories" type="number" {...register('calories')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="allergens">مسببات الحساسية</Label>
                <Input id="allergens" placeholder="مثال: غلوتين، ألبان" {...register('allergens')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spiceLevel">مستوى الحرارة</Label>
                <select
                  id="spiceLevel"
                  {...register('spiceLevel')}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm shadow-soft"
                >
                  <option value="NONE">بدون</option>
                  <option value="MILD">خفيف</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="HOT">حار</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Images — only after the item exists */}
          <Card className="space-y-4 p-6">
            <h3 className="font-display font-semibold">الصور</h3>
            {isNew ? (
              <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                احفظ الوجبة أولاً لتتمكن من إضافة الصور.
              </p>
            ) : (
              item && <ItemImageManager itemId={item.id} images={item.images} />
            )}
          </Card>
        </div>

        {/* Sidebar: flags + tags + save */}
        <div className="space-y-6">
          <Card className="space-y-3 p-6">
            <h3 className="font-display font-semibold">الخصائص</h3>
            {FLAGS.map((f) => (
              <label key={f.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{f.label}</span>
                <Switch
                  checked={flags[f.key]}
                  onCheckedChange={(v) => setValue(`flags.${f.key}`, v)}
                  aria-label={f.label}
                />
              </label>
            ))}
          </Card>

          {/* Publishing & scheduling (Task 22) */}
          <Card className="space-y-4 p-6">
            <h3 className="font-display font-semibold">النشر والجدولة</h3>
            <label className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                أرشفة (إخفاء دون حذف)
                <span className="block text-xs text-muted-foreground">تُخفى من القائمة العامة</span>
              </span>
              <Switch checked={isArchived} onCheckedChange={(v) => setValue('isArchived', v)} aria-label="أرشفة" />
            </label>

            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">جدولة التمييز (اختياري)</p>
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                <Input type="datetime-local" {...register('featuredFrom')} aria-label="بداية التمييز" className="h-9" />
                <Input type="datetime-local" {...register('featuredUntil')} aria-label="نهاية التمييز" className="h-9" />
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">جدولة العرض/الخصم (اختياري)</p>
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                <Input type="datetime-local" {...register('promoFrom')} aria-label="بداية العرض" className="h-9" />
                <Input type="datetime-local" {...register('promoUntil')} aria-label="نهاية العرض" className="h-9" />
              </div>
            </div>
          </Card>

          {tags && tags.length > 0 && (
            <Card className="space-y-3 p-6">
              <h3 className="font-display font-semibold">الوسوم</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      tagIds.includes(t.id)
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border text-foreground/70',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <div className="sticky bottom-4 space-y-2">
            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> حفظ</>}
            </Button>
            {!isNew && item && (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/menu/${item.slug}`} target="_blank">
                  معاينة
                </Link>
              </Button>
            )}
            {!isNew && item && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {item.isFeatured && <Badge variant="gold">مميز</Badge>}
                {!item.isAvailable && <Badge variant="muted">غير متوفر</Badge>}
              </div>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
