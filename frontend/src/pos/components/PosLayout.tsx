import { Link, Outlet, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  LayoutGrid,
  CalendarDays,
  Receipt,
  Clock,
  AlertTriangle,
  Stethoscope,
  LayoutDashboard,
} from "lucide-react";
import { posDb } from "../db/schema";
import {
  startSyncTriggers,
  syncNow,
  applyBootstrap,
  checkBackendHealth,
} from "../sync/engine";
import { usePosLive } from "../hooks/usePosLive";
import { cn } from "@/lib/utils";
import { api, unwrap } from "@/lib/apiClient";
import { verifyPosStorage } from "../db/diagnostics";
import { posErrorMessage } from "../errors";

export function PosLayout() {
  const pending = usePosLive(
    () =>
      posDb.syncOperations
        .where("status")
        .anyOf("PENDING", "FAILED", "CONFLICT", "SYNCING")
        .count(),
    0,
    [],
  );
  const conflicts = usePosLive(
    () => posDb.syncOperations.where("status").equals("CONFLICT").count(),
    0,
    [],
  );
  const [online, setOnline] = useState(navigator.onLine);
  const [diagnostic, setDiagnostic] = useState("");
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration>();
  const [pwaReady, setPwaReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const synchronize = async () => {
    if (syncing) return;
    setSyncing(true);
    setDiagnostic("");
    try {
      await syncNow({ retryFailed: true });
      setOnline(true);
    } catch (error) {
      setOnline(await checkBackendHealth());
      setDiagnostic(
        `${posErrorMessage(error, "فشلت المزامنة. راجع تفاصيل العملية وحاول مجدداً.")} لا تمسح بيانات الموقع.`,
      );
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const deviceId = localStorage.getItem("rawaqan_pos_device_id");
    if (deviceId && navigator.onLine)
      void unwrap<Record<string, unknown>>(
        api.get(`/pos/bootstrap?deviceId=${deviceId}`, {
          headers: { "x-pos-device-id": deviceId },
        }),
      )
        .then(async (data) => {
          setOnline(true);
          await applyBootstrap(data as never);
          const registration = await navigator.serviceWorker?.ready;
          registration?.active?.postMessage({ type: "PRECACHE_POS" });
          window.setTimeout(() => {
            void caches
              .match("/__rawaqan_pos_ready__")
              .then((ready) =>
                setPwaReady(
                  Boolean(navigator.serviceWorker.controller && ready),
                ),
              );
          }, 500);
        })
        .catch((error) => {
          setOnline(false);
          setDiagnostic(
            `${posErrorMessage(error, "تعذر تحديث بيانات البدء.")} البيانات المحلية لم تُمسح.`,
          );
        });
    const stopSync = startSyncTriggers();
    const updateOnline = () => {
      if (!navigator.onLine) setOnline(false);
    };
    const backendConnectivity = (event: Event) =>
      setOnline(Boolean((event as CustomEvent<boolean>).detail));
    const storageBlocked = () =>
      setDiagnostic(
        "تحديث قاعدة بيانات POS محجوب بواسطة لسان آخر. أغلق ألسنة POS الأخرى ثم أعد تحميل هذه الصفحة.",
      );
    const storageFailure = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (
        error?.name === "QuotaExceededError" ||
        /Database|IndexedDB|Dexie/i.test(String(error?.message))
      )
        setDiagnostic(
          "فشلت الكتابة المحلية. أوقف البيع، حافظ على هذا المتصفح مفتوحاً، وأعد الاتصال أو حرّر مساحة دون مسح بيانات الموقع.",
        );
    };
    const swUpdate = (event: Event) =>
      setUpdateRegistration(
        (event as CustomEvent<ServiceWorkerRegistration>).detail,
      );
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("rawaqan-pos-connectivity", backendConnectivity);
    window.addEventListener("rawaqan-pos-storage-blocked", storageBlocked);
    window.addEventListener("unhandledrejection", storageFailure);
    window.addEventListener("rawaqan-sw-update", swUpdate);
    void verifyPosStorage().then((health) => {
      if (health.message) setDiagnostic(health.message);
    });
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.ready.then(async (registration) => {
        const ready = await caches.match("/__rawaqan_pos_ready__");
        setPwaReady(Boolean(navigator.serviceWorker.controller && ready));
        if (registration.waiting) setUpdateRegistration(registration);
      });
    return () => {
      stopSync();
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener(
        "rawaqan-pos-connectivity",
        backendConnectivity,
      );
      window.removeEventListener("rawaqan-pos-storage-blocked", storageBlocked);
      window.removeEventListener("unhandledrejection", storageFailure);
      window.removeEventListener("rawaqan-sw-update", swUpdate);
    };
  }, []);

  const activateUpdate = () => {
    if (pending > 0) {
      setDiagnostic(
        "زامن جميع العمليات المعلّقة قبل تحديث التطبيق. لن يُفرض إعادة تحميل تلقائية.",
      );
      return;
    }
    const worker = updateRegistration?.waiting;
    if (!worker) {
      setDiagnostic("التحديث لم يجهز بعد. أعد المحاولة بعد لحظات.");
      return;
    }
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => location.reload(),
      { once: true },
    );
    worker.postMessage({ type: "SKIP_WAITING" });
  };

  const nav = [
    ["/pos", "الطاولات", LayoutGrid],
    ["/pos/reservations", "الحجوزات", CalendarDays],
    ["/pos/shifts", "الوردية", Clock],
    ["/pos/invoices", "الفواتير", Receipt],
    ["/pos/diagnostics", "التشخيص", Stethoscope],
  ] as const;
  return (
    <div dir="rtl" className="pos-theme min-h-screen">
      <header className="pos-header sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold">روقان POS</div>
          <Link to="/admin" className="pos-dashboard-link">
            <LayoutDashboard className="h-4 w-4" />
            لوحة التحكم
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              "pos-status-badge",
              online ? "pos-status-online" : "pos-status-offline",
            )}
          >
            {online ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {online ? "متصل" : "غير متصل"}
          </span>
          <button
            disabled={syncing}
            onClick={() => void synchronize()}
            className="pos-status-badge pos-status-queue min-h-11 px-3 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing
              ? "جارٍ المزامنة"
              : !online
                ? `${pending} بانتظار الإنترنت`
                : `${pending} معلّق — إعادة المحاولة`}
          </button>
          <span
            className={cn(
              "pos-status-badge",
              pwaReady ? "pos-status-ready" : "pos-status-preparing",
            )}
          >
            {pwaReady ? "العمل دون اتصال جاهز" : "تهيئة العمل دون اتصال"}
          </span>
          {conflicts > 0 && (
            <span className="pos-status-badge pos-status-conflict">
              {conflicts} تعارض يحتاج تدخلاً
            </span>
          )}
        </div>
      </header>
      {(diagnostic || updateRegistration) && (
        <div
          className="pos-warning-panel border-b px-4 py-3 text-sm"
          role="alert"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1">
              {updateRegistration && pending > 0
                ? "يتوفر تحديث. أكمل مزامنة المعاملات المعلقة قبل التحديث."
                : diagnostic || "يتوفر تحديث للتطبيق ويمكن تثبيته بأمان."}
            </span>
            {updateRegistration && (
              <button
                disabled={pending > 0}
                onClick={activateUpdate}
                className="min-h-11 rounded-lg bg-slate-950 px-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                تحديث آمن
              </button>
            )}
            {diagnostic && (
              <button
                onClick={() => setDiagnostic("")}
                className="min-h-11 rounded-lg border px-3"
              >
                إخفاء
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex">
        <nav className="pos-side-nav sticky top-16 hidden h-[calc(100vh-4rem)] w-52 shrink-0 flex-col gap-2 p-3 shadow-sm md:flex">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/pos"}
              className={({ isActive }) =>
                cn(
                  "pos-nav-link flex min-h-12 items-center gap-3 rounded-xl px-4 font-medium",
                  isActive && "pos-nav-active",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
