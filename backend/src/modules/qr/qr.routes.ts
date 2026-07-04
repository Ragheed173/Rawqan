import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../utils/http.js';

const qrQuery = z.object({
  table: z.string().max(40).optional(),
  size: z.coerce.number().int().min(128).max(2048).optional(),
  format: z.enum(['png', 'svg', 'pdf', 'json']).optional(),
});
type QrQuery = z.infer<typeof qrQuery>;

/** Builds the public menu URL a QR encodes (optionally table-scoped). */
function buildTargetUrl(table?: string): string {
  const url = new URL(env.PUBLIC_SITE_URL);
  // src=qr lets the frontend attribute the visit as a QR scan (Task 22 analytics).
  url.searchParams.set('src', 'qr');
  if (table) url.searchParams.set('table', table);
  return url.toString();
}

const QR_OPTS = {
  errorCorrectionLevel: 'M' as const,
  margin: 2,
  color: { dark: '#111111', light: '#FFFFFF' },
};

/**
 * Renders a QR in the requested format. `allowTable` gates the table param so
 * the public endpoint can only ever encode the bare menu URL.
 */
async function renderQr(req: Request, res: Response, allowTable: boolean) {
  const { table, size = 512, format = 'png' } = req.query as QrQuery;
  const effectiveTable = allowTable ? table : undefined;
  const target = buildTargetUrl(effectiveTable);
  const filename = `rawaqan-qr${effectiveTable ? `-table-${effectiveTable}` : ''}`;

  if (format === 'json') {
    const dataUrl = await QRCode.toDataURL(target, { ...QR_OPTS, width: size });
    return sendSuccess(res, { target, dataUrl });
  }

  if (format === 'svg') {
    const svg = await QRCode.toString(target, { ...QR_OPTS, type: 'svg', width: size });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.svg"`);
    return res.send(svg);
  }

  if (format === 'pdf') {
    const png = await QRCode.toBuffer(target, { ...QR_OPTS, width: 600 });
    const doc = new PDFDocument({ size: 'A6', margin: 24 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).fillColor('#111111').text('روقان', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#777777').text('امسح للاطلاع على القائمة', { align: 'center' });
    doc.moveDown(0.6);
    const imgW = 220;
    doc.image(png, (doc.page.width - imgW) / 2, doc.y, { width: imgW });
    if (effectiveTable) {
      doc.moveDown(0.5).fontSize(12).fillColor('#D4AF37').text(`Table ${effectiveTable}`, { align: 'center' });
    }
    doc.end();
    return;
  }

  // default: png
  const png = await QRCode.toBuffer(target, { ...QR_OPTS, width: size });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.png"`);
  return res.send(png);
}

// Public (mounted at /api/qr) — base menu URL only, no table scoping
export const publicQrRouter = Router();
publicQrRouter.get('/', validate({ query: qrQuery }), asyncHandler((req, res) => renderQr(req, res, false)));

// Admin (mounted at /api/admin/qr) — full control incl. printable table cards
export const adminQrRouter = Router();
adminQrRouter.use(requireAuth);
adminQrRouter.get('/', validate({ query: qrQuery }), asyncHandler((req, res) => renderQr(req, res, true)));
