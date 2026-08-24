import { posDb } from "./schema";

export interface PosStorageHealth { available: boolean; persistent: boolean | null; usage?: number; quota?: number; message?: string }

export type PersistenceStatus = "GRANTED" | "NOT_GRANTED" | "UNSUPPORTED";

export async function verifyPosStorage(): Promise<PosStorageHealth> {
  if (!("indexedDB" in globalThis)) return { available: false, persistent: null, message: "IndexedDB غير متاح في هذا المتصفح. أوقف عمليات البيع واستخدم متصفحاً مدعوماً." };
  try {
    await posDb.open();
    await posDb.transaction("rw", posDb.catalogMeta, async () => {
      await posDb.catalogMeta.put({ key: "__storage_probe__", revision: "0", updatedAt: new Date().toISOString() });
      await posDb.catalogMeta.delete("__storage_probe__");
    });
    const [persistent, estimate] = await Promise.all([navigator.storage?.persisted?.() ?? Promise.resolve(null), navigator.storage?.estimate?.() ?? Promise.resolve(undefined)]);
    return { available: true, persistent, usage: estimate?.usage, quota: estimate?.quota, message: persistent === false ? "التخزين غير دائم وقد يُزال تحت ضغط المساحة. اسمح بالتخزين الدائم لهذا الموقع." : undefined };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    const message = name === "QuotaExceededError" ? "مساحة التخزين المحلية ممتلئة. أوقف البيع، أعد الاتصال للمزامنة، ثم حرّر مساحة دون مسح بيانات الموقع." : "تعذر فتح قاعدة بيانات POS المحلية. أغلق ألسنة POS الأخرى ثم أعد المحاولة؛ لا تمسح بيانات الموقع.";
    return { available: false, persistent: null, message };
  }
}

export function persistenceStatus(health: Pick<PosStorageHealth, "persistent">): PersistenceStatus {
  return health.persistent === true ? "GRANTED" : health.persistent === false ? "NOT_GRANTED" : "UNSUPPORTED";
}

export async function requestPosPersistence(): Promise<PosStorageHealth> {
  if (!navigator.storage?.persist) return verifyPosStorage();
  try { await navigator.storage.persist(); } catch { /* Browsers may deny without prompting. */ }
  return verifyPosStorage();
}
