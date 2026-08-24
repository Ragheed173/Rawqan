import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../prisma/migrations/4_pos_database_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const wholeShekelMigration = readFileSync(
  new URL(
    "../prisma/migrations/7_whole_shekel_catalog_prices/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const POS_MODELS = [
  "PosDevice",
  "DiningTable",
  "Order",
  "OrderTableAssignment",
  "OrderItem",
  "OrderItemModifier",
  "OrderDiscount",
  "ModifierGroup",
  "ModifierOption",
  "MenuItemModifierGroup",
  "Invoice",
  "InvoiceOrder",
  "InvoiceTableSnapshot",
  "InvoiceLine",
  "InvoiceLineModifier",
  "InvoiceDiscount",
  "Payment",
  "InvoiceVoid",
  "Refund",
  "RefundLine",
  "RefundPayment",
  "Reservation",
  "ReservationTable",
  "CashierShift",
  "ReceiptPrintEvent",
  "SyncOperation",
] as const;

function model(name: string): string {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!match) throw new Error(`Missing Prisma model ${name}`);
  return match[1];
}

describe("Phase 2 POS schema foundation", () => {
  it("adds every requested POS model without changing legacy ID strategies", () => {
    for (const name of POS_MODELS) expect(schema).toContain(`model ${name} {`);

    expect(model("Admin")).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(model("MenuItem")).toMatch(
      /id\s+String\s+@id\s+@default\(cuid\(\)\)/,
    );
    expect(model("MenuItem")).toMatch(
      /price\s+Decimal\s+@db\.Decimal\(10, 2\)/,
    );
  });

  it("uses PostgreSQL UUID identities for new locally-created records", () => {
    for (const name of POS_MODELS.filter((name) => name !== "SyncOperation")) {
      expect(model(name)).toMatch(
        /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/,
      );
    }
    expect(model("SyncOperation")).toMatch(/operationId\s+String\s+@id/);
    expect(model("SyncOperation")).toMatch(/operationId[^\n]+@db\.Uuid/);
  });

  it("stores POS money as BigInt minor units and catalog modifier prices as Decimal", () => {
    for (const [name, fields] of Object.entries({
      OrderItem: ["unitPriceMinor", "lineTotalMinor"],
      Invoice: [
        "subtotalMinor",
        "discountMinor",
        "totalMinor",
        "refundedMinor",
      ],
      Payment: ["amountMinor", "tenderedMinor", "changeMinor"],
      Refund: ["amountMinor"],
      CashierShift: [
        "openingCashMinor",
        "cashSalesMinor",
        "cashRefundsMinor",
        "expectedCashMinor",
        "actualClosingCashMinor",
        "differenceMinor",
      ],
    })) {
      const block = model(name);
      for (const field of fields) {
        expect(block).toMatch(
          new RegExp(`${field}\\s+BigInt\\??\\s+.*@db\\.BigInt`),
        );
      }
    }
    expect(model("ModifierOption")).toMatch(
      /price\s+Decimal\s+@default\(0\)\s+@db\.Decimal\(10, 2\)/,
    );
  });

  it("normalizes and protects whole-shekel catalog prices without rewriting financial snapshots", () => {
    expect(wholeShekelMigration).toContain('ROUND("price", 0)');
    expect(wholeShekelMigration).toContain("menu_items_price_whole_shekel_check");
    expect(wholeShekelMigration).toContain("menu_items_discount_price_whole_shekel_check");
    expect(wholeShekelMigration).toContain("modifier_options_price_whole_shekel_check");
    expect(wholeShekelMigration).toContain("WHOLE_SHEKEL_PRICE_MIGRATION");
    expect(wholeShekelMigration).not.toMatch(/UPDATE\s+"(?:orders|order_items|invoices|invoice_lines)"/i);
  });

  it("includes optimistic versions, snapshot fields, and safe nullable catalog/user links", () => {
    expect(model("Order")).toMatch(/version\s+Int\s+@default\(1\)/);
    expect(model("Reservation")).toMatch(/version\s+Int\s+@default\(1\)/);
    expect(model("Invoice")).toContain("cashierNameSnapshot");
    expect(model("InvoiceLine")).toContain("itemNameSnapshot");
    expect(model("InvoiceTableSnapshot")).toContain("tableCodeSnapshot");
    expect(model("Invoice")).toMatch(
      /cashier\s+Admin\?[\s\S]*onDelete: SetNull/,
    );
    expect(model("InvoiceLine")).toMatch(
      /menuItem\s+MenuItem\?[\s\S]*onDelete: SetNull/,
    );
    expect(model("Invoice")).toMatch(
      /device\s+PosDevice[\s\S]*onDelete: Restrict/,
    );
  });

  it("represents idempotency and known uniqueness requirements", () => {
    expect(model("SyncOperation")).toContain(
      "@@unique([deviceId, localSequence])",
    );
    expect(model("Invoice")).toMatch(/invoiceNumber\s+String\s+@unique/);
    expect(migration).toContain("order_table_assignments_one_active_table_key");
    expect(migration).toContain(
      "order_table_assignments_one_active_primary_key",
    );
    expect(migration).toContain("cashier_shifts_one_open_user_device_key");
  });

  it("adds raw SQL checks and append-only financial protections", () => {
    for (const constraint of [
      "dining_tables_disabled_state_check",
      "orders_version_positive_check",
      "order_discounts_requested_value_check",
      "invoices_money_check",
      "payments_cash_tender_check",
      "cashier_shifts_state_check",
      "sync_operations_processed_state_check",
    ]) {
      expect(migration).toContain(constraint);
    }
    expect(migration).toContain("invoice_lines_append_only");
    expect(migration).toContain("refunds_append_only");
    expect(migration).toContain("invoices_no_delete");
    expect(migration).toContain(
      "prevent_pos_append_only_except_reference_unlink",
    );
    expect(migration).not.toMatch(/ON DELETE CASCADE[^\n]*invoices/i);
  });
});
