import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderTree,
  UtensilsCrossed,
  Star,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LazyImage } from '@/components/shared/LazyImage';
import { Seo } from '@/components/shared/Seo';
import { useDashboardStats } from '@/hooks/admin/useAdminQueries';
import { formatPrice } from '@/lib/utils';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

const relTime = (iso: string) => {
  const diff = Date.now() - +new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
};

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();

  return (
    <>
      <Seo title="لوحة التحكم" />
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على قائمتك" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : [
              {
                icon: FolderTree,
                label: 'الأقسام',
                value: data.totals.categories,
                hint: `${data.totals.activeCategories} نشط`,
              },
              {
                icon: UtensilsCrossed,
                label: 'الوجبات',
                value: data.totals.meals,
                hint: `${data.totals.availableMeals} متوفر`,
              },
              { icon: Star, label: 'مميزة', value: data.totals.featured },
              {
                icon: CheckCircle2,
                label: 'نسبة التوفر',
                value: data.totals.meals ? `${Math.round((data.totals.availableMeals / data.totals.meals) * 100)}%` : '—',
              },
            ].map((s, i) => <StatCard key={s.label} {...s} delay={i * 0.06} />)}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent meals */}
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">أحدث الوجبات</h2>
            <Link to="/admin/meals" className="text-sm text-accent hover:underline">
              عرض الكل
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : data && data.recentMeals.length ? (
            <ul className="divide-y divide-border">
              {data.recentMeals.map((meal) => (
                <li key={meal.id} className="flex items-center gap-4 py-3">
                  <LazyImage
                    src={meal.primaryImage?.url}
                    alt={meal.name}
                    wrapperClassName="h-12 w-12 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{meal.name}</p>
                    <p className="text-sm text-muted-foreground">{formatPrice(meal.price)}</p>
                  </div>
                  {!meal.isAvailable && <Badge variant="muted">غير متوفر</Badge>}
                  {meal.isFeatured && <Badge variant="gold">مميز</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد وجبات بعد</p>
          )}
        </Card>

        {/* Activity */}
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">آخر النشاطات</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : data && data.recentActivity.length ? (
            <ul className="space-y-4">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-foreground">{a.summary ?? `${a.action} ${a.entityType}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.admin} · {relTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">لا يوجد نشاط</p>
          )}
        </Card>
      </div>
    </>
  );
}
