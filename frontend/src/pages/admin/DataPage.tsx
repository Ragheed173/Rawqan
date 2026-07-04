import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/shared/Seo';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { adminDataService } from '@/services/admin/admin.service';
import { getApiErrorMessage } from '@/lib/apiClient';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function DataPage() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const importRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['settings'] });
  };

  const exportMenu = async (format: 'xlsx' | 'csv') => {
    setBusy(`export-${format}`);
    try {
      const blob = await adminDataService.exportMenu(format);
      saveBlob(blob, `rawaqan-menu.${format}`);
      toast.success(`تم تصدير ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const importMenu = async (file: File) => {
    setBusy('import');
    try {
      const res = await adminDataService.importMenu(file);
      invalidateAll();
      toast.success('تم الاستيراد', {
        description: `+${res.itemsCreated} جديد · ${res.itemsUpdated} محدّث · +${res.categoriesCreated} قسم`,
      });
      if (res.errors.length) {
        toast.warning(`${res.errors.length} صف تم تخطيه`, { description: res.errors.slice(0, 3).join(' · ') });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل الاستيراد'));
    } finally {
      setBusy(null);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const downloadBackup = async () => {
    setBusy('backup');
    try {
      const blob = await adminDataService.downloadBackup();
      saveBlob(blob, `rawaqan-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('تم تنزيل النسخة الاحتياطية');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async (file: File) => {
    setBusy('restore');
    try {
      const res = await adminDataService.restoreBackup(file);
      invalidateAll();
      toast.success('تمت الاستعادة', { description: `${res.items} وجبة · ${res.categories} قسم` });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل الاستعادة'));
    } finally {
      setBusy(null);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  };

  return (
    <>
      <Seo title="البيانات والنسخ الاحتياطي" />
      <PageHeader title="البيانات والنسخ الاحتياطي" subtitle="استيراد، تصدير، ونسخ احتياطي للقائمة" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Import / Export */}
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-2 text-accent">
            <FileSpreadsheet className="h-5 w-5" />
            <h2 className="font-display font-semibold text-foreground">استيراد وتصدير القائمة</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            صدّر قائمتك إلى Excel أو CSV، أو استورد قائمة كاملة من ملف Excel. الأعمدة المطلوبة:
            Category, Name, Price (والباقي اختياري).
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => exportMenu('xlsx')} disabled={busy?.startsWith('export')}>
              {busy === 'export-xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير Excel
            </Button>
            <Button variant="outline" onClick={() => exportMenu('csv')} disabled={busy?.startsWith('export')}>
              {busy === 'export-csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير CSV
            </Button>
          </div>

          {can('import:manage') && (
            <>
              <Button variant="gold" className="w-full" onClick={() => importRef.current?.click()} disabled={busy === 'import'}>
                {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                استيراد من Excel
              </Button>
              <input
                ref={importRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importMenu(e.target.files[0])}
              />
            </>
          )}
        </Card>

        {/* Backup / Restore */}
        {can('backup:manage') ? (
          <Card className="space-y-5 p-6">
            <div className="flex items-center gap-2 text-accent">
              <Database className="h-5 w-5" />
              <h2 className="font-display font-semibold text-foreground">النسخ الاحتياطي والاستعادة</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              نزّل نسخة JSON كاملة من القائمة والإعدادات، أو استعد من نسخة سابقة.
              الاستعادة تستبدل القائمة الحالية بالكامل.
            </p>

            <Button variant="outline" className="w-full" onClick={downloadBackup} disabled={busy === 'backup'}>
              {busy === 'backup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تنزيل نسخة احتياطية
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => restoreRef.current?.click()}
              disabled={busy === 'restore'}
            >
              {busy === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              استعادة من نسخة
            </Button>
            <input
              ref={restoreRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && setPendingRestore(e.target.files[0])}
            />
          </Card>
        ) : (
          <Card className="grid place-items-center p-6 text-center text-sm text-muted-foreground">
            النسخ الاحتياطي متاح للمدير العام فقط.
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingRestore}
        onOpenChange={(v) => {
          if (!v) {
            setPendingRestore(null);
            if (restoreRef.current) restoreRef.current.value = '';
          }
        }}
        title="استعادة النسخة الاحتياطية؟"
        description="سيتم استبدال كل الأقسام والوجبات والإعدادات الحالية بمحتوى الملف. لا يمكن التراجع."
        confirmLabel="استعادة"
        onConfirm={async () => {
          if (pendingRestore) await restoreBackup(pendingRestore);
          setPendingRestore(null);
        }}
      />
    </>
  );
}
