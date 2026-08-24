import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { posDb } from "../db/schema";
import { usePosLive } from "../hooks/usePosLive";
import { addMinor } from "../types";
import { checkoutLocal } from "../commands/localCommands";
import { currentBusinessDate } from "../domain/businessDate";
import { formatMinor } from "../format";
import { posErrorMessage } from "../errors";

type PaymentMode = "CASH" | "VISA" | "SPLIT";

export default function CheckoutPage() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const admin = useAuthStore((state) => state.admin);
  const offline = usePosLive(
    () => posDb.offlineSession.toCollection().first(),
    undefined,
    [],
  );
  const device = usePosLive(
    () => posDb.deviceState.get("primary"),
    undefined,
    [],
  );
  const items = usePosLive(
    () => posDb.orderItems.where("orderId").equals(orderId!).toArray(),
    [],
    [orderId],
  );
  const total = addMinor(...items.map((item) => item.lineTotalMinor));
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [cashAmount, setCashAmount] = useState(total);
  const [tendered, setTendered] = useState(total);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const normalizedCash =
    mode === "SPLIT"
      ? BigInt(cashAmount || "0")
      : mode === "CASH"
        ? BigInt(total)
        : 0n;
  const visaAmount = BigInt(total) - normalizedCash;
  const change =
    normalizedCash > 0n ? BigInt(tendered || "0") - normalizedCash : 0n;

  const submit = async () => {
    const userId = admin?.id ?? offline?.userId;
    if (!userId || !orderId || busy || completed) return;
    if (
      normalizedCash < 0n ||
      visaAmount < 0n ||
      (mode === "SPLIT" && (normalizedCash === 0n || visaAmount === 0n))
    ) {
      setError("أدخل جزأين موجبين يساويان الإجمالي.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payments = [];
      if (normalizedCash > 0n)
        payments.push({
          method: "CASH" as const,
          amountMinor: normalizedCash.toString(),
          tenderedMinor: tendered || normalizedCash.toString(),
        });
      if (visaAmount > 0n)
        payments.push({
          method: "VISA" as const,
          amountMinor: visaAmount.toString(),
        });
      await checkoutLocal({
        orderId,
        userId,
        businessDate: currentBusinessDate(device),
        payments,
      });
      setCompleted(true);
      nav("/pos/invoices");
    } catch (cause) {
      setError(
        posErrorMessage(cause, "تعذر إتمام الدفع. راجع المبالغ وأعد المحاولة."),
      );
    } finally {
      setBusy(false);
    }
  };

  const choose = (next: PaymentMode) => {
    setMode(next);
    setError("");
    if (next === "CASH") {
      setCashAmount(total);
      setTendered(total);
    } else if (next === "VISA") setCashAmount("0");
    else {
      const half = (BigInt(total) / 2n).toString();
      setCashAmount(half);
      setTendered(half);
    }
  };
  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow">
      <h1 className="text-3xl font-bold">الدفع</h1>
      <dl className="my-6 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-100 p-3">
          <dt>الإجمالي</dt>
          <dd className="text-xl font-bold">{formatMinor(total)}</dd>
        </div>
        <div className="rounded-xl bg-slate-100 p-3">
          <dt>المدفوع</dt>
          <dd className="text-xl font-bold">{formatMinor("0")}</dd>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <dt>المتبقي</dt>
          <dd className="text-xl font-bold">{formatMinor(total)}</dd>
        </div>
      </dl>
      <div
        className="grid grid-cols-3 gap-3"
        role="group"
        aria-label="طريقة الدفع"
      >
        {(["CASH", "VISA", "SPLIT"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            className={`min-h-16 rounded-xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 ${mode === value ? "bg-amber-500" : "bg-slate-100"}`}
          >
            {value === "CASH"
              ? "نقدي"
              : value === "VISA"
                ? "Visa"
                : "نقدي + Visa"}
          </button>
        ))}
      </div>
      {mode === "SPLIT" && (
        <label className="mt-5 block">
          الجزء النقدي (بالأغورة)
          <input
            aria-label="الجزء النقدي"
            value={cashAmount}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "");
              setCashAmount(value);
              setTendered(value);
            }}
            className="mt-2 min-h-14 w-full rounded-xl border px-4 text-2xl"
          />
          <span className="mt-2 block font-bold">
            جزء Visa: {visaAmount >= 0n ? formatMinor(visaAmount) : "غير صالح"}
          </span>
        </label>
      )}
      {mode !== "VISA" && (
        <label className="mt-5 block">
          المبلغ النقدي المستلم (بالأغورة)
          <input
            aria-label="المبلغ النقدي المستلم"
            value={tendered}
            onChange={(event) =>
              setTendered(event.target.value.replace(/\D/g, ""))
            }
            className="mt-2 min-h-14 w-full rounded-xl border px-4 text-2xl"
          />
          <span
            className={`mt-2 block text-xl font-bold ${change < 0n ? "text-rose-700" : "text-emerald-700"}`}
          >
            الباقي: {formatMinor(change)}
          </span>
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 p-3 text-rose-800"
        >
          {error}
        </p>
      )}
      <button
        disabled={busy || completed || change < 0n || BigInt(total) <= 0n}
        onClick={() => void submit()}
        className="mt-6 min-h-16 w-full rounded-xl bg-emerald-600 text-xl font-bold text-white disabled:opacity-50"
      >
        {completed
          ? "تم تثبيت الدفع محلياً"
          : busy
            ? "جارٍ تثبيت الدفع…"
            : "تأكيد الدفع محلياً"}
      </button>
    </div>
  );
}
