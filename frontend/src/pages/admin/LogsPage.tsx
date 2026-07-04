import { useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Seo } from '@/components/shared/Seo';
import { useAdminLogs } from '@/hooks/admin/useAdminQueries';

const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
const ACTION_LABEL: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
  LOGIN: 'دخول',
  LOGOUT: 'خروج',
};
const actionVariant = (a: string) =>
  a === 'DELETE' ? 'danger' : a === 'CREATE' ? 'success' : a === 'UPDATE' ? 'default' : 'muted';

const fmt = (iso: string) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, isLoading } = useAdminLogs({ page, action: action || undefined });

  const meta = data?.meta;

  return (
    <>
      <Seo title="سجل النشاط" />
      <PageHeader
        title="سجل النشاط"
        subtitle="تدقيق كامل لكل العمليات"
        action={
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-border bg-card px-3 text-sm shadow-soft"
            aria-label="تصفية بالإجراء"
          >
            <option value="">كل الإجراءات</option>
            {ACTIONS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            ))}
          </select>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : data && data.data.length ? (
        <Card className="divide-y divide-border">
          {data.data.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant={actionVariant(log.action) as 'default'}>{ACTION_LABEL[log.action] ?? log.action}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{log.summary ?? `${log.action} ${log.entityType}`}</p>
                <p className="text-xs text-muted-foreground">
                  {log.admin}
                  {log.ip ? ` · ${log.ip}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{fmt(log.createdAt)}</span>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={ScrollText} title="لا يوجد نشاط" description="ستظهر العمليات هنا فور حدوثها." />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="السابق">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {meta.page} / {meta.totalPages}
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
    </>
  );
}
