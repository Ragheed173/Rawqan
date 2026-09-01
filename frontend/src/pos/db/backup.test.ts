import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopBackup } from "./backup";
import { posDb } from "./schema";

beforeEach(async () => {
  delete window.rawaqanDesktop;
  posDb.close();
  await posDb.delete();
  await posDb.open();
});

describe("desktop POS backups", () => {
  it("exports every IndexedDB table through the restricted desktop bridge", async () => {
    const saveLocalBackup = vi.fn().mockResolvedValue({
      ok: true,
      path: "backup.rwqbackup",
      encrypted: true,
      lastBackupAt: new Date().toISOString(),
    });
    window.rawaqanDesktop = {
      isDesktop: true,
      saveLocalBackup,
    } as unknown as RawaqanDesktopBridge;
    await posDb.categories.put({
      id: "category-1",
      name: "Test",
      isActive: true,
      sortOrder: 1,
    });

    await createDesktopBackup("test");

    expect(saveLocalBackup).toHaveBeenCalledOnce();
    expect(saveLocalBackup.mock.calls[0]?.[0]).toMatchObject({
      formatVersion: 1,
      databaseName: "rawaqan-pos",
      reason: "test",
      tables: {
        categories: [expect.objectContaining({ id: "category-1" })],
      },
    });
  });
});
