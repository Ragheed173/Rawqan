import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/shared/Seo';
import { LazyImage } from '@/components/shared/LazyImage';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { useAdminSettings, adminKeys } from '@/hooks/admin/useAdminQueries';
import { adminSettingsService, adminUploadService } from '@/services/admin/admin.service';
import { getApiErrorMessage } from '@/lib/apiClient';
import type { OpeningHour, RestaurantSettings, Weekday } from '@/types';

const DAYS: { key: Weekday; label: string }[] = [
  { key: 'SUNDAY', label: 'الأحد' },
  { key: 'MONDAY', label: 'الإثنين' },
  { key: 'TUESDAY', label: 'الثلاثاء' },
  { key: 'WEDNESDAY', label: 'الأربعاء' },
  { key: 'THURSDAY', label: 'الخميس' },
  { key: 'FRIDAY', label: 'الجمعة' },
  { key: 'SATURDAY', label: 'السبت' },
];

type SettingsForm = {
  name: string;
  nameEn: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  googleMapsUrl: string;
  addressLine: string;
  currency: string;
  footerText: string;
};

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useAdminSettings();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [hours, setHours] = useState<OpeningHour[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const { register, handleSubmit, reset } = useForm<SettingsForm>();

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name,
        nameEn: settings.nameEn ?? '',
        tagline: settings.tagline ?? '',
        description: settings.description ?? '',
        phone: settings.phone ?? '',
        whatsapp: settings.whatsapp ?? '',
        facebook: settings.facebook ?? '',
        instagram: settings.instagram ?? '',
        tiktok: settings.tiktok ?? '',
        googleMapsUrl: settings.googleMapsUrl ?? '',
        addressLine: settings.addressLine ?? '',
        currency: settings.currency,
        footerText: settings.footerText ?? '',
      });
      setLogoUrl(settings.logoUrl);
      setCoverUrl(settings.coverUrl);
      setHours(settings.openingHours);
    }
  }, [settings, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: adminKeys.settings });
    qc.invalidateQueries({ queryKey: ['settings'] });
  };

  const saveMutation = useMutation({
    mutationFn: (data: Partial<RestaurantSettings>) => adminSettingsService.update(data as Record<string, unknown>),
    onSuccess: () => {
      invalidate();
      toast.success('تم حفظ الإعدادات');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const hoursMutation = useMutation({
    mutationFn: () => adminSettingsService.updateHours(hours),
    onSuccess: () => {
      invalidate();
      toast.success('تم حفظ ساعات العمل');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const uploadImage = async (files: File[], kind: 'logo' | 'cover') => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    try {
      const res = await adminUploadService.uploadOne(files[0], kind);
      if (kind === 'logo') setLogoUrl(res.url);
      else setCoverUrl(res.url);
      toast.success('تم رفع الصورة');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل الرفع'));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: SettingsForm) =>
    saveMutation.mutate({
      ...values,
      nameEn: values.nameEn || null,
      tagline: values.tagline || null,
      description: values.description || null,
      logoUrl,
      coverUrl,
    } as Partial<RestaurantSettings>);

  const setHour = (weekday: Weekday, patch: Partial<OpeningHour>) =>
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <Seo title="الإعدادات" />
      <PageHeader title="إعدادات المطعم" subtitle="الهوية، التواصل، وساعات العمل" />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 lg:col-span-2">
          {/* Identity */}
          <Card className="space-y-4 p-6">
            <h3 className="font-display font-semibold">الهوية</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المطعم</Label>
                <Input id="name" {...register('name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                <Input id="nameEn" dir="ltr" {...register('nameEn')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">الشعار النصي</Label>
              <Input id="tagline" {...register('tagline')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">نبذة</Label>
              <Textarea id="description" {...register('description')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الشعار (Logo)</Label>
                {logoUrl ? (
                  <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-ink">
                    <LazyImage src={logoUrl} alt="" wrapperClassName="h-full w-full" />
                    <button type="button" onClick={() => setLogoUrl(null)} className="absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white" aria-label="إزالة">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <ImageDropzone onFiles={(f) => uploadImage(f, 'logo')} multiple={false} uploading={uploadingLogo} label="شعار" />
                )}
              </div>
              <div className="space-y-2">
                <Label>صورة الغلاف</Label>
                {coverUrl ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-border">
                    <LazyImage src={coverUrl} alt="" wrapperClassName="h-full w-full" />
                    <button type="button" onClick={() => setCoverUrl(null)} className="absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white" aria-label="إزالة">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <ImageDropzone onFiles={(f) => uploadImage(f, 'cover')} multiple={false} uploading={uploadingCover} label="غلاف" />
                )}
              </div>
            </div>
          </Card>

          {/* Contact & social */}
          <Card className="space-y-4 p-6">
            <h3 className="font-display font-semibold">التواصل والروابط</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">الهاتف</Label>
                <Input id="phone" dir="ltr" {...register('phone')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">واتساب</Label>
                <Input id="whatsapp" dir="ltr" {...register('whatsapp')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">إنستغرام</Label>
                <Input id="instagram" dir="ltr" {...register('instagram')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook">فيسبوك</Label>
                <Input id="facebook" dir="ltr" {...register('facebook')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktok">تيك توك</Label>
                <Input id="tiktok" dir="ltr" {...register('tiktok')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="googleMapsUrl">خرائط جوجل</Label>
                <Input id="googleMapsUrl" dir="ltr" {...register('googleMapsUrl')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine">العنوان</Label>
              <Input id="addressLine" {...register('addressLine')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">العملة</Label>
                <Input id="currency" dir="ltr" {...register('currency')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerText">نص التذييل</Label>
                <Input id="footerText" {...register('footerText')} />
              </div>
            </div>
          </Card>

          <Button type="submit" variant="gold" size="lg" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> حفظ الإعدادات</>}
          </Button>
        </form>

        {/* Opening hours */}
        <div>
          <Card className="space-y-4 p-6">
            <h3 className="font-display font-semibold">ساعات العمل</h3>
            <div className="space-y-3">
              {DAYS.map(({ key, label }) => {
                const h = hours.find((x) => x.weekday === key);
                if (!h) return null;
                return (
                  <div key={key} className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{label}</span>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {h.isClosed ? 'مغلق' : 'مفتوح'}
                        <Switch checked={!h.isClosed} onCheckedChange={(v) => setHour(key, { isClosed: !v })} aria-label={`${label} مفتوح`} />
                      </label>
                    </div>
                    {!h.isClosed && (
                      <div className="flex items-center gap-2" dir="ltr">
                        <Input type="time" value={h.opensAt ?? ''} onChange={(e) => setHour(key, { opensAt: e.target.value })} className="h-9" />
                        <span className="text-muted-foreground">-</span>
                        <Input type="time" value={h.closesAt ?? ''} onChange={(e) => setHour(key, { closesAt: e.target.value })} className="h-9" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Button onClick={() => hoursMutation.mutate()} variant="default" className="w-full" disabled={hoursMutation.isPending}>
              {hoursMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ الساعات'}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
