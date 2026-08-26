import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { posDb } from "../db/schema";
import { usePosLive } from "../hooks/usePosLive";
import { addMinor } from "../types";
import {
  checkoutLocal,
  recordLocalPrintEvent,
} from "../commands/localCommands";
import { currentBusinessDate } from "../domain/businessDate";
import { formatMinor } from "../format";
import { posErrorMessage } from "../errors";
import {
  minorToShekelInput,
  normalizeShekelInput,
  shekelInputToMinor,
} from "../moneyInput";
import { BrowserReceiptPrinter } from "../printing/ReceiptPrinter";
import { loadReceiptData } from "../printing/receiptData";

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
  const [tendered, setTendered] = useState("");
  const tenderedEdited = useRef(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const cashAmount = BigInt(total);
  const tenderedMinor = shekelInputToMinor(tendered);
  const change = BigInt(tenderedMinor) - cashAmount;

  useEffect(() => {
    if (!tenderedEdited.current) {
      setTendered(minorToShekelInput(total));
    }
  }, [total]);

  const submit = async () => {
    const userId = admin?.id ?? offline?.userId;
    if (!userId || !orderId || busy || completed) return;
    setBusy(true);
    setError("");
    const printer = new BrowserReceiptPrinter();
    let printTarget: HTMLIFrameElement | undefined;
    try {
      printTarget = printer.reservePrintFrame();
    } catch {
      // Payment remains available even when the browser cannot prepare printing.
    }
    try {
      const { result: invoice } = await checkoutLocal({
        orderId,
        userId,
        businessDate: currentBusinessDate(device),
        payments: [
          {
            method: "CASH",
            amountMinor: cashAmount.toString(),
            tenderedMinor: tenderedMinor || cashAmount.toString(),
          },
        ],
      });
      setCompleted(true);
      try {
        const receipt = await loadReceiptData(
          invoice.id,
          admin?.name ?? "الكاشير",
        );
        await printer.print(receipt, "80mm", printTarget);
        await recordLocalPrintEvent(invoice.id, "INITIAL", "80mm");
        nav(`/pos/invoices/${invoice.id}`);
      } catch {
        printer.releasePrintTarget(printTarget);
        nav(`/pos/invoices/${invoice.id}`, {
          state: {
            printError:
              "تم الدفع بنجاح، لكن تعذرت الطباعة التلقائية. اضغط إعادة طباعة الإيصال.",
          },
        });
      }
    } catch (cause) {
      printer.releasePrintTarget(printTarget);
      setError(
        posErrorMessage(cause, "تعذر إتمام الدفع. راجع المبالغ وأعد المحاولة."),
      );
    } finally {
      setBusy(false);
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
      <div className="rounded-xl bg-amber-500 p-4 text-center font-bold">
        طريقة الدفع: نقدي
      </div>
      <label className="mt-5 block">
        المبلغ النقدي المستلم (بالشيكل)
        <input
          aria-label="المبلغ النقدي المستلم"
          value={tendered}
          onChange={(event) => {
            tenderedEdited.current = true;
            setTendered(normalizeShekelInput(event.target.value));
          }}
          className="mt-2 min-h-14 w-full rounded-xl border px-4 text-2xl"
        />
        <span
          className={`mt-2 block text-xl font-bold ${change < 0n ? "text-rose-700" : "text-emerald-700"}`}
        >
          الباقي: {formatMinor(change)}
        </span>
      </label>
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
