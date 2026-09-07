import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Banknote, ReceiptText, ShoppingBag } from "lucide-react";
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
  const itemIds = items.map((item) => item.id);
  const itemModifiers = usePosLive(
    () =>
      itemIds.length
        ? posDb.orderItemModifiers.where("orderItemId").anyOf(itemIds).toArray()
        : Promise.resolve([]),
    [],
    [itemIds.join(",")],
  );
  const total = addMinor(...items.map((item) => item.lineTotalMinor));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
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
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">إتمام الطلب</p>
          <h1 className="text-3xl font-bold">الدفع</h1>
        </div>
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 font-bold"
        >
          <ArrowRight className="h-5 w-5" />
          الرجوع للطلب
        </button>
      </div>

      <div className="mt-5 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start">
        <section className="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-6 lg:sticky lg:top-24 lg:w-[420px] lg:shrink-0">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <Banknote className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">تفاصيل الدفع</h2>
              <p className="text-sm text-slate-600">راجع المبلغ ثم أكّد العملية</p>
            </div>
          </div>

          <dl className="my-5 grid min-w-0 grid-cols-1 gap-2 text-center sm:grid-cols-3 lg:grid-cols-3">
            <div className="min-w-0 rounded-xl bg-slate-100 p-3">
              <dt className="text-sm text-slate-600">الإجمالي</dt>
              <dd className="break-words text-lg font-bold">{formatMinor(total)}</dd>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-100 p-3">
              <dt className="text-sm text-slate-600">المدفوع</dt>
              <dd className="break-words text-lg font-bold">{formatMinor("0")}</dd>
            </div>
            <div className="min-w-0 rounded-xl bg-amber-50 p-3">
              <dt className="text-sm text-slate-600">المتبقي</dt>
              <dd className="break-words text-lg font-bold">{formatMinor(total)}</dd>
            </div>
          </dl>

          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 p-4 font-bold">
            <Banknote className="h-5 w-5" />
            طريقة الدفع: نقدي
          </div>

          <label className="mt-5 block font-medium">
            المبلغ النقدي المستلم (بالشيكل)
            <input
              aria-label="المبلغ النقدي المستلم"
              inputMode="decimal"
              autoComplete="off"
              value={tendered}
              onChange={(event) => {
                tenderedEdited.current = true;
                setTendered(normalizeShekelInput(event.target.value));
              }}
              className="mt-2 min-h-14 w-full min-w-0 rounded-xl border px-4 text-2xl font-bold"
            />
            <span
              className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-lg font-bold ${change < 0n ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
              aria-live="polite"
            >
              <span>الباقي للزبون</span>
              <span>{formatMinor(change)}</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-4 break-words rounded-xl bg-rose-50 p-3 text-rose-800">
              {error}
            </p>
          )}

          <button
            disabled={busy || completed || change < 0n || BigInt(total) <= 0n}
            onClick={() => void submit()}
            className="mt-5 flex min-h-16 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-lg font-bold text-white disabled:opacity-50 sm:text-xl"
          >
            <ReceiptText className="h-6 w-6 shrink-0" />
            <span className="break-words text-center">
              {completed
                ? "تم تثبيت الدفع محلياً"
                : busy
                  ? "جارٍ تثبيت الدفع…"
                  : "تأكيد الدفع وطباعة الإيصال"}
            </span>
          </button>
        </section>

        <section className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow sm:p-6">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100">
                <ShoppingBag className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold">أصناف الطلب</h2>
                <p className="text-sm text-slate-600">جميع الأصناف قبل تأكيد الدفع</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">
              {itemCount} صنف
            </span>
          </div>

          {items.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">لا توجد أصناف في هذا الطلب.</p>
          ) : (
            <div className="mt-4 max-h-[60vh] min-w-0 space-y-2 overflow-y-auto overflow-x-hidden pe-1 lg:max-h-[calc(100vh-13rem)]">
              {items.map((item) => (
                <article key={item.id} className="min-w-0 rounded-xl border bg-slate-50 p-3 sm:p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-bold">{item.itemNameSnapshot}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.quantity} × {formatMinor(item.unitPriceMinor)}
                      </p>
                    </div>
                    <strong className="shrink-0">{formatMinor(item.lineTotalMinor)}</strong>
                  </div>
                  {itemModifiers
                    .filter((modifier) => modifier.orderItemId === item.id)
                    .map((modifier) => (
                      <p key={modifier.id} className="mt-1 break-words text-sm text-slate-600">
                        + {modifier.groupNameSnapshot}: {modifier.optionNameSnapshot}
                      </p>
                    ))}
                  {item.notes && <p className="mt-2 break-words text-sm">ملاحظة: {item.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
