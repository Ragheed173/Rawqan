import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDesktopBackup,
  restoreDesktopBackup,
  validateDesktopRestore,
} from "./backup";
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

  it("restores every table atomically after creating a pre-restore backup", async () => {
    await posDb.categories.put({
      id: "old-category",
      name: "Old",
      isActive: true,
      sortOrder: 1,
    });
    const tables = Object.fromEntries(
      posDb.tables.map((table) => [table.name, []]),
    );
    tables.categories = [
      { id: "restored-category", name: "Restored", isActive: true, sortOrder: 1 },
    ];
    const snapshot = {
      formatVersion: 1 as const,
      databaseName: "rawaqan-pos",
      createdAt: new Date().toISOString(),
      reason: "manual",
      tables,
    };
    const saveLocalBackup = vi.fn().mockResolvedValue({
      ok: true,
      path: "pre-restore.rwqbackup",
      encrypted: true,
      lastBackupAt: new Date().toISOString(),
    });
    window.rawaqanDesktop = {
      isDesktop: true,
      saveLocalBackup,
      selectLocalBackup: vi.fn().mockResolvedValue({
        canceled: false,
        path: "selected.rwqbackup",
        snapshot,
      }),
    } as unknown as RawaqanDesktopBridge;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const result = await restoreDesktopBackup();

    expect(result.canceled).toBe(false);
    expect(saveLocalBackup).toHaveBeenCalledOnce();
    expect(saveLocalBackup.mock.calls[0]?.[0]).toMatchObject({
      reason: "pre-restore",
    });
    expect(await posDb.categories.toArray()).toEqual([
      expect.objectContaining({ id: "restored-category" }),
    ]);
  });

  it("rejects snapshots that do not contain the exact database schema", () => {
    expect(() =>
      validateDesktopRestore({
        formatVersion: 1,
        databaseName: "rawaqan-pos",
        createdAt: new Date().toISOString(),
        reason: "test",
        tables: { categories: [] },
      }),
    ).toThrow("INVALID_BACKUP_SNAPSHOT");
  });
});
