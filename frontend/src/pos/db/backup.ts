import { posDb } from "./schema";

export interface PosBackupSnapshot {
  formatVersion: 1;
  databaseName: string;
  createdAt: string;
  reason: string;
  tables: Record<string, unknown[]>;
}

let timer: number | undefined;
let running: Promise<void> | null = null;

export async function createDesktopBackup(reason = "manual") {
  const desktop = window.rawaqanDesktop;
  if (!desktop?.isDesktop || !desktop.saveLocalBackup) return null;

  const tables = await posDb.transaction("r", posDb.tables, async () =>
    Object.fromEntries(
      await Promise.all(
        posDb.tables.map(async (table) => [table.name, await table.toArray()]),
      ),
    ),
  );
  const snapshot: PosBackupSnapshot = {
    formatVersion: 1,
    databaseName: posDb.name,
    createdAt: new Date().toISOString(),
    reason,
    tables,
  };
  return desktop.saveLocalBackup(snapshot);
}

export function validateDesktopRestore(snapshot: PosBackupSnapshot) {
  const expected = posDb.tables.map((table) => table.name).sort();
  const actual = Object.keys(snapshot?.tables ?? {}).sort();
  if (
    snapshot?.formatVersion !== 1 ||
    snapshot.databaseName !== posDb.name ||
    !Number.isFinite(Date.parse(snapshot.createdAt)) ||
    expected.length !== actual.length ||
    expected.some((name, index) => name !== actual[index]) ||
    actual.some((name) => !Array.isArray(snapshot.tables[name]))
  ) {
    throw new Error("INVALID_BACKUP_SNAPSHOT");
  }
}

export async function restoreDesktopBackup() {
  const desktop = window.rawaqanDesktop;
  if (!desktop?.isDesktop || !desktop.selectLocalBackup)
    throw new Error("RESTORE_UNAVAILABLE");

  const unresolved = await posDb.syncOperations
    .toCollection()
    .filter((operation) => operation.status !== "SUCCEEDED")
    .count();
  if (unresolved > 0) throw new Error("RESTORE_UNRESOLVED_OPERATIONS");

  const selected = await desktop.selectLocalBackup();
  if (selected.canceled) return { canceled: true as const };
  validateDesktopRestore(selected.snapshot);
  const accepted = window.confirm(
    `سيتم استبدال بيانات POS المحلية بنسخة ${new Date(selected.snapshot.createdAt).toLocaleString("ar")}، بعد إنشاء نسخة أمان تلقائية. هل تريد المتابعة؟`,
  );
  if (!accepted) return { canceled: true as const };

  await createDesktopBackup("pre-restore");
  await posDb.transaction("rw", posDb.tables, async () => {
    for (const table of posDb.tables) await table.clear();
    for (const table of posDb.tables) {
      const rows = selected.snapshot.tables[table.name];
      if (rows.length > 0) await table.bulkPut(rows);
    }
  });
  return {
    canceled: false as const,
    restoredAt: selected.snapshot.createdAt,
    path: selected.path,
  };
}

export function scheduleDesktopBackup(reason = "data-change") {
  if (!window.rawaqanDesktop?.isDesktop) return;
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    running ??= createDesktopBackup(reason)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        running = null;
      });
  }, 750);
}

export async function flushDesktopBackup(reason = "manual") {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
  if (running) await running;
  await createDesktopBackup(reason);
}
