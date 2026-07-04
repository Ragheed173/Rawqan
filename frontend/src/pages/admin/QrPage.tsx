import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, ImageIcon, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/shared/Seo';
import { adminQrService } from '@/services/admin/admin.service';
import { getApiErrorMessage } from '@/lib/apiClient';

const SIZES = [256, 512, 1024];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function QrPage() {
  const [table, setTable] = useState('');
  const [size, setSize] = useState(512);
  const [downloading, setDownloading] = useState<string | null>(null);

  const params = { table: table.trim() || undefined, size };
  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'qr', params],
    queryFn: () => adminQrService.preview(params),
  });

  const download = async (format: 'png' | 'svg' | 'pdf') => {
    setDownloading(format);
    try {
      const blob = await adminQrService.download(format, params);
      const suffix = table.trim() ? `-table-${table.trim()}` : '';
      triggerDownload(blob, `rawaqan-qr${suffix}.${format}`);
      toast.success(`تم تنزيل ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل التنزيل'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <Seo title="رمز QR" />
      <PageHeader title="رمز QR" subtitle="أنشئ ونزّل رموز QR لقائمتك وطاولاتك" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <Card className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="table">رقم الطاولة (اختياري)</Label>
            <Input
              id="table"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder="مثال: 12"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              اتركه فارغاً لرمز عام، أو أدخل رقماً لبطاقة طاولة قابلة للطباعة.
            </p>
          </div>

          <div className="space-y-2">
            <Label>الحجم</Label>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    size === s ? 'border-accent bg-accent text-accent-foreground' : 'border-border'
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label>تنزيل</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => download('png')} disabled={!!downloading}>
                {downloading === 'png' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                PNG
              </Button>
              <Button variant="outline" onClick={() => download('svg')} disabled={!!downloading}>
                {downloading === 'svg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                SVG
              </Button>
              <Button variant="outline" onClick={() => download('pdf')} disabled={!!downloading}>
                {downloading === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card className="flex flex-col items-center justify-center gap-4 p-6">
          {isFetching || !data ? (
            <Skeleton className="h-64 w-64 rounded-2xl" />
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-white p-4">
                <img src={data.dataUrl} alt="معاينة رمز QR" className="h-64 w-64" />
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground" dir="ltr">
                <QrCode className="h-4 w-4" /> {data.target}
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
