import { describe, expect, it } from "vitest";
import {
  calculateReceiptPageHeightMm,
  renderReceiptHtml,
  type ReceiptData,
} from "./ReceiptPrinter";

function fixture(): ReceiptData {
  const invoice = {
    id: "invoice-1",
    invoiceNumber: "INV-2026-0001",
    orderId: "order-1",
    status: "PAID" as const,
    businessDate: "2026-08-24",
    subtotalMinor: "12345",
    discountMinor: "345",
    totalMinor: "12000",
    refundedMinor: "0",
    cashierId: "user-1",
    deviceId: "device-1",
    issuedAt: "2026-08-24T18:00:00.000Z",
    splitGroupId: null,
    splitMode: "ITEM" as const,
    splitIndex: 1,
    splitCount: 2,
  };
  const items = Array.from({ length: 22 }, (_, index) => ({
    id: `line-${index}`,
    invoiceId: invoice.id,
    orderItemId: `order-line-${index}`,
    itemNameSnapshot:
      index === 0
        ? "وجبة طويلة جداً لاختبار التفاف الاسم English fallback"
        : `صنف ${index + 1}`,
    unitPriceMinor: "500",
    quantity: 1,
    subtotalMinor: "500",
    discountMinor: "0",
    totalMinor: "500",
    sortOrder: index,
  }));
  return {
    restaurantName: "مطعم روقان — Rawaqan Restaurant With A Long Name",
    footer: "شكراً لزيارتكم\nThank you",
    invoice,
    tableNames: ["الطاولة 12"],
    cashierName: "الكاشير",
    items,
    modifiers: [
      {
        id: "modifier-1",
        invoiceLineId: "line-0",
        groupNameSnapshot: "الحجم",
        optionNameSnapshot: "كبير Large",
        priceTypeSnapshot: "DELTA",
        unitPriceMinor: "100",
        quantity: 1,
        totalMinor: "100",
      },
    ],
    payments: [
      {
        id: "payment-1",
        invoiceId: invoice.id,
        method: "CASH",
        amountMinor: "7000",
        tenderedMinor: "10000",
        changeMinor: "3000",
        status: "COMPLETED",
        paidAt: invoice.issuedAt,
      },
      {
        id: "payment-2",
        invoiceId: invoice.id,
        method: "VISA",
        amountMinor: "5000",
        status: "COMPLETED",
        paidAt: invoice.issuedAt,
      },
    ],
    isReprint: true,
  };
}

describe("receipt renderer", () => {
  it.each(["58mm", "80mm"] as const)(
    "renders a hardened %s receipt",
    (profile) => {
      const html = renderReceiptHtml(fixture(), profile);
      expect(html).toContain(`@page{size:${profile} auto;margin:0}`);
      expect(html).toContain(`width:${profile}`);
      expect(html).toContain(
        `width:${profile === "58mm" ? "48mm" : "72mm"}`,
      );
      expect(html).toContain('id="receipt-page-size"');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain("unicode-bidi:embed");
      expect(html).toContain("نسخة معاد طباعتها / REPRINT");
      expect(html).toContain("تقسيم حسب الأصناف");
      expect(html).toContain("الحجم");
      expect(html).toContain("نقدي");
      expect(html).toContain("Visa");
      expect(html).toContain("المستلم: 100 ₪");
      expect(html).toContain("الباقي: 30 ₪");
      expect((html.match(/class="row line"/g) ?? []).length).toBe(22);
      expect(html).toContain("overflow-wrap:anywhere");
      expect(html).toContain("break-inside:avoid");
      expect(html).toContain('class="paper-feed"');
      expect(html).toContain("height:15mm");
    },
  );

  it("adds a safe paper-feed buffer to the measured receipt height", () => {
    expect(calculateReceiptPageHeightMm(0)).toBe(40);
    expect(calculateReceiptPageHeightMm((96 / 25.4) * 100)).toBe(105);
  });
});
