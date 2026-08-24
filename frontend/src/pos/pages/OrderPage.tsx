import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { posDb, type LocalMenuItem } from "../db/schema";
import { usePosLive } from "../hooks/usePosLive";
import {
  addLocalOrderItem,
  mergeLocalOrders,
  removeLocalOrderItem,
  requestLocalBill,
  transferLocalOrder,
  updateLocalOrderItem,
} from "../commands/localCommands";
import { addMinor } from "../types";
import { priceLine } from "../domain/pricing";
import { formatMinor } from "../format";
import { posErrorMessage } from "../errors";

export default function OrderPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [pendingItem, setPendingItem] = useState<LocalMenuItem>();
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [destination, setDestination] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const table = usePosLive(() => posDb.restaurantTables.get(id!), undefined, [
    id,
  ]);
  const order = usePosLive(
    () =>
      table?.currentOrderId
        ? posDb.orders.get(table.currentOrderId)
        : Promise.resolve(undefined),
    undefined,
    [table?.currentOrderId],
  );
  const items = usePosLive(
    () =>
      order
        ? posDb.orderItems.where("orderId").equals(order.id).sortBy("sortOrder")
        : Promise.resolve([]),
    [],
    [order?.id],
  );
  const itemModifiers = usePosLive(
    () => posDb.orderItemModifiers.toArray(),
    [],
    [],
  );
  const menu = usePosLive(
    () =>
      posDb.menuItems
        .toCollection()
        .filter((item) => item.isAvailable && !item.isArchived)
        .sortBy("sortOrder"),
    [],
    [],
  );
  const categories = usePosLive(
    () => posDb.categories.orderBy("sortOrder").toArray(),
    [],
    [],
  );
  const links = usePosLive(
    () => posDb.menuItemModifierGroups.toArray(),
    [],
    [],
  );
  const groups = usePosLive(
    () =>
      posDb.modifierGroups
        .toCollection()
        .filter((group) => group.isActive)
        .sortBy("sortOrder"),
    [],
    [],
  );
  const options = usePosLive(
    () =>
      posDb.modifierOptions
        .toCollection()
        .filter((option) => option.isActive)
        .sortBy("sortOrder"),
    [],
    [],
  );
  const tables = usePosLive(
    () => posDb.restaurantTables.orderBy("sortOrder").toArray(),
    [],
    [],
  );
  const allOrders = usePosLive(() => posDb.orders.toArray(), [], []);
  const allOrderItems = usePosLive(() => posDb.orderItems.toArray(), [], []);
  const shown = useMemo(
    () =>
      menu.filter(
        (item) =>
          (!categoryId || item.categoryId === categoryId) &&
          `${item.name} ${item.nameEn ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [menu, search, categoryId],
  );
  const relevantGroups = pendingItem
    ? links
        .filter((link) => link.menuItemId === pendingItem.id)
        .map((link) => groups.find((group) => group.id === link.groupId))
        .filter((group): group is NonNullable<typeof group> => Boolean(group))
    : [];
  const beginAdd = (menuItem: LocalMenuItem) => {
    setError("");
    const hasModifiers = links.some((link) => link.menuItemId === menuItem.id);
    if (!hasModifiers) void add(menuItem, {});
    else {
      setPendingItem(menuItem);
      setSelections({});
    }
  };
  const toggle = (groupId: string, optionId: string, max: number) =>
    setSelections((current) => {
      const selected = current[groupId] ?? [];
      return {
        ...current,
        [groupId]: selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : max === 1
            ? [optionId]
            : selected.length < max
              ? [...selected, optionId]
              : selected,
      };
    });
  const add = async (
    menuItem: LocalMenuItem,
    selected: Record<string, string[]>,
  ) => {
    if (!order || order.status !== "OPEN" || busyAction) return;
    setBusyAction(`add:${menuItem.id}`);
    try {
      const selectedOptions = relevantGroups.flatMap((group) => {
        const ids = selected[group.id] ?? [];
        if (
          ids.length < group.minSelections ||
          ids.length > group.maxSelections
        )
          throw new Error(
            `اختر ${group.minSelections}–${group.maxSelections} من ${group.name}`,
          );
        return ids.map((optionId) => ({
          group,
          option: options.find((option) => option.id === optionId)!,
        }));
      });
      const priced = priceLine(
        menuItem.discountPriceMinor ?? menuItem.priceMinor,
        1,
        selectedOptions.map(({ group, option }) => ({
          groupType: group.type,
          priceType: option.priceType,
          priceMinor: option.priceMinor,
        })),
      );
      await addLocalOrderItem({
        orderId: order.id,
        menuItemId: menuItem.id,
        itemNameSnapshot: menuItem.name,
        itemNameEnSnapshot: menuItem.nameEn,
        unitPriceMinor: priced.unitPriceMinor,
        quantity: 1,
        modifiers: selectedOptions.map(({ group, option }) => ({
          id: option.id,
          groupNameSnapshot: group.name,
          optionNameSnapshot: option.name,
          priceTypeSnapshot: option.priceType,
          unitPriceMinor: option.priceMinor,
        })),
      });
      setPendingItem(undefined);
      setSelections({});
    } catch (cause) {
      setError(
        posErrorMessage(
          cause,
          cause instanceof Error && !/^[A-Z_]+$/.test(cause.message)
            ? cause.message
            : "تعذر إضافة الصنف.",
        ),
      );
    } finally {
      setBusyAction("");
    }
  };
  const total = addMinor(...items.map((item) => item.lineTotalMinor));
  const runItemAction = async (key: string, action: () => Promise<unknown>) => {
    if (busyAction) return;
    setBusyAction(key);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(posErrorMessage(cause));
    } finally {
      setBusyAction("");
    }
  };
  const bill = async (path: "checkout" | "split") => {
    if (!order || busyAction) return;
    setBusyAction(`bill:${path}`);
    setError("");
    try {
      if (order.status === "OPEN") await requestLocalBill(order.id);
      nav(`/pos/${path}/${order.id}`);
    } catch (cause) {
      setError(posErrorMessage(cause));
    } finally {
      setBusyAction("");
    }
  };
  const transfer = async () => {
    if (!order || !destination || busyAction) return;
    const target = tables.find((row) => row.id === destination);
    if (!target || target.currentOrderId || target.status === "DISABLED") {
      setError("طاولة الوجهة غير متاحة.");
      return;
    }
    if (
      confirm(
        `تأكيد نقل الطلب ${order.id.slice(0, 8)} من ${table?.displayName ?? table?.code} إلى ${target.displayName ?? target.code}\nالإجمالي: ${formatMinor(total)}\nالوجهة متاحة ولا تحتوي طلباً.`,
      )
    ) {
      setBusyAction("transfer");
      setError("");
      try {
        await transferLocalOrder(order.id, destination);
        nav(`/pos/table/${destination}`);
      } catch (cause) {
        setError(posErrorMessage(cause));
      } finally {
        setBusyAction("");
      }
    }
  };
  const merge = async () => {
    if (!order || !mergeSource || mergeSource === order.id || busyAction)
      return;
    const sourceTable = tables.find(
      (row) => row.currentOrderId === mergeSource,
    );
    const sourceOrder = allOrders.find((row) => row.id === mergeSource);
    const sourceItems = allOrderItems.filter(
      (item) => item.orderId === mergeSource,
    );
    const sourceTotal = addMinor(
      ...sourceItems.map((item) => item.lineTotalMinor),
    );
    if (
      !sourceTable ||
      !sourceOrder ||
      !["OPEN", "BILL_REQUESTED"].includes(sourceOrder.status)
    ) {
      setError("طلب الدمج لم يعد مفتوحاً. حدّث الطاولات واختر طلباً آخر.");
      return;
    }
    if (
      confirm(
        `تأكيد الدمج\nالمصدر: ${sourceTable.displayName ?? sourceTable.code} — ${sourceItems.length} صنف — ${formatMinor(sourceTotal)}\nالطلب الباقي: ${table?.displayName ?? table?.code} — ${items.length} صنف — ${formatMinor(total)}\nالإجمالي بعد الدمج: ${formatMinor(BigInt(total) + BigInt(sourceTotal))}`,
      )
    ) {
      setBusyAction("merge");
      setError("");
      try {
        await mergeLocalOrders(order.id, [mergeSource]);
        setMergeSource("");
      } catch (cause) {
        setError(posErrorMessage(cause));
      } finally {
        setBusyAction("");
      }
    }
  };
  const available = tables.filter(
    (row) =>
      row.id !== table?.id &&
      row.isActive &&
      !row.currentOrderId &&
      row.status !== "DISABLED",
  );
  const occupied = tables.filter((row) => {
    const candidate = allOrders.find(
      (candidateOrder) => candidateOrder.id === row.currentOrderId,
    );
    return (
      row.id !== table?.id &&
      candidate &&
      candidate.id !== order?.id &&
      ["OPEN", "BILL_REQUESTED"].includes(candidate.status)
    );
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <section>
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => nav("/pos")}
            className="min-h-12 rounded-xl bg-white px-4"
          >
            عودة
          </button>
          <input
            aria-label="بحث عن صنف"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث عن صنف"
            className="min-h-12 flex-1 rounded-xl border px-4"
          />
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setCategoryId("")}
            className={`min-h-11 shrink-0 rounded-full px-4 ${!categoryId ? "bg-amber-500" : "bg-white"}`}
          >
            الكل
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 ${categoryId === category.id ? "bg-amber-500" : "bg-white"}`}
            >
              {category.name}
            </button>
          ))}
        </div>
        {shown.length === 0 && (
          <p className="rounded-xl bg-white p-5">
            لا توجد أصناف متاحة تطابق البحث.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {shown.map((item) => (
            <button
              key={item.id}
              disabled={Boolean(busyAction) || order?.status !== "OPEN"}
              onClick={() => beginAdd(item)}
              className="min-h-28 rounded-2xl bg-white p-4 text-right shadow-sm focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 disabled:opacity-50"
            >
              <b>{item.name}</b>
              <div className="mt-3 text-amber-700">
                {formatMinor(item.discountPriceMinor ?? item.priceMinor)}
              </div>
            </button>
          ))}
        </div>
      </section>
      <aside className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">
          الطلب — {table?.displayName ?? table?.code}
        </h2>
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-xl bg-rose-50 p-3 text-rose-800"
          >
            {error}
          </p>
        )}
        {items.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4">لا توجد أصناف في الطلب.</p>
        )}
        <div className="max-h-[48vh] space-y-2 overflow-auto">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex justify-between">
                <span>{item.itemNameSnapshot}</span>
                <b>{formatMinor(item.lineTotalMinor)}</b>
              </div>
              {itemModifiers
                .filter((modifier) => modifier.orderItemId === item.id)
                .map((modifier) => (
                  <div key={modifier.id} className="text-xs text-slate-600">
                    + {modifier.groupNameSnapshot}:{" "}
                    {modifier.optionNameSnapshot}
                  </div>
                ))}
              {item.notes && (
                <p className="mt-1 text-xs">ملاحظة: {item.notes}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  disabled={
                    Boolean(busyAction) ||
                    !order ||
                    item.quantity <= 1 ||
                    order.status !== "OPEN"
                  }
                  onClick={() =>
                    order &&
                    void runItemAction(`decrease:${item.id}`, () =>
                      updateLocalOrderItem(
                        order.id,
                        item.id,
                        item.quantity - 1,
                        item.notes,
                      ),
                    )
                  }
                  className="h-11 w-11 rounded-lg bg-white"
                >
                  −
                </button>
                <b>{item.quantity}</b>
                <button
                  disabled={
                    Boolean(busyAction) || !order || order.status !== "OPEN"
                  }
                  onClick={() =>
                    order &&
                    void runItemAction(`increase:${item.id}`, () =>
                      updateLocalOrderItem(
                        order.id,
                        item.id,
                        item.quantity + 1,
                        item.notes,
                      ),
                    )
                  }
                  className="h-11 w-11 rounded-lg bg-white"
                >
                  +
                </button>
                <button
                  disabled={
                    Boolean(busyAction) || !order || order.status !== "OPEN"
                  }
                  onClick={() => {
                    const notes = prompt("ملاحظة الصنف", item.notes ?? "");
                    if (notes !== null && order)
                      void runItemAction(`notes:${item.id}`, () =>
                        updateLocalOrderItem(
                          order.id,
                          item.id,
                          item.quantity,
                          notes,
                        ),
                      );
                  }}
                  className="h-11 rounded-lg bg-white px-3"
                >
                  ملاحظة
                </button>
                <button
                  disabled={
                    Boolean(busyAction) || !order || order.status !== "OPEN"
                  }
                  onClick={() =>
                    order &&
                    confirm(`حذف ${item.itemNameSnapshot}؟`) &&
                    void runItemAction(`remove:${item.id}`, () =>
                      removeLocalOrderItem(order.id, item.id),
                    )
                  }
                  className="mr-auto h-11 rounded-lg bg-rose-100 px-3 text-rose-700"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t pt-4 text-xl font-bold">
          <span>الإجمالي</span>
          <span>{formatMinor(total)}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            disabled={
              Boolean(busyAction) ||
              !order ||
              !items.length ||
              order.status !== "OPEN"
            }
            onClick={() => void bill("checkout")}
            className="min-h-14 rounded-xl bg-amber-500 text-lg font-bold disabled:opacity-40"
          >
            دفع كامل
          </button>
          <button
            disabled={
              Boolean(busyAction) ||
              !order ||
              !items.length ||
              order.status !== "OPEN"
            }
            onClick={() => void bill("split")}
            className="min-h-14 rounded-xl bg-slate-950 text-lg font-bold text-white disabled:opacity-40"
          >
            تقسيم الفاتورة
          </button>
        </div>
        <div className="mt-4 grid gap-2 border-t pt-4">
          <div className="flex gap-2">
            <select
              aria-label="طاولة الوجهة"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className="min-h-12 min-w-0 flex-1 rounded-xl border px-2"
            >
              <option value="">نقل إلى طاولة متاحة</option>
              {available.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName ?? row.code}
                </option>
              ))}
            </select>
            <button
              disabled={
                Boolean(busyAction) || !destination || order?.status !== "OPEN"
              }
              onClick={() => void transfer()}
              className="min-h-12 rounded-xl border px-3 disabled:opacity-40"
            >
              نقل
            </button>
          </div>
          <div className="flex gap-2">
            <select
              aria-label="طلب الدمج"
              value={mergeSource}
              onChange={(event) => setMergeSource(event.target.value)}
              className="min-h-12 min-w-0 flex-1 rounded-xl border px-2"
            >
              <option value="">دمج طلب طاولة مشغولة</option>
              {occupied.map((row) => (
                <option key={row.id} value={row.currentOrderId!}>
                  {row.displayName ?? row.code}
                </option>
              ))}
            </select>
            <button
              disabled={
                Boolean(busyAction) || !mergeSource || order?.status !== "OPEN"
              }
              onClick={() => void merge()}
              className="min-h-12 rounded-xl border px-3 disabled:opacity-40"
            >
              دمج
            </button>
          </div>
        </div>
      </aside>
      {pendingItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modifier-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5">
            <h2 id="modifier-title" className="text-2xl font-bold">
              {pendingItem.name}: الخيارات
            </h2>
            {relevantGroups.map((group) => (
              <fieldset key={group.id} className="mt-4 rounded-xl border p-3">
                <legend className="px-2 font-bold">
                  {group.name} ({group.minSelections}–{group.maxSelections})
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {options
                    .filter((option) => option.groupId === group.id)
                    .map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() =>
                          toggle(group.id, option.id, group.maxSelections)
                        }
                        className={`min-h-12 rounded-xl border px-3 ${selections[group.id]?.includes(option.id) ? "bg-amber-500" : "bg-white"}`}
                      >
                        {option.name}{" "}
                        {option.priceMinor !== "0" &&
                          `(${formatMinor(option.priceMinor)})`}
                      </button>
                    ))}
                </div>
              </fieldset>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPendingItem(undefined);
                  setSelections({});
                }}
                className="min-h-12 rounded-xl border"
              >
                إلغاء
              </button>
              <button
                disabled={Boolean(busyAction)}
                onClick={() => void add(pendingItem, selections)}
                className="min-h-12 rounded-xl bg-emerald-600 font-bold text-white"
              >
                إضافة بالخيارات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
