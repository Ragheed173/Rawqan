import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { posDb } from "../db/schema";
import { usePosLive } from "../hooks/usePosLive";
import { splitMinorEqual } from "../types";
import { BrowserReceiptPrinter } from "../printing/ReceiptPrinter";
import { loadReceiptData } from "../printing/receiptData";
import {
  closeLocalShift,
  createLocalReservation,
  finalizeLocalEqualSplit,
  finalizeLocalItemSplit,
  openLocalShift,
  payLocalInvoice,
  recordLocalPrintEvent,
  updateLocalReservation,
} from "../commands/localCommands";
import {
  currentBusinessDate,
  isoToRestaurantLocal,
  restaurantLocalToIso,
} from "../domain/businessDate";
import { formatMinor } from "../format";
import { posErrorMessage } from "../errors";
import {
  minorToShekelInput,
  normalizeShekelInput,
  shekelInputToMinor,
} from "../moneyInput";

export function SplitPage() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const admin = useAuthStore((state) => state.admin);
  const offline = usePosLive(
    () => posDb.offlineSession.toCollection().first(),
    undefined,
    [],
  );
  const state = usePosLive(
    () => posDb.deviceState.get("primary"),
    undefined,
    [],
  );
  const items = usePosLive(
    () =>
      posDb.orderItems.where("orderId").equals(orderId!).sortBy("sortOrder"),
    [],
    [orderId],
  );
  const [mode, setMode] = useState<"EQUAL" | "ITEM">("EQUAL");
  const [parts, setParts] = useState(2);
  const [allocations, setAllocations] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setAllocations((current) =>
      Object.fromEntries(
        items.map((item, index) => {
          const next = (current[item.id] ?? []).slice(0, parts);
          while (next.length < parts) next.push(0);
          const assigned = next.reduce((sum, quantity) => sum + quantity, 0);
          if (assigned < item.quantity)
            next[index % parts] =
              (next[index % parts] ?? 0) + item.quantity - assigned;
          return [item.id, next];
        }),
      ),
    );
  }, [items, parts]);
  const total = items
    .reduce((sum, item) => sum + BigInt(item.lineTotalMinor), 0n)
    .toString();
  const itemGroups = Array.from({ length: parts }, (_, billIndex) =>
    items
      .map((item) => ({
        item,
        quantity: allocations[item.id]?.[billIndex] ?? 0,
      }))
      .filter((entry) => entry.quantity > 0),
  );
  const allocatedQuantity = (itemId: string) =>
    (allocations[itemId] ?? []).reduce((sum, quantity) => sum + quantity, 0);
  const itemAllocationValid =
    items.every((item) => allocatedQuantity(item.id) === item.quantity) &&
    itemGroups.filter((group) => group.length).length >= 2;
  const setAllocation = (
    itemId: string,
    billIndex: number,
    quantity: number,
    maximum: number,
  ) =>
    setAllocations((current) => {
      const next = [...(current[itemId] ?? Array(parts).fill(0))];
      const other = next.reduce(
        (sum, value, index) => (index === billIndex ? sum : sum + value),
        0,
      );
      next[billIndex] = Math.max(0, Math.min(maximum - other, quantity || 0));
      return { ...current, [itemId]: next };
    });
  const equalShares = splitMinorEqual(total, parts);
  const equalSum = equalShares.reduce((sum, share) => sum + BigInt(share), 0n);
  const remainder = BigInt(total) % BigInt(parts);
  const create = async () => {
    const userId = admin?.id ?? offline?.userId;
    if (!orderId || !userId || busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "EQUAL")
        await finalizeLocalEqualSplit({
          orderId,
          userId,
          businessDate: currentBusinessDate(state),
          splitCount: parts,
        });
      else {
        if (items.some((item) => allocatedQuantity(item.id) !== item.quantity))
          throw new Error("INVALID_QUANTITY");
        const groups = itemGroups.filter((group) => group.length);
        if (groups.length < 2)
          throw new Error("ITEM_SPLIT_REQUIRES_TWO_INVOICES");
        const splitGroupId = crypto.randomUUID();
        let dependencies: string[] = [];
        for (const [index, group] of groups.entries()) {
          const created = await finalizeLocalItemSplit({
            orderId,
            userId,
            businessDate: currentBusinessDate(state),
            lines: group.map(({ item, quantity }) => ({
              orderItemId: item.id,
              quantity,
            })),
            splitGroupId,
            splitIndex: index + 1,
            splitCount: groups.length,
            dependencies,
          });
          dependencies = [created.operation.operationId];
        }
      }
      nav("/pos/invoices");
    } catch (cause) {
      setError(
        posErrorMessage(
          cause,
          "تعذر إنشاء التقسيم. راجع التوزيع وأعد المحاولة.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6">
      <h1 className="text-2xl font-bold">تقسيم الفاتورة</h1>
      <p className="mt-2 text-lg">
        الإجمالي: <b>{formatMinor(total)}</b>
      </p>
      <div
        className="mt-4 grid grid-cols-2 gap-2"
        role="group"
        aria-label="نوع التقسيم"
      >
        <button
          disabled={busy}
          onClick={() => setMode("EQUAL")}
          className={`min-h-14 rounded-xl ${mode === "EQUAL" ? "bg-amber-500" : "bg-slate-100"}`}
        >
          تقسيم متساوٍ
        </button>
        <button
          disabled={busy}
          onClick={() => setMode("ITEM")}
          className={`min-h-14 rounded-xl ${mode === "ITEM" ? "bg-amber-500" : "bg-slate-100"}`}
        >
          تقسيم حسب الأصناف
        </button>
      </div>
      <label className="mt-5 block">
        عدد الأشخاص / الفواتير
        <input
          aria-label="عدد الفواتير"
          type="number"
          min={2}
          max={20}
          value={parts}
          onChange={(event) =>
            setParts(Math.max(2, Math.min(20, Number(event.target.value))))
          }
          className="mt-2 min-h-12 w-full rounded-xl border px-4"
        />
      </label>
      {mode === "EQUAL" ? (
        <div className="mt-5 space-y-2">
          {equalShares.map((share, index) => (
            <div
              key={index}
              className="flex justify-between rounded-xl bg-slate-100 p-4"
            >
              <span>
                {index + 1} / {parts}
              </span>
              <b>{formatMinor(share)}</b>
            </div>
          ))}
          <p className="rounded-xl bg-amber-50 p-3">
            {remainder > 0n
              ? `تم توزيع فرق التقريب (${remainder} أغورة) على أول ${remainder} فاتورة.`
              : "لا يوجد فرق تقريب."}
          </p>
          <div className="flex justify-between rounded-xl border-2 border-emerald-600 p-4">
            <span>مجموع الحصص</span>
            <b>
              {formatMinor(equalSum)} = {formatMinor(total)}
            </b>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => {
            const allocated = allocatedQuantity(item.id);
            return (
              <fieldset key={item.id} className="rounded-xl bg-slate-100 p-3">
                <legend className="sr-only">
                  توزيع {item.itemNameSnapshot}
                </legend>
                <div>
                  {item.itemNameSnapshot} × {item.quantity} —{" "}
                  <b>{formatMinor(item.lineTotalMinor)}</b>
                  <small className="mt-1 block">
                    المخصص: {allocated} · غير المخصص:{" "}
                    {item.quantity - allocated}
                  </small>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: parts }, (_, billIndex) => (
                    <label key={billIndex} className="text-sm">
                      فاتورة {billIndex + 1}
                      <input
                        aria-label={`${item.itemNameSnapshot} فاتورة ${billIndex + 1}`}
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={allocations[item.id]?.[billIndex] ?? 0}
                        onChange={(event) =>
                          setAllocation(
                            item.id,
                            billIndex,
                            Number(event.target.value),
                            item.quantity,
                          )
                        }
                        className="mt-1 min-h-11 w-full rounded-lg border px-2"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <div className="grid gap-2 sm:grid-cols-2">
            {itemGroups.map((group, index) => (
              <div key={index} className="rounded-xl border p-3">
                <b>فاتورة {index + 1}</b>
                <div>
                  {formatMinor(
                    group.reduce(
                      (sum, entry) =>
                        sum +
                        (BigInt(entry.item.lineTotalMinor) /
                          BigInt(entry.item.quantity)) *
                          BigInt(entry.quantity),
                      0n,
                    ),
                  )}
                </div>
                <small>
                  {group.reduce((sum, entry) => sum + entry.quantity, 0)} وحدة
                  مخصصة
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
      {mode === "ITEM" && !itemAllocationValid && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-900"
        >
          وزّع كل الكميات على فاتورتين على الأقل قبل الإنشاء.
        </p>
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
        disabled={busy || (mode === "ITEM" && !itemAllocationValid)}
        onClick={() => void create()}
        className="mt-5 min-h-14 w-full rounded-xl bg-amber-500 font-bold disabled:opacity-50"
      >
        {busy
          ? "جارٍ الإنشاء…"
          : `إنشاء تقسيم ${mode === "EQUAL" ? "متساوٍ" : "حسب الأصناف"}`}
      </button>
    </div>
  );
}

export function ReservationsPage() {
  const rows = usePosLive(
    () => posDb.reservations.orderBy("startsAt").toArray(),
    [],
    [],
  );
  const tables = usePosLive(
    () => posDb.restaurantTables.filter((table) => table.isActive).toArray(),
    [],
    [],
  );
  const state = usePosLive(
    () => posDb.deviceState.get("primary"),
    undefined,
    [],
  );
  const [editingId, setEditingId] = useState<string>();
  const [editingStatus, setEditingStatus] = useState("CONFIRMED");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(2);
  const [startsAt, setStartsAt] = useState("");
  const [tableId, setTableId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string>();
  const timezone = state?.timezone ?? "Asia/Hebron";
  const statusLabels: Record<string, string> = {
    PENDING: "بانتظار التأكيد",
    CONFIRMED: "مؤكد",
    SEATED: "تم الإجلاس",
    COMPLETED: "مكتمل",
    NO_SHOW: "لم يحضر",
    CANCELLED: "ملغى",
  };
  const reset = () => {
    setEditingId(undefined);
    setEditingStatus("CONFIRMED");
    setName("");
    setPhone("");
    setGuests(2);
    setStartsAt("");
    setTableId("");
    setNotes("");
  };
  const save = async () => {
    if (!name || !phone || !startsAt || busy) return;
    setBusy(true);
    setError("");
    try {
      const patch = {
        customerName: name,
        phone,
        guestCount: guests,
        startsAt: restaurantLocalToIso(startsAt, timezone),
        notes: notes || null,
        status: editingStatus,
        tableIds: tableId ? [tableId] : [],
      };
      if (editingId) await updateLocalReservation(editingId, patch);
      else await createLocalReservation({ ...patch, status: "CONFIRMED" });
      reset();
    } catch (cause) {
      setError(
        posErrorMessage(
          cause,
          "تعذر حفظ الحجز. راجع الموعد والطاولة وأعد المحاولة.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const edit = (row: (typeof rows)[number]) => {
    setEditingId(row.id);
    setEditingStatus(row.status);
    setName(row.customerName);
    setPhone(row.phone);
    setGuests(row.guestCount);
    setStartsAt(isoToRestaurantLocal(row.startsAt, timezone));
    setTableId(row.tableIds[0] ?? "");
    setNotes(row.notes ?? "");
  };
  const changeStatus = async (id: string, status: string) => {
    if (actionBusy) return;
    setActionBusy(id);
    setError("");
    try {
      await updateLocalReservation(id, { status });
    } catch (cause) {
      setError(posErrorMessage(cause, "تعذر تحديث حالة الحجز."));
    } finally {
      setActionBusy(undefined);
    }
  };
  const formatter = new Intl.DateTimeFormat("ar", {
    timeZone: state?.timezone ?? "Asia/Hebron",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(),
  );
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">الحجوزات</h1>
      <p className="mb-5 text-slate-500">
        مواعيد المطعم بتوقيت Asia/Hebron · حجوزات اليوم مميزة
      </p>
      <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-2">
        <label>
          اسم الزبون
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border px-3"
          />
        </label>
        <label>
          الهاتف
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border px-3"
          />
        </label>
        <label>
          عدد الضيوف
          <input
            type="number"
            min={1}
            value={guests}
            onChange={(event) =>
              setGuests(Math.max(1, Number(event.target.value)))
            }
            className="mt-1 min-h-12 w-full rounded-xl border px-3"
          />
        </label>
        <label>
          التاريخ والوقت (Asia/Hebron)
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border px-3"
          />
        </label>
        <label>
          الطاولة
          <select
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border px-3"
          >
            <option value="">دون تعيين</option>
            {tables.map((table) => (
              <option
                key={table.id}
                value={table.id}
                disabled={
                  Boolean(table.currentOrderId) ||
                  (table.capacity ?? 0) < guests
                }
              >
                {table.displayName ?? table.code} · سعة{" "}
                {table.capacity ?? "غير محددة"}
                {table.currentOrderId
                  ? " · مشغولة"
                  : (table.capacity ?? 0) < guests
                    ? " · السعة غير كافية"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          ملاحظات
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border px-3 py-2"
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-2">
          <button
            disabled={busy || !name || !phone || !startsAt}
            onClick={() => void save()}
            className="min-h-12 flex-1 rounded-xl bg-amber-500 font-bold disabled:opacity-50"
          >
            {busy
              ? "جارٍ الحفظ…"
              : editingId
                ? "حفظ التعديل"
                : "إنشاء حجز مؤكد"}
          </button>
          {editingId && (
            <button onClick={reset} className="min-h-12 rounded-xl border px-4">
              إلغاء التعديل
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-rose-700 md:col-span-2">
            {error}
          </p>
        )}
      </div>
      {rows.length === 0 && (
        <p className="rounded-2xl bg-white p-6">لا توجد حجوزات.</p>
      )}
      <div className="space-y-3">
        {rows.map((row) => {
          const isToday =
            new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
              new Date(row.startsAt),
            ) === today;
          const tableNames = row.tableIds
            .map(
              (id) =>
                tables.find((table) => table.id === id)?.displayName ??
                tables.find((table) => table.id === id)?.code,
            )
            .filter(Boolean);
          return (
            <article
              key={row.id}
              className={`rounded-2xl border-2 bg-white p-4 ${isToday ? "border-amber-500" : "border-transparent"}`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <b>
                  {isToday ? "اليوم · " : ""}
                  {row.customerName}
                </b>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {statusLabels[row.status] ?? row.status}
                </span>
              </div>
              <div>
                {formatter.format(new Date(row.startsAt))} · {row.guestCount}{" "}
                أشخاص
              </div>
              <div>
                الهاتف: <span dir="ltr">{row.phone}</span> · الطاولات:{" "}
                {tableNames.join("، ") || "غير معينة"}
              </div>
              {row.notes && (
                <p className="mt-1 text-slate-600">ملاحظات: {row.notes}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={Boolean(actionBusy)}
                  onClick={() => edit(row)}
                  className="min-h-11 rounded-lg border px-3"
                >
                  تعديل
                </button>
                {["PENDING"].includes(row.status) && (
                  <button
                    disabled={Boolean(actionBusy)}
                    onClick={() => void changeStatus(row.id, "CONFIRMED")}
                    className="min-h-11 rounded-lg bg-blue-100 px-3"
                  >
                    تأكيد
                  </button>
                )}
                {["PENDING", "CONFIRMED"].includes(row.status) && (
                  <button
                    disabled={Boolean(actionBusy)}
                    onClick={() => void changeStatus(row.id, "SEATED")}
                    className="min-h-11 rounded-lg bg-emerald-100 px-3 text-emerald-900"
                  >
                    إجلاس
                  </button>
                )}
                {row.status === "SEATED" && (
                  <button
                    disabled={Boolean(actionBusy)}
                    onClick={() => void changeStatus(row.id, "COMPLETED")}
                    className="min-h-11 rounded-lg bg-emerald-700 px-3 text-white"
                  >
                    إكمال
                  </button>
                )}
                {["PENDING", "CONFIRMED"].includes(row.status) && (
                  <button
                    disabled={Boolean(actionBusy)}
                    onClick={() =>
                      confirm("تسجيل أن الزبون لم يحضر؟") &&
                      void changeStatus(row.id, "NO_SHOW")
                    }
                    className="min-h-11 rounded-lg bg-slate-200 px-3"
                  >
                    لم يحضر
                  </button>
                )}
                {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(
                  row.status,
                ) && (
                  <button
                    disabled={Boolean(actionBusy)}
                    onClick={() =>
                      confirm("إلغاء هذا الحجز؟") &&
                      void changeStatus(row.id, "CANCELLED")
                    }
                    className="min-h-11 rounded-lg bg-rose-100 px-3 text-rose-900"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ShiftsPage() {
  const admin = useAuthStore((state) => state.admin);
  const offline = usePosLive(
    () => posDb.offlineSession.toCollection().first(),
    undefined,
    [],
  );
  const state = usePosLive(
    () => posDb.deviceState.get("primary"),
    undefined,
    [],
  );
  const [amount, setAmount] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const userId = admin?.id ?? offline?.userId;
  const shift = usePosLive(
    () =>
      userId && state
        ? posDb.shifts
            .filter(
              (row) =>
                row.userId === userId &&
                row.deviceId === state.deviceId &&
                row.status === "OPEN",
            )
            .first()
        : Promise.resolve(undefined),
    undefined,
    [userId, state?.deviceId],
  );
  const submit = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    try {
      if (shift) {
        if (!confirm("إغلاق الوردية نهائياً بالمبلغ الفعلي المدخل؟")) return;
        await closeLocalShift(String(shift.id), shekelInputToMinor(amount));
      } else
        await openLocalShift(
          userId,
          shekelInputToMinor(amount),
          currentBusinessDate(state),
        );
      setAmount("0");
    } catch (cause) {
      setError(
        posErrorMessage(cause, "تعذر حفظ الوردية. راجع المبلغ والحالة."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-xl rounded-2xl bg-white p-6">
      <h1 className="text-3xl font-bold">الوردية</h1>
      {shift ? (
        <div className="mt-5 space-y-2">
          <p>وردية مفتوحة</p>
          <p>الرصيد الافتتاحي: {formatMinor(String(shift.openingCashMinor))}</p>
          <p>
            المبيعات النقدية: {formatMinor(String(shift.cashSalesMinor ?? "0"))}
          </p>
          <p>
            المرتجعات النقدية:{" "}
            {formatMinor(String(shift.cashRefundsMinor ?? "0"))}
          </p>
          <p className="font-bold">
            النقد المتوقع: {formatMinor(String(shift.expectedCashMinor))}
          </p>
        </div>
      ) : (
        <p className="mt-5">لا توجد وردية مفتوحة.</p>
      )}
      <label className="mt-5 block">
        {shift ? "النقد الفعلي عند الإغلاق" : "النقد الافتتاحي"}
        <input
          value={amount}
          inputMode="decimal"
          onChange={(event) => setAmount(normalizeShekelInput(event.target.value))}
          className="mt-2 min-h-12 w-full rounded-xl border px-4"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-rose-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        onClick={() => void submit()}
        className={`mt-4 min-h-12 w-full rounded-xl font-bold text-white disabled:opacity-50 ${shift ? "bg-rose-700" : "bg-emerald-600"}`}
      >
        {busy ? "جارٍ الحفظ…" : shift ? "إغلاق الوردية" : "فتح الوردية"}
      </button>
    </section>
  );
}

export function InvoicesPage() {
  const rows = usePosLive(
    () => posDb.invoices.orderBy("issuedAt").reverse().toArray(),
    [],
    [],
  );
  const payments = usePosLive(() => posDb.payments.toArray(), [], []);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const filtered = rows.filter(
    (row) =>
      (!query ||
        row.invoiceNumber
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())) &&
      (!date || row.businessDate === date) &&
      (!status || row.status === status) &&
      (!method ||
        payments.some(
          (payment) =>
            payment.invoiceId === row.id && payment.method === method,
        )),
  );
  return (
    <section>
      <h1 className="mb-5 text-3xl font-bold">الفواتير</h1>
      <div className="mb-4 grid gap-2 rounded-2xl bg-white p-4 sm:grid-cols-4">
        <label>
          رقم الفاتورة
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <label>
          التاريخ
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <label>
          الحالة
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          >
            <option value="">الكل</option>
            <option value="OPEN">مفتوحة</option>
            <option value="PAID">مدفوعة</option>
            <option value="VOIDED">ملغاة</option>
            <option value="PARTIALLY_REFUNDED">مرتجع جزئي</option>
            <option value="REFUNDED">مرتجعة</option>
          </select>
        </label>
        <label>
          طريقة الدفع
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          >
            <option value="">الكل</option>
            <option value="CASH">نقدي</option>
            <option value="VISA">Visa</option>
          </select>
        </label>
      </div>
      {filtered.length === 0 && (
        <p className="rounded-2xl bg-white p-6">لا توجد فواتير تطابق البحث.</p>
      )}
      <div className="space-y-3">
        {filtered.map((row) => (
          <Link
            to={`/pos/invoices/${row.id}`}
            key={row.id}
            className="flex min-h-14 items-center justify-between rounded-2xl bg-white p-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300"
          >
            <span>{row.invoiceNumber}</span>
            <span>
              {row.splitMode
                ? `${row.splitMode} ${row.splitIndex}/${row.splitCount}`
                : row.status}
            </span>
            <b>{formatMinor(row.totalMinor)}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const admin = useAuthStore((state) => state.admin);
  const offline = usePosLive(
    () => posDb.offlineSession.toCollection().first(),
    undefined,
    [],
  );
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [profile, setProfile] = useState<"80mm" | "58mm">("80mm");
  const [error, setError] = useState(
    () =>
      (location.state as { printError?: string } | null)?.printError ?? "",
  );
  const invoice = usePosLive(() => posDb.invoices.get(id!), undefined, [id]);
  const items = usePosLive(
    () => posDb.invoiceLines.where("invoiceId").equals(id!).toArray(),
    [],
    [id],
  );
  const modifiers = usePosLive(
    () =>
      posDb.invoiceModifiers
        .toArray()
        .then((rows) =>
          rows.filter((row) =>
            items.some((item) => item.id === row.invoiceLineId),
          ),
        ),
    [],
    [id, items],
  );
  const allocationLines = usePosLive(
    () => posDb.invoiceAllocationLines.where("invoiceId").equals(id!).toArray(),
    [],
    [id],
  );
  const payments = usePosLive(
    () => posDb.payments.where("invoiceId").equals(id!).toArray(),
    [],
    [id],
  );
  const printEvents = usePosLive(
    () => posDb.receiptPrintEvents.where("invoiceId").equals(id!).toArray(),
    [],
    [id],
  );
  if (!invoice) return <p>الفاتورة غير موجودة</p>;
  const due = (
    BigInt(invoice.totalMinor) -
    payments.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n)
  ).toString();
  const pay = async () => {
    const userId = admin?.id ?? offline?.userId;
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    const printer = new BrowserReceiptPrinter();
    let printTarget: HTMLIFrameElement | undefined;
    try {
      printTarget = printer.reservePrintFrame();
    } catch {
      // A print setup failure must never prevent or roll back a valid payment.
    }
    try {
      await payLocalInvoice({
        invoiceId: invoice.id,
        userId,
        method: "CASH",
        amountMinor: due,
        tenderedMinor: tendered ? shekelInputToMinor(tendered) : due,
      });
      try {
        const printType = printEvents.length > 0 ? "REPRINT" : "INITIAL";
        const receipt = await loadReceiptData(
          invoice.id,
          admin?.name ?? "الكاشير",
          printType === "REPRINT",
        );
        await printer.print(receipt, profile, printTarget);
        await recordLocalPrintEvent(invoice.id, printType, profile);
      } catch {
        printer.releasePrintTarget(printTarget);
        setError(
          "تم الدفع بنجاح، لكن تعذرت الطباعة التلقائية. اضغط إعادة طباعة الإيصال.",
        );
      }
    } catch (cause) {
      printer.releasePrintTarget(printTarget);
      setError(
        posErrorMessage(cause, "تعذر الدفع. راجع حالة الفاتورة والمبلغ."),
      );
    } finally {
      setBusy(false);
    }
  };
  const print = async () => {
    if (printBusy) return;
    setPrintBusy(true);
    setError("");
    try {
      const printType = printEvents.length > 0 ? "REPRINT" : "INITIAL";
      const receipt = await loadReceiptData(
        invoice.id,
        admin?.name ?? "الكاشير",
        printType === "REPRINT",
      );
      await new BrowserReceiptPrinter().print(receipt, profile);
      await recordLocalPrintEvent(invoice.id, printType, profile);
    } catch {
      setError(
        "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة، تحقق من الطابعة، ثم أعد المحاولة.",
      );
    } finally {
      setPrintBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-xl rounded-2xl bg-white p-6">
      <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
      {invoice.splitMode && (
        <p className="mt-2 text-amber-700">
          {invoice.splitMode === "EQUAL" ? "تقسيم متساوٍ" : "تقسيم حسب الأصناف"}{" "}
          — فاتورة {invoice.splitIndex} من {invoice.splitCount}
        </p>
      )}
      <div className="my-5 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border-b p-2">
            <div className="flex justify-between">
              <span>
                {item.itemNameSnapshot} × {item.quantity}
              </span>
              <span>{formatMinor(item.totalMinor)}</span>
            </div>
            {modifiers
              .filter((modifier) => modifier.invoiceLineId === item.id)
              .map((modifier) => (
                <div key={modifier.id} className="text-sm text-slate-600">
                  + {modifier.groupNameSnapshot}: {modifier.optionNameSnapshot}{" "}
                  ({formatMinor(modifier.totalMinor)})
                </div>
              ))}
          </div>
        ))}
        {allocationLines.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>
              {item.itemNameSnapshot} — {item.quantityNumerator}/
              {item.quantityDenominator}
            </span>
            <span>{formatMinor(item.totalMinor)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <b>الإجمالي: {formatMinor(invoice.totalMinor)}</b>
        <b>المدفوع: {formatMinor(BigInt(invoice.totalMinor) - BigInt(due))}</b>
        <b>المتبقي: {formatMinor(due)}</b>
      </div>
      {payments.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <b>توزيع الدفعات</b>
          {payments.map((payment) => (
            <div key={payment.id} className="flex justify-between">
              <span>{payment.method === "CASH" ? "نقدي" : "Visa"}</span>
              <span>{formatMinor(payment.amountMinor)}</span>
            </div>
          ))}
        </div>
      )}
      {invoice.status === "OPEN" && (
        <div className="mt-5 rounded-xl bg-slate-100 p-4">
          <div className="rounded-xl bg-amber-500 p-3 text-center font-bold">
            طريقة الدفع: نقدي
          </div>
          <input
            value={tendered}
            inputMode="decimal"
            onChange={(event) =>
              setTendered(normalizeShekelInput(event.target.value))
            }
            placeholder={`المستلم بالشيكل (المطلوب ${minorToShekelInput(due)})`}
            className="mt-3 min-h-12 w-full rounded-xl border px-3"
          />
          <button
            disabled={busy}
            onClick={() => void pay()}
            className="mt-3 min-h-12 w-full rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-50"
          >
            {busy ? "جارٍ الدفع…" : "دفع الفاتورة"}
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-rose-50 p-3 text-rose-800"
        >
          {error}
        </p>
      )}
      <label className="mt-5 block">
        مقاس ورق الطابعة
        <select
          value={profile}
          onChange={(event) =>
            setProfile(event.target.value as "80mm" | "58mm")
          }
          className="mt-1 min-h-11 w-full rounded-lg border px-3"
        >
          <option value="80mm">80 مم</option>
          <option value="58mm">58 مم</option>
        </select>
      </label>
      <button
        disabled={printBusy}
        onClick={() => void print()}
        className="mt-5 min-h-12 w-full rounded-xl bg-slate-950 text-white"
      >
        {printBusy
          ? "جارٍ تجهيز الإيصال…"
          : printEvents.length > 0
            ? "إعادة طباعة الإيصال"
            : "طباعة الإيصال"}
      </button>
    </section>
  );
}
