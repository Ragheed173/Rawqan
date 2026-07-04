import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

const router = Router();

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/** Dynamic sitemap reflecting live, available menu items (Task 13). */
router.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');
    const items = await prisma.menuItem.findMany({
      where: { isAvailable: true, category: { isActive: true } },
      select: { slug: true, updatedAt: true },
    });

    const urls = [
      { loc: `${base}/`, priority: '1.0' },
      { loc: `${base}/menu`, priority: '0.9' },
      ...items.map((i) => ({
        loc: `${base}/menu/${encodeURIComponent(i.slug)}`,
        lastmod: i.updatedAt.toISOString(),
        priority: '0.7',
      })),
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url><loc>${escapeXml(u.loc)}</loc>` +
            ('lastmod' in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '') +
            `<priority>${u.priority}</priority></url>`,
        )
        .join('\n') +
      `\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  }),
);

/** robots.txt served from the API (frontend also ships a static one). */
router.get('/robots.txt', (_req, res) => {
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${base}/sitemap.xml\n`);
});

export default router;
