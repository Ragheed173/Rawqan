import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { LazyImage } from '@/components/shared/LazyImage';
import { Badge } from '@/components/ui/badge';
import { adminUploadService } from '@/services/admin/admin.service';
import { adminKeys } from '@/hooks/admin/useAdminQueries';
import { getApiErrorMessage } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import type { ItemImage } from '@/types';

/** Multi-image manager for a meal: upload, set primary, delete (Task 7). */
export function ItemImageManager({ itemId, images }: { itemId: string; images: ItemImage[] }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.item(itemId) });

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      await adminUploadService.uploadItemImages(itemId, files);
      refresh();
      toast.success('تم رفع الصور');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل رفع الصور'));
    } finally {
      setUploading(false);
    }
  };

  const setPrimary = useMutation({
    mutationFn: (imageId: string) => adminUploadService.setPrimary(imageId),
    onSuccess: () => {
      refresh();
      toast.success('تم تعيين الصورة الرئيسية');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (imageId: string) => adminUploadService.deleteImage(imageId),
    onSuccess: () => {
      refresh();
      toast.success('تم حذف الصورة');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-xl border-2',
                img.isPrimary ? 'border-accent' : 'border-border',
              )}
            >
              <LazyImage src={img.url} alt={img.alt ?? ''} wrapperClassName="h-full w-full" />
              {img.isPrimary && <Badge variant="gold" className="absolute right-2 top-2">رئيسية</Badge>}
              <div className="absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimary.mutate(img.id)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink"
                    aria-label="تعيين كصورة رئيسية"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove.mutate(img.id)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-destructive text-white"
                  aria-label="حذف الصورة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ImageDropzone onFiles={upload} uploading={uploading} label="أضف صوراً للوجبة" />
    </div>
  );
}
