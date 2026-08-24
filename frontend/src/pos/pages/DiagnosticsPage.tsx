import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { posDb } from "../db/schema";
import { usePosLive } from "../hooks/usePosLive";
import { checkBackendHealth, syncNow } from "../sync/engine";
import {
  persistenceStatus,
  requestPosPersistence,
  verifyPosStorage,
  type PosStorageHealth,
} from "../db/diagnostics";

interface WorkerStatus {
  version: string;
  shellReady: boolean;
  controlled: boolean;
}

async function serviceWorkerStatus(): Promise<WorkerStatus> {
  if (!("serviceWorker" in navigator))
    return { version: "غير مدعوم", shellReady: false, controlled: false };
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.active;
  if (!worker)
    return { version: "غير نشط", shellReady: false, controlled: false };
  const result = await new Promise<{ version: string; shellReady: boolean }>(
    (resolve) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(
        () => resolve({ version: "غير معروف", shellReady: false }),
        1500,
      );
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data as { version: string; shellReady: boolean });
      };
      worker.postMessage({ type: "GET_STATUS" }, [channel.port2]);
    },
  );
  return { ...result, controlled: Boolean(navigator.serviceWorker.controller) };
}

const bytes = (value?: number) =>
  value == null ? "غير متاح" : `${(value / 1024 / 1024).toFixed(1)} MB`;
const persistenceLabels = {
  GRANTED: "ممنوح",
  NOT_GRANTED: "غير ممنوح",
  UNSUPPORTED: "غير مدعوم",
} as const;

