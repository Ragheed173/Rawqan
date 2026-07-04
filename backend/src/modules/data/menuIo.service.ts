import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma.js';
import { uniqueSlug } from '../../utils/slug.js';
import { decimalToNumber } from '../../utils/serializers.js';

const COLUMNS = [
  { header: 'Category', key: 'Category', width: 20 },
  { header: 'CategoryEn', key: 'CategoryEn', width: 18 },
  { header: 'Name', key: 'Name', width: 24 },
  { header: 'NameEn', key: 'NameEn', width: 20 },
  { header: 'Description', key: 'Description', width: 36 },
  { header: 'Ingredients', key: 'Ingredients', width: 30 },
  { header: 'Price', key: 'Price', width: 10 },
  { header: 'DiscountPrice', key: 'DiscountPrice', width: 14 },
  { header: 'Calories', key: 'Calories', width: 10 },
  { header: 'Allergens', key: 'Allergens', width: 18 },
  { header: 'SpiceLevel', key: 'SpiceLevel', width: 12 },
  { header: 'Available', key: 'Available', width: 10 },
  { header: 'Featured', key: 'Featured', width: 10 },
  { header: 'BestSeller', key: 'BestSeller', width: 12 },
  { header: 'New', key: 'New', width: 8 },
  { header: 'Vegetarian', key: 'Vegetarian', width: 12 },
  { header: 'ChefRecommendation', key: 'ChefRecommendation', width: 18 },
];

type Row = Record<string, string | number | null>;

/** Flattens the menu into spreadsheet rows. */
async function toRows(): Promise<Row[]> {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  const rows: Row[] = [];
  for (const c of categories) {
    for (const it of c.items) {
      rows.push({
        Category: c.name,
        CategoryEn: c.nameEn ?? '',
        Name: it.name,
        NameEn: it.nameEn ?? '',
        Description: it.description ?? '',
        Ingredients: it.ingredients ?? '',
        Price: decimalToNumber(it.price) ?? 0,
        DiscountPrice: decimalToNumber(it.discountPrice) ?? '',
        Calories: it.calories ?? '',
        Allergens: it.allergens ?? '',
        SpiceLevel: it.spiceLevel,
        Available: it.isAvailable ? 'yes' : 'no',
        Featured: it.isFeatured ? 'yes' : 'no',
        BestSeller: it.isBestSeller ? 'yes' : 'no',
        New: it.isNew ? 'yes' : 'no',
        Vegetarian: it.isVegetarian ? 'yes' : 'no',
        ChefRecommendation: it.isChefRecommendation ? 'yes' : 'no',
      });
    }
  }
  return rows;
}

function buildWorkbook(rows: Row[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rawaqan';
  const ws = wb.addWorksheet('Menu');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  return wb;
}

export async function exportBuffer(format: 'xlsx' | 'csv'): Promise<Buffer> {
  const wb = buildWorkbook(await toRows());
  const out = format === 'csv' ? await wb.csv.writeBuffer() : await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

const yes = (v: unknown) => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'yes' || s === '1' || s === 'true' || s === 'نعم';
};
const spice = (v: unknown) => {
  const s = String(v ?? 'NONE').trim().toUpperCase();
  return (['NONE', 'MILD', 'MEDIUM', 'HOT'] as const).includes(s as never) ? (s as 'NONE') : 'NONE';
};
const cellText = (cell: ExcelJS.Cell): string => {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'text' in v) return String((v as { text: unknown }).text ?? '');
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result ?? '');
  return String(v);
};

export interface ImportResult {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
}

/**
 * Imports an .xlsx/.csv buffer. Categories are matched/created by name; items are
 * upserted by (category, name). Re-importing updates existing items.
 */
export async function importBuffer(buffer: Buffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer).catch(async () => {
    // Fall back to CSV parsing when the upload isn't a real xlsx.
    const { Readable } = await import('node:stream');
    await wb.csv.read(Readable.from(buffer));
  });

  const ws = wb.worksheets[0];
  const result: ImportResult = { categoriesCreated: 0, itemsCreated: 0, itemsUpdated: 0, errors: [] };
  if (!ws) {
    result.errors.push('لا توجد ورقة عمل في الملف');
    return result;
  }

  // Map header names → column index from the first row.
  const headers: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    headers[cellText(cell).trim()] = col;
  });
  const get = (row: ExcelJS.Row, key: string) => (headers[key] ? cellText(row.getCell(headers[key])) : '');

  const categoryCache = new Map<string, string>();

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const categoryName = get(row, 'Category').trim();
    const name = get(row, 'Name').trim();
    const priceRaw = get(row, 'Price').trim();
    if (!categoryName && !name && !priceRaw) continue; // skip blank lines

    const price = Number(priceRaw);
    if (!categoryName || !name) {
      result.errors.push(`السطر ${r}: القسم والاسم مطلوبان`);
      continue;
    }
    if (!Number.isFinite(price) || price < 0) {
      result.errors.push(`السطر ${r}: سعر غير صالح`);
      continue;
    }

    try {
      let categoryId = categoryCache.get(categoryName);
      if (!categoryId) {
        const existing = await prisma.category.findFirst({ where: { name: categoryName } });
        if (existing) {
          categoryId = existing.id;
        } else {
          const slug = await uniqueSlug(get(row, 'CategoryEn') || categoryName, (s) =>
            prisma.category.findFirst({ where: { slug: s }, select: { id: true } }).then(Boolean),
          );
          const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
          const created = await prisma.category.create({
            data: {
              name: categoryName,
              nameEn: get(row, 'CategoryEn') || null,
              slug,
              sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
          });
          categoryId = created.id;
          result.categoriesCreated++;
        }
        categoryCache.set(categoryName, categoryId);
      }

      const discountRaw = get(row, 'DiscountPrice').trim();
      const caloriesRaw = get(row, 'Calories').trim();
      const data = {
        name,
        nameEn: get(row, 'NameEn') || null,
        description: get(row, 'Description') || null,
        ingredients: get(row, 'Ingredients') || null,
        price,
        discountPrice: discountRaw ? Number(discountRaw) : null,
        calories: caloriesRaw ? Number(caloriesRaw) : null,
        allergens: get(row, 'Allergens') || null,
        spiceLevel: spice(get(row, 'SpiceLevel')),
        isAvailable: get(row, 'Available').trim() === '' ? true : yes(get(row, 'Available')),
        isFeatured: yes(get(row, 'Featured')),
        isBestSeller: yes(get(row, 'BestSeller')),
        isNew: yes(get(row, 'New')),
        isVegetarian: yes(get(row, 'Vegetarian')),
        isChefRecommendation: yes(get(row, 'ChefRecommendation')),
      };

      const existingItem = await prisma.menuItem.findFirst({ where: { categoryId, name } });
      if (existingItem) {
        await prisma.menuItem.update({ where: { id: existingItem.id }, data });
        result.itemsUpdated++;
      } else {
        const slug = await uniqueSlug(get(row, 'NameEn') || name, (s) =>
          prisma.menuItem.findFirst({ where: { slug: s }, select: { id: true } }).then(Boolean),
        );
        const max = await prisma.menuItem.aggregate({ where: { categoryId }, _max: { sortOrder: true } });
        await prisma.menuItem.create({
          data: { ...data, categoryId, slug, sortOrder: (max._max.sortOrder ?? 0) + 1 },
        });
        result.itemsCreated++;
      }
    } catch (err) {
      result.errors.push(`السطر ${r}: ${(err as Error).message}`);
    }
  }

  return result;
}
