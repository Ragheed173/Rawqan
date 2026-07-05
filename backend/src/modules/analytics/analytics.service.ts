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
  const startToday = startOfDaysAgo(1);

  // All aggregation happens in Postgres — no full event scan into Node memory.
  const [totalsRow, dailyRows, topItems, topCategories] = await Promise.all([
    prisma.$queryRaw<{ views: bigint; visitors: bigint; qr: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "type"::text IN ('ITEM_VIEW','PAGE_VIEW')) AS views,
        COUNT(DISTINCT "visitor_id") AS visitors,
        COUNT(*) FILTER (WHERE "type"::text = 'QR_SCAN') AS qr
      FROM "analytics_events"
      WHERE "created_at" >= ${since}`,
    prisma.$queryRaw<{ day: Date; visitors: bigint }[]>`
      SELECT date_trunc('day', "created_at") AS day, COUNT(DISTINCT "visitor_id") AS visitors
      FROM "analytics_events"
      WHERE "created_at" >= ${since}
      GROUP BY day ORDER BY day`,
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
  ]);

  const visitorsToday = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT "visitor_id") AS count
    FROM "analytics_events" WHERE "created_at" >= ${startToday}`;

  // Fill the day series (0 for days with no events).
  const byDay = new Map(dailyRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.visitors)]));
  const dailyVisitors: { date: string; visitors: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyVisitors.push({ date: key, visitors: byDay.get(key) ?? 0 });
  }

  // Resolve popular category names
  const catIds = topCategories.map((c) => c.categoryId).filter((x): x is string => Boolean(x));
  const cats = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const totals = totalsRow[0] ?? { views: 0n, visitors: 0n, qr: 0n };

  return {
    range: { days, since: since.toISOString() },
    totals: {
      views: Number(totals.views),
      visitors: Number(totals.visitors),
      visitorsToday: Number(visitorsToday[0]?.count ?? 0),
      qrScans: Number(totals.qr),
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
