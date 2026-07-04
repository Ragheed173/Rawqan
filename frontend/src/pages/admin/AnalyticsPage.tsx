import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, QrCode, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Seo } from '@/components/shared/Seo';
import { useAnalytics } from '@/hooks/admin/useAdminQueries';
import { formatPrice } from '@/lib/utils';

const RANGES = [7, 30, 90] as const;

function Stat({ icon: Icon, label, value, delay }: { icon: LucideIcon; label: string; value: number | string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useAnalytics(days);

  const maxVisitors = Math.max(1, ...(data?.dailyVisitors.map((d) => d.visitors) ?? [1]));
  const maxViews = Math.max(1, ...(data?.mostViewedItems.map((i) => i.viewCount) ?? [1]));
  const maxCat = Math.max(1, ...(data?.popularCategories.map((c) => c.views) ?? [1]));

  return (
    <>
      <Seo title="التحليلات" />
      <PageHeader
        title="التحليلات"
        subtitle="أداء قائمتك وزوّارك"
        action={
          <div className="flex gap-1 rounded-full border border-border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  days === r ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r} يوم
              </button>
            ))}
          </div>
        }
      />

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Eye} label="مشاهدات" value={data.totals.views} delay={0} />
            <Stat icon={Users} label="زوّار" value={data.totals.visitors} delay={0.05} />
            <Stat icon={TrendingUp} label="زوّار اليوم" value={data.totals.visitorsToday} delay={0.1} />
            <Stat icon={QrCode} label="مسح QR" value={data.totals.qrScans} delay={0.15} />
          </div>

          {/* Daily visitors bar chart */}
          <Card className="p-6">
            <h2 className="mb-6 font-display text-lg font-semibold">الزوّار اليوميون</h2>
            {data.dailyVisitors.some((d) => d.visitors > 0) ? (
              <div className="flex h-48 items-end gap-1 overflow-x-auto" role="img" aria-label="مخطط الزوّار اليوميين">
                {data.dailyVisitors.map((d) => (
                  <div key={d.date} className="flex min-w-[8px] flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.visitors}`}>
                    <div
                      className="w-full rounded-t bg-accent/80 transition-all hover:bg-accent"
                      style={{ height: `${(d.visitors / maxVisitors) * 100}%`, minHeight: d.visitors ? 4 : 0 }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">لا توجد بيانات زيارات بعد</p>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Most viewed items */}
            <Card className="p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">الأكثر مشاهدة</h2>
              {data.mostViewedItems.length ? (
                <ul className="space-y-3">
                  {data.mostViewedItems.map((it) => (
                    <li key={it.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-foreground">{it.name}</span>
                        <span className="shrink-0 text-muted-foreground">{it.viewCount} · {formatPrice(it.price)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(it.viewCount / maxViews) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="لا مشاهدات بعد" description="ستظهر الأطباق الأكثر مشاهدة هنا." className="py-10" />
              )}
            </Card>

            {/* Popular categories */}
            <Card className="p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">الأقسام الأكثر رواجاً</h2>
              {data.popularCategories.length ? (
                <ul className="space-y-3">
                  {data.popularCategories.map((c) => (
                    <li key={c.categoryId ?? c.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-foreground">{c.name}</span>
                        <span className="shrink-0 text-muted-foreground">{c.views}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gold-400" style={{ width: `${(c.views / maxCat) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="لا بيانات بعد" description="ستظهر الأقسام الرائجة هنا." className="py-10" />
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
