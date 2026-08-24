import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import type { OfflineSession } from "../types";
import { posDb } from "../db/schema";
import { verifyPosStorage } from "../db/diagnostics";
import { unlockOffline } from "./offline";

const unlockMessages: Record<string, string> = {
  INVALID_PIN: "PIN غير صحيح.",
  OFFLINE_PIN_LOCKED: "تم قفل المحاولة لمدة 15 دقيقة بعد محاولات PIN متكررة.",
  OFFLINE_CAPABILITY_EXPIRED:
    "انتهت صلاحية التشغيل دون اتصال. أعد الاتصال وسجّل الدخول ثم أعد إقران الجهاز.",
  OFFLINE_CAPABILITY_REPAIR_REQUIRED:
    "يلزم إعادة إقران هذا المتصفح لتحديث حماية PIN.",
};

export function PosProtectedRoute() {
  const { status, restore } = useAuthStore();
  const [session, setSession] = useState<OfflineSession | null>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState<string>();

  useEffect(() => {
    if (status === "idle") void restore();
    void verifyPosStorage().then((health) => {
      if (!health.available) {
        setStorageError(health.message);
        setSession(null);
        return;
      }
      void posDb.offlineSession
        .toCollection()
        .first()
        .then((value) =>
          setSession(value ? { ...value, unlockedAt: undefined } : null),
        );
    });
  }, [status, restore]);

  if (storageError)
    return (
      <div
        dir="rtl"
        className="pos-theme grid min-h-screen place-items-center bg-rose-950 p-4"
      >
        <div role="alert" className="max-w-xl rounded-2xl bg-white p-6">
          <h1 className="text-2xl font-bold text-rose-800">
            التخزين المحلي غير متاح
          </h1>
          <p className="mt-3">{storageError}</p>
          <p className="mt-3 font-bold">
            لا تتابع عمليات البيع حتى تعمل قاعدة البيانات المحلية.
          </p>
          <button
            onClick={() => location.reload()}
            className="mt-5 min-h-12 rounded-xl bg-slate-950 px-5 text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  if (
    status === "authenticated" ||
    (session?.unlockedAt && new Date(session.expiresAt) > new Date())
  )
    return <Outlet />;
  if (status === "idle" || status === "loading" || session === undefined)
    return (
      <div className="pos-theme grid min-h-screen place-items-center">
        جارٍ التحقق…
      </div>
    );
  if (!session) return <Navigate to="/admin/login" replace />;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const unlocked = await unlockOffline(
        session.deviceId,
        session.userId,
        pin,
      );
      setSession(unlocked);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(
        unlockMessages[code] ??
          "تعذر فتح POS دون اتصال. تحقق من PIN وصلاحية الإقران.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="pos-theme grid min-h-screen place-items-center bg-slate-950 p-4"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-6"
      >
        <h1 className="text-2xl font-bold">فتح POS دون اتصال</h1>
        <p className="mt-2 text-sm text-slate-500">
          أدخل PIN المحلي. لا يتم تخزين PIN كنص صريح.
        </p>
        <label className="mt-5 block">
          <span className="sr-only">PIN المحلي</span>
          <input
            autoFocus
            autoComplete="off"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            className="min-h-14 w-full rounded-xl border px-4 text-center text-2xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy || pin.length < 4}
          className="mt-4 min-h-14 w-full rounded-xl bg-amber-500 font-bold disabled:opacity-50"
        >
          {busy ? "جارٍ التحقق…" : "فتح"}
        </button>
      </form>
    </div>
  );
}
