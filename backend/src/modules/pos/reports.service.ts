import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma.js";
import { sumMinorUnits } from "../../domain/money.js";
import { addRational, compareRational, reduceRational, type RationalQuantity } from "../../domain/pos/rational.js";

export interface ReportRange { from: string; to: string }

export function hourInTimeZone(instant: Date, timeZone: string) {
  const value = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(instant);
  return Number(value);
}

export async function buildSalesReport(range: ReportRange) {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const toExclusive = new Date(`${range.to}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const [invoices, settings] = await Promise.all([prisma.invoice.findMany({
    where: { businessDate: { gte: from, lt: toExclusive } },
    include: {
      payments: { include: { refundPayments: true } },
      refunds: true,
      lines: { include: { menuItem: { include: { category: true } }, refundLines: true } },
      allocationLines: { include: { menuItem: { include: { category: true } } } },
      void: true,
    },
    orderBy: { issuedAt: "asc" },
  }), prisma.restaurantSettings.findFirst({ select: { timezone: true } })]);
  const timeZone = settings?.timezone ?? "Asia/Hebron";
  const completed = invoices.filter((invoice) => invoice.status !== "VOIDED" && invoice.status !== "OPEN");
  const grossSalesMinor = sumMinorUnits(completed.map((invoice) => invoice.subtotalMinor));
  const discountsMinor = sumMinorUnits(completed.map((invoice) => invoice.discountMinor));
  const refundsMinor = sumMinorUnits(completed.map((invoice) => invoice.refundedMinor));
  const netSalesMinor = sumMinorUnits(completed.map((invoice) => invoice.totalMinor - invoice.refundedMinor));
  const paymentNet = (method: "CASH" | "VISA") => sumMinorUnits(completed.flatMap((invoice) => invoice.payments.filter((payment) => payment.method === method).map((payment) => payment.amountMinor - sumMinorUnits(payment.refundPayments.map((refund) => refund.amountMinor)))));
  const itemMap = new Map<string, { id: string; name: string; categoryId: string | null; categoryName: string; quantity: RationalQuantity; revenueMinor: bigint }>();
  const hourMap = new Map<number, bigint>();
  for (const invoice of completed) {
    const hour = hourInTimeZone(invoice.issuedAt, timeZone);
    hourMap.set(hour, (hourMap.get(hour) ?? 0n) + invoice.totalMinor - invoice.refundedMinor);
    for (const line of invoice.lines) {
      const key = line.menuItemId ?? `snapshot:${line.itemNameSnapshot}`;
      const entry = itemMap.get(key) ?? { id: key, name: line.itemNameSnapshot, categoryId: line.menuItem?.categoryId ?? null, categoryName: line.menuItem?.category.name ?? "غير مصنف", quantity: { numerator: 0n, denominator: 1n }, revenueMinor: 0n };
      entry.quantity = addRational(entry.quantity, { numerator: BigInt(line.quantity), denominator: 1n });
      entry.revenueMinor += line.totalMinor - sumMinorUnits(line.refundLines.map((refund) => refund.amountMinor));
      itemMap.set(key, entry);
    }
    for (const line of invoice.allocationLines) {
      const key = line.menuItemId ?? `snapshot:${line.itemNameSnapshot}`;
      const entry = itemMap.get(key) ?? { id: key, name: line.itemNameSnapshot, categoryId: line.menuItem?.categoryId ?? null, categoryName: line.menuItem?.category.name ?? "غير مصنف", quantity: { numerator: 0n, denominator: 1n }, revenueMinor: 0n };
      entry.quantity = addRational(entry.quantity, { numerator: line.quantityNumerator, denominator: line.quantityDenominator });
      entry.revenueMinor += line.totalMinor;
      itemMap.set(key, entry);
    }
  }
  const items = [...itemMap.values()].map((item) => ({ ...item, quantity: reduceRational(item.quantity), quantityNumerator: reduceRational(item.quantity).numerator, quantityDenominator: reduceRational(item.quantity).denominator })).sort((a, b) => a.revenueMinor === b.revenueMinor ? -compareRational(a.quantity, b.quantity) : a.revenueMinor > b.revenueMinor ? -1 : 1);
  const categoryMap = new Map<string, { id: string | null; name: string; revenueMinor: bigint; quantity: RationalQuantity }>();
  for (const item of items) {
    const key = item.categoryId ?? "uncategorized";
    const category = categoryMap.get(key) ?? { id: item.categoryId, name: item.categoryName, revenueMinor: 0n, quantity: { numerator: 0n, denominator: 1n } };
    category.revenueMinor += item.revenueMinor;
    category.quantity = addRational(category.quantity, item.quantity);
    categoryMap.set(key, category);
  }
  const salesByHour = [...hourMap.entries()].map(([hour, revenueMinor]) => ({ hour, revenueMinor })).sort((a, b) => a.hour - b.hour);
  const invoiceCount = completed.length;
  return {
    range,
    timeZone,
    grossSalesMinor,
    discountsMinor,
    refundsMinor,
    netSalesMinor,
    cashMinor: paymentNet("CASH"),
    visaMinor: paymentNet("VISA"),
    invoiceCount,
    averageInvoiceMinor: invoiceCount ? netSalesMinor / BigInt(invoiceCount) : 0n,
    voidCount: invoices.filter((invoice) => invoice.status === "VOIDED").length,
    voidValueMinor: sumMinorUnits(invoices.filter((invoice) => invoice.status === "VOIDED").map((invoice) => invoice.totalMinor)),
    topItems: items.slice(0, 20),
    categories: [...categoryMap.values()].map((category) => { const quantity = reduceRational(category.quantity); return { ...category, quantity, quantityNumerator: quantity.numerator, quantityDenominator: quantity.denominator }; }).sort((a, b) => a.revenueMinor > b.revenueMinor ? -1 : 1),
    salesByHour,
    peakHour: salesByHour.reduce<{ hour: number; revenueMinor: bigint } | null>((peak, row) => !peak || row.revenueMinor > peak.revenueMinor ? row : peak, null),
  };
}

export async function exportSalesPdf(range: ReportRange): Promise<Buffer> {
  const report = await buildSalesReport(range);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(18).text("Rawaqan POS Sales Report");
    doc.fontSize(10).text(`${range.from} — ${range.to}`);
    doc.moveDown();
    const rows: [string, string | number][] = [
      ["Gross sales (minor)", report.grossSalesMinor.toString()], ["Discounts (minor)", report.discountsMinor.toString()],
      ["Refunds (minor)", report.refundsMinor.toString()], ["Net sales (minor)", report.netSalesMinor.toString()],
      ["Cash (minor)", report.cashMinor.toString()], ["Visa (minor)", report.visaMinor.toString()], ["Invoices", report.invoiceCount],
    ];
    for (const [label, value] of rows) doc.text(`${label}: ${value}`);
    doc.moveDown().fontSize(14).text("Top items").fontSize(10);
    for (const item of report.topItems) doc.text(`${item.name} — ${item.quantityNumerator.toString()}/${item.quantityDenominator.toString()} — ${item.revenueMinor.toString()}`);
    doc.end();
  });
}

export async function exportSalesXlsx(range: ReportRange): Promise<Buffer> {
  const report = await buildSalesReport(range);
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Summary");
  summary.addRows([["Metric", "Minor units"], ["Gross sales", report.grossSalesMinor.toString()], ["Discounts", report.discountsMinor.toString()], ["Refunds", report.refundsMinor.toString()], ["Net sales", report.netSalesMinor.toString()], ["Cash", report.cashMinor.toString()], ["Visa", report.visaMinor.toString()], ["Invoice count", report.invoiceCount], ["Average invoice", report.averageInvoiceMinor.toString()], ["Void count", report.voidCount], ["Void value", report.voidValueMinor.toString()]]);
  summary.columns = [{ width: 24 }, { width: 24 }];
  const items = workbook.addWorksheet("Items");
  items.addRow(["Item", "Category", "Quantity", "Revenue minor"]);
  report.topItems.forEach((item) => items.addRow([item.name, item.categoryName, `${item.quantityNumerator.toString()}/${item.quantityDenominator.toString()}`, item.revenueMinor.toString()]));
  items.columns = [{ width: 32 }, { width: 24 }, { width: 12 }, { width: 20 }];
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}
