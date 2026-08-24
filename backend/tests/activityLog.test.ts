import { describe, expect, it, vi } from "vitest";
import {
  recordActivity,
  writeActivity,
  type ActivityLogClient,
} from "../src/lib/activityLog.js";

const input = {
  adminId: "actor-1",
  actorNameSnapshot: "Main Admin",
  actorRoleSnapshot: "SUPER_ADMIN",
  action: "INVOICE_VOIDED" as const,
  entityType: "Invoice",
  entityId: "invoice-1",
  operationId: "operation-1",
  deviceId: "P01",
  reason: "Test correction",
  beforeData: { status: "PAID" },
  afterData: { status: "VOIDED" },
};

describe("activity audit helper", () => {
  it("awaits an injected transaction-compatible client and maps snapshots", async () => {
    const create = vi.fn().mockResolvedValue({ id: "log-1" });
    const client = { activityLog: { create } } as unknown as ActivityLogClient;

    await expect(writeActivity(input, client)).resolves.toEqual({
      id: "log-1",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorNameSnapshot: "Main Admin",
        actorRoleSnapshot: "SUPER_ADMIN",
        operationId: "operation-1",
        deviceId: "P01",
        reason: "Test correction",
        beforeData: { status: "PAID" },
        afterData: { status: "VOIDED" },
      }),
    });
  });

  it("propagates awaited failures so a surrounding transaction can roll back", async () => {
    const client = {
      activityLog: {
        create: vi.fn().mockRejectedValue(new Error("audit unavailable")),
      },
    } as unknown as ActivityLogClient;
    await expect(writeActivity(input, client)).rejects.toThrow(
      "audit unavailable",
    );
  });

  it("keeps legacy fire-and-forget usage non-throwing", async () => {
    const client = {
      activityLog: {
        create: vi.fn().mockRejectedValue(new Error("best effort failure")),
      },
    } as unknown as ActivityLogClient;
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(() =>
      recordActivity({ action: "UPDATE", entityType: "Settings" }, client),
    ).not.toThrow();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });
});
