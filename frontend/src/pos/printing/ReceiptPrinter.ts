import type {
  LocalInvoice,
  LocalInvoiceAllocationLine,
  LocalInvoiceAllocationModifier,
  LocalInvoiceLine,
  LocalInvoiceModifier,
  LocalPayment,
} from "../types";
import { formatMinor, paymentMethodLabel } from "../format";

export interface ReceiptData {
  restaurantName: string;
  footer?: string | null;
  invoice: LocalInvoice;
  tableNames: string[];
  cashierName: string;
  items: LocalInvoiceLine[];
  modifiers?: LocalInvoiceModifier[];
  allocationLines?: LocalInvoiceAllocationLine[];
  allocationModifiers?: LocalInvoiceAllocationModifier[];
  payments: LocalPayment[];
  isReprint?: boolean;
}
export interface ReceiptPrinter {
  print(data: ReceiptData, profile?: "80mm" | "58mm"): Promise<void>;
}

const CSS_PIXELS_PER_MM = 96 / 25.4;
const RECEIPT_BOTTOM_FEED_MM = 3;

export function calculateReceiptPageHeightMm(contentHeightPx: number) {
  return Math.max(
    30,
    Math.ceil(contentHeightPx / CSS_PIXELS_PER_MM + RECEIPT_BOTTOM_FEED_MM),
  );
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function renderReceiptHtml(
  data: ReceiptData,
  profile: "80mm" | "58mm" = "80mm",
) {
  const width = profile === "58mm" ? "58mm" : "80mm";
  const printableWidth = profile === "58mm" ? "48mm" : "72mm";
  const splitLabel = data.invoice.splitMode
    ? `<div class="split">${data.invoice.splitMode === "EQUAL" ? "تقسيم متساوٍ" : "تقسيم حسب الأصناف"} — فاتورة ${data.invoice.splitIndex} من ${data.invoice.splitCount}</div>`
    : "";
  const modifierRows = (lineId: string, allocated: boolean) =>
    (allocated
      ? data.allocationModifiers?.filter(
          (modifier) => modifier.invoiceAllocationLineId === lineId,
        )
      : data.modifiers?.filter((modifier) => modifier.invoiceLineId === lineId)
    )
      ?.map(
        (modifier) =>
          `<div class="modifier">+ ${escapeHtml(modifier.groupNameSnapshot)}: ${escapeHtml(modifier.optionNameSnapshot)}</div>`,
      )
      .join("") ?? "";
  const lines =
    data.invoice.splitMode === "EQUAL"
      ? (data.allocationLines ?? [])
          .map(
            (item) =>
              `<div class="row line"><span>${escapeHtml(item.itemNameSnapshot)} — حصة ${escapeHtml(item.quantityNumerator)}/${escapeHtml(item.quantityDenominator)}</span><span class="money">${formatMinor(item.totalMinor)}</span></div>${modifierRows(item.id, true)}`,
          )
          .join("")
      : data.items
          .map(
            (item) =>
              `<div class="row line"><span>${escapeHtml(item.itemNameSnapshot)} × <span class="ltr">${item.quantity}</span></span><span class="money">${formatMinor(item.totalMinor)}</span></div>${modifierRows(item.id, false)}`,
          )
          .join("");
  const discount =
    BigInt(data.invoice.discountMinor) > 0n
      ? `<div class="row"><span>الخصم</span><span class="money">-${formatMinor(data.invoice.discountMinor)}</span></div>`
      : "";
  const paymentRows = data.payments
    .map(
      (payment) =>
        `<div class="payment"><div class="row"><span>${paymentMethodLabel(payment.method)}</span><span class="money">${formatMinor(payment.amountMinor)}</span></div>${payment.tenderedMinor ? `<div class="subrow"><span>المستلم: ${formatMinor(payment.tenderedMinor)}</span><span>الباقي: ${formatMinor(payment.changeMinor ?? "0")}</span></div>` : ""}</div>`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(data.invoice.invoiceNumber)}</title><style id="receipt-page-size">
@page{size:${width} auto;margin:0}</style><style>*{box-sizing:border-box}html{margin:0;padding:0;width:${width};background:#fff;color:#000;color-scheme:light}body{margin:0 auto;padding:0;width:${width};max-width:${width};overflow-x:hidden;background:#fff;color:#000;font-family:Arial,"Noto Sans Arabic",sans-serif;font-size:${profile === "58mm" ? "10.5px" : "12px"};line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}.receipt{width:${printableWidth};max-width:${printableWidth};margin:0 auto;padding:2mm 0 3mm;overflow-wrap:anywhere}h1{margin:0 0 2mm;text-align:center;font-size:${profile === "58mm" ? "16px" : "19px"};line-height:1.25}.meta{margin:.6mm 0}.ltr,.money{direction:ltr;unicode-bidi:embed}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;padding:1.2mm 0;break-inside:avoid;page-break-inside:avoid}.row>span:first-child{min-width:0;flex:1}.money{white-space:nowrap}.line{border-bottom:.25mm dashed #999}.modifier{padding:.4mm 3mm .4mm 0;font-size:.88em;break-inside:avoid;page-break-inside:avoid}.total{border-top:.4mm solid #000;font-size:1.2em;font-weight:700}.payment{break-inside:avoid;page-break-inside:avoid}.subrow{display:flex;justify-content:space-between;gap:2mm;font-size:.88em}.split,.reprint{margin:1mm 0;padding:1mm;text-align:center;border:.3mm solid #000;font-weight:700}.footer{text-align:center;white-space:pre-wrap;margin:2mm 0 0}@media screen{body{box-shadow:0 0 8px #aaa}}@media print{html,body{box-shadow:none}.receipt{break-after:auto;page-break-after:auto}}
</style></head><body><main class="receipt"><h1>${escapeHtml(data.restaurantName)}</h1>${data.isReprint ? '<div class="reprint">نسخة معاد طباعتها / REPRINT</div>' : ""}<div class="meta ltr">${escapeHtml(data.invoice.invoiceNumber)}</div>${splitLabel}<div class="meta">${escapeHtml(data.tableNames.join("، ") || "بدون طاولة")}</div><div class="meta">${escapeHtml(data.cashierName)} — <span class="ltr">${escapeHtml(data.invoice.issuedAt)}</span></div>${lines}<div class="row"><span>المجموع الفرعي</span><span class="money">${formatMinor(data.invoice.subtotalMinor)}</span></div>${discount}<div class="row total"><span>الإجمالي</span><span class="money">${formatMinor(data.invoice.totalMinor)}</span></div>${paymentRows}<p class="footer">${escapeHtml(data.footer ?? "")}</p></main></body></html>`;
}

export class BrowserReceiptPrinter implements ReceiptPrinter {
  async print(data: ReceiptData, profile: "80mm" | "58mm" = "80mm") {
    const popup = window.open(
      "",
      "rawaqan-receipt",
      "popup,width=420,height=720",
    );
    if (!popup) throw new Error("PRINT_POPUP_BLOCKED");
    popup.document.write(renderReceiptHtml(data, profile));
    popup.document.close();
    await new Promise<void>((resolve) => {
      if (popup.document.readyState === "complete") resolve();
      else popup.addEventListener("load", () => resolve(), { once: true });
    });
    await popup.document.fonts?.ready;
    await new Promise<void>((resolve) =>
      popup.requestAnimationFrame(() =>
        popup.requestAnimationFrame(() => resolve()),
      ),
    );

    const receipt = popup.document.querySelector<HTMLElement>(".receipt");
    const pageStyle = popup.document.querySelector<HTMLStyleElement>(
      "#receipt-page-size",
    );
    if (receipt && pageStyle) {
      const heightMm = calculateReceiptPageHeightMm(receipt.scrollHeight);
      pageStyle.textContent = `@page{size:${profile} ${heightMm}mm;margin:0}`;
      await new Promise<void>((resolve) =>
        popup.requestAnimationFrame(() => resolve()),
      );
    }
    popup.focus();
    popup.print();
  }
}
