import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { posDb } from "../db/schema";
import { usePosLive } from "../hooks/usePosLive";
import { openLocalOrder } from "../commands/localCommands";
import { currentBusinessDate } from "../domain/businessDate";
import { useState } from "react";
import { formatMinor } from "../format";
import { posErrorMessage } from "../errors";

const colors: Record<string, string> = {
  AVAILABLE: "pos-table-available",
  OCCUPIED: "pos-table-occupied",
  RESERVED: "pos-table-reserved",
  BILL_REQUESTED: "pos-table-bill",
  DISABLED: "pos-table-disabled",
};
const labels: Record<string, string> = {
  AVAILABLE: "متاحة",
  OCCUPIED: "مشغولة",
  RESERVED: "محجوزة",
  BILL_REQUESTED: "طلب الحساب",
  DISABLED: "معطلة",
};

export default function PosDashboardPage() {
  const tables = usePosLive(
    () => posDb.restaurantTables.orderBy("sortOrder").toArray(),
    [],
    [],
  );
  const orders = usePosLive(() => posDb.orders.toArray(), [], []);
  const items = usePosLive(() => posDb.orderItems.toArray(), [], []);
  const reservations = usePosLive(() => posDb.reservations.toArray(), [], []);
  const state = usePosLive(
    () => posDb.deviceState.get("primary"),
    undefined,
    [],
  );
  const admin = useAuthStore((store) => store.admin);
  const offline = usePosLive(
    () => posDb.offlineSession.toCollection().first(),
    undefined,
    [],
  );
  const nav = useNavigate();
  const [busyTable, setBusyTable] = useState<string>();
  const [error, setError] = useState("");
  const open = async (tableId: string) => {
    const table = tables.find((row) => row.id === tableId);
    const userId = admin?.id ?? offline?.userId;
    if (
      !table ||
      !userId ||
      !table.isActive ||
      table.status === "DISABLED" ||
      busyTable
    )
      return;
    if (table.currentOrderId) {
      nav(`/pos/table/${tableId}`);
      return;
    }
    setBusyTable(tableId);
    setError("");
    try {
      await openLocalOrder({
        tableId,
        userId,
        businessDate: currentBusinessDate(state),
      });
      nav(`/pos/table/${tableId}`);
    } catch (cause) {
      setError(posErrorMessage(cause));
    } finally {
      setBusyTable(undefined);
    }
  };
  return (
    <section>
      <div className="mb-5">
        <h1 className="text-3xl font-bold">الطاولات</h1>
        <p className="text-slate-500">
          الحالة والمبلغ والحجز ظاهرة قبل فتح الطلب
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-rose-50 p-3 text-rose-800"
        >
          {error}
        </p>
      )}
      {tables.length === 0 && (
        <p className="rounded-2xl bg-white p-6">
          لا توجد طاولات مهيأة. اطلب من المدير إعدادها.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {tables.map((table) => {
          const order = orders.find((row) => row.id === table.currentOrderId);
          const total = items
            .filter((item) => item.orderId === order?.id)
            .reduce((sum, item) => sum + BigInt(item.lineTotalMinor), 0n);
          const minutes = order
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(order.openedAt).getTime()) / 60_000,
                ),
              )
            : 0;
          const reservation = reservations.find(
            (row) =>
              row.tableIds.includes(table.id) &&
              ["PENDING", "CONFIRMED"].includes(row.status),
          );
          return (
            <button
              key={table.id}
              disabled={
                Boolean(busyTable) ||
                !table.isActive ||
                table.status === "DISABLED"
              }
              onClick={() => void open(table.id)}
              className={cn(
                "pos-table-card min-h-44 rounded-2xl p-4 text-right transition hover:-translate-y-0.5",
                colors[table.status] ?? colors.AVAILABLE,
              )}
            >
              <div className="flex justify-between gap-2">
                <div className="text-xl font-bold">
                  {table.displayName ?? table.code}
                </div>
                <span className="pos-table-status text-sm font-bold">
                  {labels[table.status] ?? table.status}
                </span>
              </div>
              <div className="mt-1 text-xs">السعة: {table.capacity}</div>
              {order && (
                <>
                  <div className="mt-3 text-lg font-bold">
                    {formatMinor(total)}
                  </div>
                  <div className="text-xs">مشغولة منذ {minutes} دقيقة</div>
                </>
              )}
              {reservation && (
                <div className="mt-3 rounded-lg bg-blue-100 p-2 text-xs text-blue-950">
                  حجز مؤكد: {reservation.customerName} ·{" "}
                  {new Intl.DateTimeFormat("ar", {
                    timeZone: state?.timezone ?? "Asia/Hebron",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(reservation.startsAt))}
                </div>
              )}
              <div className="mt-3 text-xs font-medium">
                {busyTable === table.id
                  ? "جارٍ فتح الطلب…"
                  : !table.isActive || table.status === "DISABLED"
                    ? "الطاولة معطلة"
                    : table.currentOrderId
                      ? "متابعة الطلب"
                      : "فتح طلب جديد"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
