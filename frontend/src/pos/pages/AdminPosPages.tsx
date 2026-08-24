import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth";
import type { Permission } from "@/types";
import {
  CalendarDays,
  ChartNoAxesCombined,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  TableProperties,
  type LucideIcon,
} from "lucide-react";
import { verifyAndStoreCapability } from "../auth/offline";
import { formatMinor } from "../format";
import { posErrorMessage } from "../errors";

function useRemote<T>(url: string, initial: T) {
  const [value, setValue] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((current) => current + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void unwrap<T>(api.get(url))
      .then((result) => {
        if (active) setValue(result);
      })
      .catch((cause) => {
        if (active)
          setError(posErrorMessage(cause, "تعذر تحميل البيانات من الخادم."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url, revision]);
  return { value, loading, error, reload };
}

function PageState({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: string;
  empty?: string;
}) {
  if (loading) return <p className="rounded-xl bg-white p-5">جارٍ التحميل…</p>;
  if (error)
    return (
      <p role="alert" className="rounded-xl bg-rose-50 p-5 text-rose-800">
        {error}
      </p>
    );
  return empty ? <p className="rounded-xl bg-white p-5">{empty}</p> : null;
}

export const ADMIN_POS_SECTIONS: {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
}[] = [
  {
    to: "/admin/pos/tables",
    label: "إعداد الطاولات",
    description: "الأسماء والسعة والحالة والتفعيل",
    icon: TableProperties,
    permission: "pos:table:configure",
  },
  {
    to: "/admin/pos/devices",
    label: "الأجهزة والإقران",
    description: "أجهزة الكاشير وحالة الاتصال",
    icon: MonitorSmartphone,
    permission: "pos:device:manage",
  },
  {
    to: "/admin/pos/reports",
    label: "تقارير المبيعات",
    description: "المبيعات والدفعات والتصدير",
    icon: ChartNoAxesCombined,
    permission: "pos:reports:read",
  },
  {
    to: "/admin/pos/invoices",
    label: "سجل الفواتير",
    description: "البحث والتفاصيل والمرتجعات",
    icon: ReceiptText,
    permission: "pos:reports:read",
  },
  {
    to: "/admin/pos/reservations",
    label: "الحجوزات",
    description: "مواعيد اليوم والطاولات المعيّنة",
    icon: CalendarDays,
    permission: "pos:reservation:manage",
  },
  {
    to: "/admin/pos/audit",
    label: "سجل تدقيق POS",
    description: "الأحداث المالية والتشغيلية",
    icon: ShieldCheck,
    permission: "pos:audit:read",
  },
];
export function visibleAdminPosSections(permissions: readonly string[]) {
  return ADMIN_POS_SECTIONS.filter((section) =>
    permissions.includes(section.permission),
  );
}

export function AdminPosHome() {
  const { permissions } = usePermissions();
  const sections = visibleAdminPosSections(permissions);
  return (
    <div>
      <h1 className="text-3xl font-bold">إدارة نقاط البيع</h1>
      <p className="mt-2 text-muted-foreground">
        إدارة تشغيل المطعم دون الحاجة إلى أدوات قاعدة البيانات.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.to}
              to={section.to}
              className="pos-admin-card group flex min-h-28 items-center gap-4 rounded-2xl p-5"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500 text-slate-950">
                <Icon className="h-6 w-6" />
              </span>
              <span>
                <b className="block text-lg">{section.label}</b>
                <small className="mt-1 block font-normal text-slate-600">
                  {section.description}
                </small>
              </span>
            </Link>
          );
        })}
        <Link
          to="/pos/diagnostics"
          className="pos-admin-card flex min-h-28 items-center gap-4 rounded-2xl p-5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            <Stethoscope className="h-6 w-6" />
          </span>
          <span>
            <b className="block text-lg">تشخيص جهاز POS الحالي</b>
            <small className="mt-1 block font-normal text-slate-600">
              التخزين والمزامنة والعمل دون اتصال
            </small>
          </span>
        </Link>
      </div>
    </div>
  );
}

