import crypto from 'node:crypto';
import type { AnalyticsEventType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { decimalToNumber } from '../../utils/serializers.js';

/** Coarse, privacy-preserving visitor id: hash(ip + ua + day). Rotates daily. */
export function visitorIdFor(ip?: string, userAgent?: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${ip ?? ''}|${userAgent ?? ''}|${day}`).digest('hex').slice(0, 32);
}

interface TrackInput {
  type: AnalyticsEventType;
  itemId?: string;
  categoryId?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
}

/** Records an event (fire-and-forget) and bumps item view counts. */
export function track(input: TrackInput): void {
  const visitorId = visitorIdFor(input.ip, input.userAgent);
  prisma.analyticsEvent
    .create({
      data: {
        type: input.type,
        itemId: input.itemId,
        categoryId: input.categoryId,
        path: input.path,
        visitorId,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    })
    .catch((err) => console.error('[analytics] track failed:', err));

  if (input.type === 'ITEM_VIEW' && input.itemId) {
    prisma.menuItem
      .update({ where: { id: input.itemId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {
        /* item may have been deleted; ignore */
      });
  }
}

const startOfDaysAgo = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
};

/** Aggregated dashboard metrics over a rolling window. */
export async function summary(days = 30) {
  const since = startOfDaysAgo(days);

  const [events, topItems, topCategories, qrScans, uniqueToday] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, visitorId: true, createdAt: true },
    }),
    prisma.menuItem.findMany({
      where: { viewCount: { gt: 0 } },
      orderBy: { viewCount: 'desc' },
      take: 8,
      select: { id: true, name: true, viewCount: true, price: true, category: { select: { name: true } } },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['categoryId'],
      where: { type: 'CATEGORY_VIEW', createdAt: { gte: since }, categoryId: { not: null } },
      _count: { categoryId: true },
      orderBy: { _count: { categoryId: 'desc' } },
      take: 6,
    }),
    prisma.analyticsEvent.count({ where: { type: 'QR_SCAN', createdAt: { gte: since } } }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: startOfDaysAgo(1) } },
      select: { visitorId: true },
      distinct: ['visitorId'],
    }),
  ]);

  // Daily visitors: unique visitorIds per day
  const byDay = new Map<string, Set<string>>();
  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, new Set());
    if (e.visitorId) byDay.get(key)!.add(e.visitorId);
  }
  const dailyVisitors: { date: string; visitors: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyVisitors.push({ date: key, visitors: byDay.get(key)?.size ?? 0 });
  }

  // Resolve popular category names
  const catIds = topCategories.map((c) => c.categoryId).filter((x): x is string => Boolean(x));
  const cats = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const totalViews = events.filter((e) => e.type === 'ITEM_VIEW' || e.type === 'PAGE_VIEW').length;
  const totalVisitors = new Set(events.map((e) => e.visitorId).filter(Boolean)).size;

  return {
    range: { days, since: since.toISOString() },
    totals: {
      views: totalViews,
      visitors: totalVisitors,
      visitorsToday: uniqueToday.length,
      qrScans,
    },
    dailyVisitors,
    mostViewedItems: topItems.map((i) => ({
      id: i.id,
      name: i.name,
      viewCount: i.viewCount,
      price: decimalToNumber(i.price),
      category: i.category.name,
    })),
    popularCategories: topCategories.map((c) => ({
      categoryId: c.categoryId,
      name: c.categoryId ? catName.get(c.categoryId) ?? '—' : '—',
      views: c._count.categoryId,
    })),
  };
}
