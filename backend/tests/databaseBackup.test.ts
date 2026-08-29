import { describe, expect, it } from "vitest";
import {
  assertSafeRestoreTarget,
  buildCriticalCountsQuery,
  databaseIdentity,
  parseCriticalCounts,
  parsePostgresUrl,
} from "../src/ops/databaseBackup.js";

describe("full database backup safety", () => {
  it("parses a PostgreSQL URL without retaining credentials in its identity", () => {
    const identity = databaseIdentity(
      parsePostgresUrl(
        "source",
        "postgresql://private-user:private-pass@db.example.com:5433/rawaqan?sslmode=require",
      ),
    );
    expect(identity).toEqual({
      host: "db.example.com",
      port: "5433",
      database: "rawaqan",
    });
    expect(JSON.stringify(identity)).not.toContain("private-pass");
  });

  it("refuses a restore target that does not look disposable", () => {
    expect(() =>
      assertSafeRestoreTarget(
        "postgresql://user:pass@db.example.com/rawaqan",
      ),
    ).toThrow(/Refusing restore/);
  });

  it("refuses restoring onto the source database", () => {
    expect(() =>
      assertSafeRestoreTarget(
        "postgresql://user:pass@db.example.com/rawaqan_restore",
        {
          host: "db.example.com",
          port: "5432",
          database: "rawaqan_restore",
        },
      ),
    ).toThrow(/same database/);
  });

  it("allows an explicitly named disposable restore database", () => {
    expect(
      assertSafeRestoreTarget(
        "postgresql://user:pass@db.example.com/rawaqan_restore_test",
        { host: "db.example.com", port: "5432", database: "rawaqan" },
      ).database,
    ).toBe("rawaqan_restore_test");
  });

  it("builds and parses the critical-table verification payload", () => {
    expect(buildCriticalCountsQuery()).toContain('public."payments"');
    expect(
      parseCriticalCounts(
        '{"_prisma_migrations":"11","orders":"2","invoices":"2","payments":"3","cashier_shifts":"1","sync_operations":"4"}\n',
      ),
    ).toEqual({
      _prisma_migrations: "11",
      orders: "2",
      invoices: "2",
      payments: "3",
      cashier_shifts: "1",
      sync_operations: "4",
    });
  });
});