interface TableRow {
  id: string;
  code: string;
  displayName?: string | null;
  capacity?: number | null;
  status: string;
  isActive: boolean;
  sortOrder: number;
}
export function AdminTablesPage() {
  const remote = useRemote<TableRow[]>("/admin/pos/tables", []);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const create = async () => {
    if (!code || busy) return;
    setBusy("create");
    setError("");
    try {
      await unwrap(
        api.post("/admin/pos/tables", {
          code,
          displayName: name || null,
          capacity,
          status: "AVAILABLE",
          isActive: true,
          sortOrder: remote.value.length,
        }),
      );
      setCode("");
      setName("");
      remote.reload();
    } catch (cause) {
      setError(
        posErrorMessage(
          cause,
          "تعذر إنشاء الطاولة. اقترن بجهاز POS أولاً إن طُلب.",
        ),
      );
    } finally {
      setBusy("");
    }
  };
  const patch = async (row: TableRow, data: Partial<TableRow>) => {
    if (busy) return;
    setBusy(row.id);
    setError("");
    try {
      await unwrap(api.patch(`/admin/pos/tables/${row.id}`, data));
      remote.reload();
    } catch (cause) {
      setError(posErrorMessage(cause, "تعذر تعديل الطاولة."));
    } finally {
      setBusy("");
    }
  };
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">إعداد الطاولات</h1>
      <div className="mb-4 grid gap-2 rounded-xl bg-white p-4 md:grid-cols-4">
        <input
          aria-label="رمز الطاولة"
          placeholder="الرمز (T01)"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="min-h-12 rounded-lg border px-3"
        />
        <input
          aria-label="اسم الطاولة"
          placeholder="الاسم الظاهر"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-12 rounded-lg border px-3"
        />
        <input
          aria-label="سعة الطاولة"
          type="number"
          min={1}
          value={capacity}
          onChange={(event) =>
            setCapacity(Math.max(1, Number(event.target.value)))
          }
          className="min-h-12 rounded-lg border px-3"
        />
        <button
          disabled={!code || Boolean(busy)}
          onClick={() => void create()}
          className="min-h-12 rounded-lg bg-amber-500 font-bold disabled:opacity-50"
        >
          إضافة طاولة
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-3 text-rose-700">
          {error}
        </p>
      )}
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={
          !remote.loading && !remote.value.length
            ? "لا توجد طاولات مهيأة."
            : undefined
        }
      />
      <div className="space-y-2">
        {remote.value.map((row) => (
          <div
            key={row.id}
            className="grid items-center gap-2 rounded-xl bg-white p-4 md:grid-cols-[1fr_100px_140px_140px]"
          >
            <div>
              <b>{row.displayName || row.code}</b>
              <div className="text-sm text-slate-500">
                {row.code} · {row.status}
              </div>
            </div>
            <input
              aria-label={`سعة ${row.code}`}
              type="number"
              min={1}
              defaultValue={row.capacity ?? 1}
              onBlur={(event) =>
                void patch(row, { capacity: Number(event.target.value) })
              }
              className="min-h-11 rounded-lg border px-2"
            />
            <select
              aria-label={`حالة ${row.code}`}
              value={row.status}
              disabled={busy === row.id}
              onChange={(event) =>
                void patch(row, { status: event.target.value })
              }
              className="min-h-11 rounded-lg border px-2"
            >
              <option value="AVAILABLE">متاحة</option>
              <option value="RESERVED">محجوزة</option>
              <option value="DISABLED">معطلة</option>
            </select>
            <button
              disabled={busy === row.id}
              onClick={() =>
                void patch(row, {
                  isActive: !row.isActive,
                  status: row.isActive ? "DISABLED" : "AVAILABLE",
                })
              }
              className={`min-h-11 rounded-lg px-3 ${row.isActive ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"}`}
            >
              {row.isActive ? "تعطيل" : "تفعيل"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DeviceRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string | null;
}
export function AdminDevicesPage() {
  const remote = useRemote<DeviceRow[]>("/admin/pos/devices", []);
  const admin = useAuthStore((state) => state.admin);
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const create = async () => {
    if (!code || !name || busy) return;
    setBusy("create");
    setError("");
    try {
      await unwrap(
        api.post("/admin/pos/devices", { code, name, isActive: true }),
      );
      setCode("");
      setName("");
      remote.reload();
    } catch (cause) {
      setError(
        posErrorMessage(cause, "تعذر إنشاء الجهاز. تحقق أن الرمز غير مستخدم."),
      );
    } finally {
      setBusy("");
    }
  };
  const pair = async (id: string) => {
    if (!admin || busy) return;
    setBusy(id);
    setError("");
    try {
      const value = await unwrap<{
        capability: string;
        publicKeyBase64: string;
      }>(api.post(`/admin/pos/devices/${id}/pair`, { userId: admin.id, pin }));
      await verifyAndStoreCapability(value.capability, value.publicKeyBase64);
      localStorage.setItem("rawaqan_pos_device_id", id);
      location.assign("/pos");
    } catch (cause) {
      setError(
        posErrorMessage(cause, "تعذر إقران الجهاز. تحقق من PIN وحالة الجهاز."),
      );
      setBusy("");
    }
  };
  const toggle = async (row: DeviceRow) => {
    if (busy) return;
    setBusy(row.id);
    try {
      await unwrap(
        api.patch(`/admin/pos/devices/${row.id}`, { isActive: !row.isActive }),
      );
      remote.reload();
    } catch (cause) {
      setError(posErrorMessage(cause));
    } finally {
      setBusy("");
    }
  };
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">أجهزة POS</h1>
      <div className="mb-4 grid gap-2 rounded-xl bg-white p-4 md:grid-cols-3">
        <input
          placeholder="رمز الجهاز (P01)"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="min-h-12 rounded-lg border px-3"
        />
        <input
          placeholder="اسم الجهاز"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-12 rounded-lg border px-3"
        />
        <button
          disabled={!code || !name || Boolean(busy)}
          onClick={() => void create()}
          className="rounded-lg bg-amber-500 font-bold disabled:opacity-50"
        >
          إضافة جهاز
        </button>
      </div>
      <label className="mb-4 block">
        PIN للإقران (لا يُحفظ كنص صريح)
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          type="password"
          className="mt-1 min-h-12 w-full rounded-xl border px-4"
        />
      </label>
      {error && (
        <p role="alert" className="mb-3 text-rose-700">
          {error}
        </p>
      )}
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={
          !remote.loading && !remote.value.length
            ? "لا توجد أجهزة POS."
            : undefined
        }
      />
      {remote.value.map((row) => (
        <div
          key={row.id}
          className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4"
        >
          <div>
            <b>
              {row.code} — {row.name}
            </b>
            <div>
              {row.isActive ? "نشط" : "معطل"} · آخر اتصال:{" "}
              {row.lastSeenAt
                ? new Date(row.lastSeenAt).toLocaleString("ar")
                : "لم يتصل"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={Boolean(busy)}
              onClick={() => void toggle(row)}
              className="min-h-11 rounded-lg border px-3"
            >
              {row.isActive ? "تعطيل" : "تفعيل"}
            </button>
            <button
              disabled={!row.isActive || pin.length < 4 || Boolean(busy)}
              onClick={() => void pair(row.id)}
              className="min-h-11 rounded-lg bg-slate-950 px-4 text-white disabled:opacity-40"
            >
              {busy === row.id ? "جارٍ التنفيذ…" : "إقران هذا المتصفح"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface Report {
  range: { from: string; to: string };
  timeZone: string;
  grossSalesMinor: string;
  discountsMinor: string;
  refundsMinor: string;
  netSalesMinor: string;
  cashMinor: string;
  visaMinor: string;
  invoiceCount: number;
  averageInvoiceMinor: string;
  voidCount: number;
  voidValueMinor: string;
  topItems: {
    id: string;
    name: string;
    quantityNumerator: string;
    quantityDenominator: string;
    revenueMinor: string;
  }[];
  categories: { id: string; name: string; revenueMinor: string }[];
  salesByHour: { hour: number; revenueMinor: string }[];
  peakHour?: { hour: number; revenueMinor: string } | null;
}
export function AdminReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const remote = useRemote<Report | null>(
    `/admin/pos/reports/sales?from=${from}&to=${to}`,
    null,
  );
  const [exporting, setExporting] = useState("");
  const download = async (format: "pdf" | "xlsx") => {
    if (exporting) return;
    setExporting(format);
    try {
      const response = await api.get(
        `/admin/pos/reports/export?from=${from}&to=${to}&format=${format}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rawaqan-sales-${from}-${to}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting("");
    }
  };
  const report = remote.value;
  const cards: [string, string | number][] = report
    ? [
        ["إجمالي المبيعات", formatMinor(report.grossSalesMinor)],
        ["الخصومات", formatMinor(report.discountsMinor)],
        ["المرتجعات", formatMinor(report.refundsMinor)],
        ["صافي المبيعات", formatMinor(report.netSalesMinor)],
        ["نقدي", formatMinor(report.cashMinor)],
        ["Visa", formatMinor(report.visaMinor)],
        ["الفواتير", report.invoiceCount],
        ["متوسط الفاتورة", formatMinor(report.averageInvoiceMinor)],
        [
          "الإلغاءات",
          `${report.voidCount} · ${formatMinor(report.voidValueMinor)}`,
        ],
      ]
    : [];
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">تقارير المبيعات</h1>
      <div className="mb-4 flex flex-wrap gap-3 rounded-xl bg-white p-4">
        <label>
          من
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mr-2 min-h-11 rounded-lg border px-2"
          />
        </label>
        <label>
          إلى
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mr-2 min-h-11 rounded-lg border px-2"
          />
        </label>
        <button
          disabled={Boolean(exporting)}
          onClick={() => void download("pdf")}
          className="rounded-lg border px-4"
        >
          تصدير PDF
        </button>
        <button
          disabled={Boolean(exporting)}
          onClick={() => void download("xlsx")}
          className="rounded-lg border px-4"
        >
          تصدير Excel
        </button>
      </div>
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={!remote.loading && !report ? "لا توجد بيانات تقرير." : undefined}
      />
      {report && (
        <>
          <p className="mb-3">
            الفترة: {report.range.from} — {report.range.to} · {report.timeZone}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white p-4">
                <small>{label}</small>
                <div className="text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ReportList
              title="أعلى الأصناف"
              rows={report.topItems.map((row) => [
                row.name,
                `${row.quantityNumerator}/${row.quantityDenominator} · ${formatMinor(row.revenueMinor)}`,
              ])}
            />
            <ReportList
              title="أعلى الأقسام"
              rows={report.categories.map((row) => [
                row.name,
                formatMinor(row.revenueMinor),
              ])}
            />
            <ReportList
              title={`المبيعات بالساعة${report.peakHour ? ` · الذروة ${report.peakHour.hour}:00` : ""}`}
              rows={report.salesByHour.map((row) => [
                `${row.hour}:00`,
                formatMinor(row.revenueMinor),
              ])}
            />
          </div>
        </>
      )}
    </div>
  );
}
function ReportList({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl bg-white p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p>لا توجد بيانات.</p>
      ) : (
        rows.map(([label, value], index) => (
          <div
            key={`${label}-${index}`}
            className="flex justify-between border-b py-2"
          >
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))
      )}
    </div>
  );
}

interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  businessDate: string;
  totalMinor: string;
  refundedMinor: string;
  cashierNameSnapshot: string;
  issuedAt: string;
  tableSnapshots: {
    tableCodeSnapshot: string;
    tableDisplayNameSnapshot?: string | null;
  }[];
  payments: { method: string; amountMinor: string }[];
}
interface AdminInvoiceDetail extends AdminInvoice {
  subtotalMinor: string;
  discountMinor: string;
  splitGroupId?: string | null;
  lines: {
    id: string;
    itemNameSnapshot: string;
    itemNameEnSnapshot?: string | null;
    quantity: number;
    totalMinor: string;
    notes?: string | null;
    modifiers: {
      id: string;
      groupNameSnapshot: string;
      optionNameSnapshot: string;
      totalMinor: string;
    }[];
  }[];
  allocationLines: {
    id: string;
    itemNameSnapshot: string;
    quantityNumerator: string;
    quantityDenominator: string;
    totalMinor: string;
    modifiers: {
      id: string;
      groupNameSnapshot: string;
      optionNameSnapshot: string;
    }[];
  }[];
  refunds: {
    id: string;
    amountMinor: string;
    reason: string;
    refundedAt: string;
  }[];
  void?: { reason: string; createdAt: string } | null;
  printEvents: { id: string; type: string; createdAt: string }[];
}
export function AdminInvoicesPage() {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [table, setTable] = useState("");
  const [cashier, setCashier] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const params = new URLSearchParams({
    limit: "100",
    ...(number ? { invoiceNumber: number } : {}),
    ...(date ? { from: date, to: date } : {}),
    ...(table ? { table } : {}),
    ...(cashier ? { cashier } : {}),
    ...(method ? { paymentMethod: method } : {}),
    ...(status ? { status } : {}),
  });
  const remote = useRemote<AdminInvoice[]>(`/admin/pos/invoices?${params}`, []);
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">سجل الفواتير</h1>
      <div className="mb-4 grid gap-2 rounded-xl bg-white p-4 md:grid-cols-3">
        <input
          placeholder="رقم الفاتورة"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          className="min-h-11 rounded-lg border px-3"
        />
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="min-h-11 rounded-lg border px-3"
        />
        <input
          placeholder="الطاولة"
          value={table}
          onChange={(event) => setTable(event.target.value)}
          className="min-h-11 rounded-lg border px-3"
        />
        <input
          placeholder="الكاشير"
          value={cashier}
          onChange={(event) => setCashier(event.target.value)}
          className="min-h-11 rounded-lg border px-3"
        />
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="min-h-11 rounded-lg border px-3"
        >
          <option value="">كل طرق الدفع</option>
          <option value="CASH">نقدي</option>
          <option value="VISA">Visa</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-11 rounded-lg border px-3"
        >
          <option value="">كل الحالات</option>
          <option value="OPEN">مفتوحة</option>
          <option value="PAID">مدفوعة</option>
          <option value="VOIDED">ملغاة</option>
          <option value="PARTIALLY_REFUNDED">مرتجع جزئي</option>
          <option value="REFUNDED">مرتجعة</option>
        </select>
      </div>
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={
          !remote.loading && !remote.value.length
            ? "لا توجد فواتير تطابق البحث."
            : undefined
        }
      />
      <div className="space-y-2">
        {remote.value.map((row) => (
          <Link
            key={row.id}
            to={`/admin/pos/invoices/${row.id}`}
            className="grid min-h-16 gap-2 rounded-xl bg-white p-4 md:grid-cols-5"
          >
            <b>{row.invoiceNumber}</b>
            <span>
              {row.tableSnapshots
                .map(
                  (item) =>
                    item.tableDisplayNameSnapshot || item.tableCodeSnapshot,
                )
                .join("، ") || "بدون طاولة"}
            </span>
            <span>{row.cashierNameSnapshot}</span>
            <span>{row.status}</span>
            <b>{formatMinor(row.totalMinor)}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminInvoiceDetailPage() {
  const { id = "" } = useParams();
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const remote = useRemote<AdminInvoiceDetail | null>(
    `/admin/pos/invoices/${id}`,
    null,
  );
  const invoice = remote.value;
  const remainingRefund = invoice
    ? BigInt(invoice.totalMinor) - BigInt(invoice.refundedMinor)
    : 0n;
  const voidInvoice = async () => {
    if (!invoice || busy) return;
    const reason = prompt("سبب إلغاء الفاتورة (إلزامي)");
    if (!reason) return;
    if (
      !confirm(
        `تأكيد إلغاء ${invoice.invoiceNumber}؟ لا يمكن التراجع عن هذا الإجراء.`,
      )
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      await unwrap(api.post(`/pos/invoices/${invoice.id}/void`, { reason }));
      remote.reload();
    } catch (cause) {
      setActionError(posErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const refundInvoice = async () => {
    if (!invoice || remainingRefund <= 0n || busy) return;
    const amountMinor = prompt(
      `المبلغ المرتجع بالأغورة (الحد الأقصى ${remainingRefund})`,
      remainingRefund.toString(),
    );
    if (!amountMinor) return;
    const reason = prompt("سبب المرتجع (إلزامي)");
    if (!reason || !/^\d+$/.test(amountMinor)) return;
    if (
      !confirm(
        `تأكيد مرتجع ${formatMinor(amountMinor)} من ${invoice.invoiceNumber}؟`,
      )
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      await unwrap(
        api.post(`/pos/invoices/${invoice.id}/refunds`, {
          amountMinor,
          reason,
        }),
      );
      remote.reload();
    } catch (cause) {
      setActionError(posErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Link to="/admin/pos/invoices">← رجوع إلى الفواتير</Link>
      <h1 className="my-5 text-3xl font-bold">تفاصيل الفاتورة</h1>
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={
          !remote.loading && !remote.value ? "الفاتورة غير موجودة." : undefined
        }
      />
      {actionError && (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-rose-50 p-3 text-rose-800"
        >
          {actionError}
        </p>
      )}
      {invoice && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white p-4">
              <small>الرقم</small>
              <b className="block">{invoice.invoiceNumber}</b>
            </div>
            <div className="rounded-xl bg-white p-4">
              <small>الحالة</small>
              <b className="block">{invoice.status}</b>
            </div>
            <div className="rounded-xl bg-white p-4">
              <small>الكاشير</small>
              <b className="block">{invoice.cashierNameSnapshot}</b>
            </div>
            <div className="rounded-xl bg-white p-4">
              <small>الإجمالي / المرتجع</small>
              <b className="block">
                {formatMinor(invoice.totalMinor)} /{" "}
                {formatMinor(invoice.refundedMinor)}
              </b>
            </div>
          </div>
          <section className="rounded-xl bg-white p-5">
            <h2 className="mb-3 text-xl font-bold">
              لقطات الأصناف غير القابلة للتغيير
            </h2>
            {invoice.lines.map((line) => (
              <div key={line.id} className="border-b py-3">
                <div className="flex justify-between">
                  <span>
                    {line.itemNameSnapshot}
                    {line.itemNameEnSnapshot
                      ? ` / ${line.itemNameEnSnapshot}`
                      : ""}{" "}
                    × {line.quantity}
                  </span>
                  <b>{formatMinor(line.totalMinor)}</b>
                </div>
                {line.modifiers.map((modifier) => (
                  <div key={modifier.id} className="text-sm text-slate-600">
                    + {modifier.groupNameSnapshot}:{" "}
                    {modifier.optionNameSnapshot} ·{" "}
                    {formatMinor(modifier.totalMinor)}
                  </div>
                ))}
                {line.notes && <p className="text-sm">ملاحظة: {line.notes}</p>}
              </div>
            ))}
            {invoice.allocationLines.map((line) => (
              <div key={line.id} className="border-b py-3">
                <div className="flex justify-between">
                  <span>
                    {line.itemNameSnapshot} · حصة {line.quantityNumerator}/
                    {line.quantityDenominator}
                  </span>
                  <b>{formatMinor(line.totalMinor)}</b>
                </div>
                {line.modifiers.map((modifier) => (
                  <div key={modifier.id} className="text-sm">
                    + {modifier.groupNameSnapshot}:{" "}
                    {modifier.optionNameSnapshot}
                  </div>
                ))}
              </div>
            ))}
          </section>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <ReportList
              title="توزيع الدفع"
              rows={invoice.payments.map((payment) => [
                payment.method === "CASH" ? "نقدي" : "Visa",
                formatMinor(payment.amountMinor),
              ])}
            />
            <ReportList
              title="سجل المرتجعات / الإلغاء"
              rows={[
                ...invoice.refunds.map(
                  (refund) =>
                    [
                      `مرتجع: ${refund.reason}`,
                      `${formatMinor(refund.amountMinor)} · ${new Date(refund.refundedAt).toLocaleString("ar")}`,
                    ] as [string, string],
                ),
                ...(invoice.void
                  ? [
                      [
                        `إلغاء: ${invoice.void.reason}`,
                        new Date(invoice.void.createdAt).toLocaleString("ar"),
                      ] as [string, string],
                    ]
                  : []),
              ]}
            />
            <ReportList
              title="الطباعة وإعادة الطباعة"
              rows={invoice.printEvents.map((event) => [
                event.type,
                new Date(event.createdAt).toLocaleString("ar"),
              ])}
            />
          </div>
          {can("pos:void") &&
            invoice.status === "OPEN" &&
            invoice.payments.length === 0 &&
            !invoice.splitGroupId && (
              <button
                disabled={busy}
                onClick={() => void voidInvoice()}
                className="mt-4 min-h-12 rounded-xl bg-rose-700 px-5 font-bold text-white disabled:opacity-50"
              >
                إلغاء الفاتورة غير المدفوعة
              </button>
            )}
          {can("pos:refund") &&
            ["PAID", "PARTIALLY_REFUNDED"].includes(invoice.status) &&
            remainingRefund > 0n && (
              <button
                disabled={busy}
                onClick={() => void refundInvoice()}
                className="mt-4 mr-2 min-h-12 rounded-xl bg-amber-500 px-5 font-bold disabled:opacity-50"
              >
                إنشاء مرتجع
              </button>
            )}
        </>
      )}
    </div>
  );
}

interface ReservationRow {
  id: string;
  customerName: string;
  phone: string;
  guestCount: number;
  startsAt: string;
  status: string;
  notes?: string | null;
  tables: { table: { code: string; displayName?: string | null } }[];
}
export function AdminReservationsPage() {
  const remote = useRemote<ReservationRow[]>("/admin/pos/reservations", []);
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">الحجوزات</h1>
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={
          !remote.loading && !remote.value.length
            ? "لا توجد حجوزات."
            : undefined
        }
      />
      <div className="space-y-2">
        {remote.value.map((row) => (
          <div key={row.id} className="rounded-xl bg-white p-4">
            <div className="flex justify-between">
              <b>{row.customerName}</b>
              <span>{row.status}</span>
            </div>
            <div>
              {new Intl.DateTimeFormat("ar", {
                timeZone: "Asia/Hebron",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(row.startsAt))}{" "}
              · {row.guestCount} أشخاص · <span dir="ltr">{row.phone}</span>
            </div>
            <div>
              الطاولات:{" "}
              {row.tables
                .map((link) => link.table.displayName || link.table.code)
                .join("، ") || "غير معينة"}
            </div>
            {row.notes && <p>ملاحظات: {row.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorNameSnapshot?: string | null;
  summary?: string | null;
  reason?: string | null;
  createdAt: string;
}
export function AdminAuditPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const remote = useRemote<AuditRow[]>(
    `/admin/pos/audit?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    [],
  );
  if (!can("pos:audit:read")) return <p>لا تملك صلاحية عرض التدقيق.</p>;
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">تدقيق POS</h1>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="بحث بالمستخدم أو الملخص أو المعرّف"
        className="mb-4 min-h-12 w-full rounded-xl border px-4"
      />
      <PageState
        loading={remote.loading}
        error={remote.error}
        empty={
          !remote.loading && !remote.value.length
            ? "لا توجد أحداث تدقيق POS."
            : undefined
        }
      />
      <div className="space-y-2">
        {remote.value.map((row) => (
          <div key={row.id} className="rounded-xl bg-white p-4">
            <div className="flex flex-wrap justify-between">
              <b>{row.action}</b>
              <span>{new Date(row.createdAt).toLocaleString("ar")}</span>
            </div>
            <div>
              {row.entityType} · {row.entityId || "—"} ·{" "}
              {row.actorNameSnapshot || "النظام"}
            </div>
            {(row.summary || row.reason) && (
              <p className="text-slate-600">{row.summary || row.reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
