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
