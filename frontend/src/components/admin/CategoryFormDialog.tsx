import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { LazyImage } from '@/components/shared/LazyImage';
import {
  adminCategoryService,
  adminUploadService,
  type CategoryInput,
} from '@/services/admin/admin.service';
import { adminKeys } from '@/hooks/admin/useAdminQueries';
import { getApiErrorMessage } from '@/lib/apiClient';
import type { Category } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(120),
  nameEn: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category?: Category | null;
}

/** Create/edit a category with an inline Cloudinary image upload (Tasks 5 & 7). */
export function CategoryFormDialog({ open, onOpenChange, category }: Props) {
  const qc = useQueryClient();
  const isEdit = Boolean(category);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePublicId, setImagePublicId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? '',
        nameEn: category?.nameEn ?? '',
        description: category?.description ?? '',
      });
      setImageUrl(category?.imageUrl ?? null);
      setImagePublicId(category?.imagePublicId ?? null);
    }
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: (data: CategoryInput) =>
      isEdit ? adminCategoryService.update(category!.id, data) : adminCategoryService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.categories });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(isEdit ? 'تم تحديث القسم' : 'تمت إضافة القسم');
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const res = await adminUploadService.uploadOne(files[0], 'categories');
      setImageUrl(res.url);
      setImagePublicId(res.publicId);
      toast.success('تم رفع الصورة');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل رفع الصورة'));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: FormValues) =>
    mutation.mutate({
      name: values.name,
      nameEn: values.nameEn || null,
      description: values.description || null,
      imageUrl,
      imagePublicId,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل القسم' : 'إضافة قسم'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">الاسم (عربي)</Label>
            <Input id="cat-name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-nameEn">الاسم (إنجليزي)</Label>
            <Input id="cat-nameEn" dir="ltr" {...register('nameEn')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">الوصف</Label>
            <Textarea id="cat-desc" {...register('description')} />
          </div>

          <div className="space-y-2">
            <Label>صورة القسم</Label>
            {imageUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border">
                <LazyImage src={imageUrl} alt="" wrapperClassName="h-full w-full" />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(null);
                    setImagePublicId(null);
                  }}
                  className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
                  aria-label="إزالة الصورة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <ImageDropzone onFiles={handleUpload} multiple={false} uploading={uploading} />
            )}
          </div>

          <DialogFooter>
            <Button type="submit" variant="gold" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