export default function DiagnosticsPage() {
  const state = usePosLive(
    () => posDb.deviceState.get("primary"),
    undefined,
    [],
  );
  const session = usePosLive(
    () => posDb.offlineSession.toCollection().first(),
    undefined,
    [],
  );
  const pending = usePosLive(
    () =>
      posDb.syncOperations.where("status").anyOf("PENDING", "SYNCING").count(),
    0,
    [],
  );
  const failed = usePosLive(
    () => posDb.syncOperations.where("status").equals("FAILED").count(),
    0,
    [],
  );
  const conflicts = usePosLive(
    () => posDb.syncOperations.where("status").equals("CONFLICT").count(),
    0,
    [],
  );
  const attention = usePosLive(
    () =>
      posDb.syncOperations
        .where("status")
        .anyOf("FAILED", "CONFLICT")
        .sortBy("createdAt"),
    [],
    [],
  );
  const [storage, setStorage] = useState<PosStorageHealth>({
    available: false,
    persistent: null,
  });
  const [backend, setBackend] = useState<boolean | null>(null);
  const [worker, setWorker] = useState<WorkerStatus>({
    version: "جارٍ الفحص",
    shellReady: false,
    controlled: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async (requestPersistence = false) => {
    if (busy) return;
    setBusy(true);
    const [nextStorage, nextBackend, nextWorker] = await Promise.all([
      requestPersistence ? requestPosPersistence() : verifyPosStorage(),
      checkBackendHealth(),
      serviceWorkerStatus(),
    ]);
    setStorage(nextStorage);
    setBackend(nextBackend);
    setWorker(nextWorker);
    setBusy(false);
  };
  useEffect(() => {
    void refresh();
  }, []);
  const retrySync = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await syncNow();
      setMessage("اكتملت محاولة المزامنة. راجع العدادات أدناه.");
    } catch {
      setMessage(
        "لم تكتمل المزامنة. لم تُحذف أي عملية؛ راجع الاتصال والتفاصيل.",
      );
    } finally {
      setBusy(false);
    }
  };
  const capabilityExpired = Boolean(
    session?.expiresAt && new Date(session.expiresAt) <= new Date(),
  );
  const rows = [
    ["حالة الشبكة", navigator.onLine ? "واجهة الشبكة متصلة" : "دون اتصال"],
    ["الخادم", backend == null ? "جارٍ الفحص" : backend ? "متاح" : "غير متاح"],
    [
      "آخر مزامنة ناجحة",
      state?.lastSuccessfulSync
        ? new Date(state.lastSuccessfulSync).toLocaleString("ar")
        : "لا توجد",
    ],
    ["عمليات معلقة", String(pending)],
    ["عمليات فاشلة قابلة للمحاولة", String(failed)],
    ["تعارضات تحتاج مراجعة", String(conflicts)],
    ["IndexedDB", storage.available ? "متاح وقابل للكتابة" : "غير متاح"],
    ["التخزين الدائم", persistenceLabels[persistenceStatus(storage)]],
    ["الاستخدام / الحصة", `${bytes(storage.usage)} / ${bytes(storage.quota)}`],
    ["الجهاز", state?.deviceCode ?? "غير مقترن"],
    [
      "انتهاء صلاحية العمل دون اتصال",
      session?.expiresAt
        ? new Date(session.expiresAt).toLocaleString("ar")
        : "غير متاح",
    ],
    [
      "Service worker",
      `${worker.version} — ${worker.controlled && worker.shellReady ? "جاهز دون اتصال" : "غير جاهز"}`,
    ],
    ["إصدار التطبيق", import.meta.env.VITE_APP_VERSION ?? "1.0.0"],
  ];
  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">تشخيص POS</h1>
          <p className="text-slate-600">
            معلومات تشغيلية فقط؛ لا يتم عرض مفاتيح أو رموز سرية.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => void refresh()}
          className="min-h-12 rounded-xl bg-slate-950 px-4 text-white disabled:opacity-50"
        >
          {busy ? "جارٍ الفحص…" : "تحديث الفحص"}
        </button>
      </div>
      {storage.persistent === false && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950"
        >
          <b>التخزين الدائم غير ممنوح.</b>
          <p>
            العمليات غير المتزامنة أكثر عرضة لإزالة المتصفح عند ضغط المساحة. لا
            تمسح بيانات الموقع.
          </p>
          <button
            disabled={busy}
            onClick={() => void refresh(true)}
            className="mt-3 min-h-11 rounded-lg bg-amber-500 px-4 font-bold"
          >
            طلب التخزين الدائم مجدداً
          </button>
        </div>
      )}
      <dl className="divide-y rounded-2xl bg-white shadow-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-2">
            <dt className="font-medium text-slate-600">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {(failed > 0 || conflicts > 0 || capabilityExpired) && (
        <div className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-900">
          <b>لا تحذف العمليات.</b> الفشل القابل للمحاولة يبقى محفوظاً، والتعارض
          المالي يحتاج مراجعة المدير قبل أي تصحيح.
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy || !navigator.onLine}
              onClick={() => void retrySync()}
              className="min-h-11 rounded-lg bg-slate-950 px-4 text-white disabled:opacity-50"
            >
              إعادة المحاولة / إعادة الاتصال
            </button>
            {capabilityExpired && (
              <Link
                to="/admin/login"
                className="min-h-11 rounded-lg bg-amber-500 px-4 py-3 font-bold"
              >
                إعادة المصادقة والإقران
              </Link>
            )}
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 rounded-xl bg-white p-3">
          {message}
        </p>
      )}
      {attention.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <h2 className="mb-3 text-xl font-bold">
            تفاصيل العمليات التي تحتاج انتباهاً
          </h2>
          {attention.map((operation) => (
            <details key={operation.operationId} className="border-b py-3">
              <summary className="cursor-pointer font-bold">
                {operation.status === "CONFLICT"
                  ? "تعارض يحتاج تدخلاً"
                  : "فشل قابل لإعادة المحاولة"}{" "}
                · {operation.operationType}
              </summary>
              <dl className="mt-2 text-sm">
                <div>الرمز: {operation.errorCode ?? "غير متاح"}</div>
                <div>{operation.errorMessage ?? "لا توجد تفاصيل إضافية"}</div>
                <div>المحاولات: {operation.attempts}</div>
                <div>
                  المعرّف: <span dir="ltr">{operation.operationId}</span>
                </div>
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
