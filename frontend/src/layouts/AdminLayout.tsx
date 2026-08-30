import { useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  FolderTree,
  UtensilsCrossed,
  Settings,
  QrCode,
  LogOut,
  Menu,
  X,
  ExternalLink,
  BarChart3,
  Database,
  ScrollText,
  Users,
  MonitorSmartphone,
  ShoppingCart,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AdminRole, Permission } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  perm?: Permission;
  permAny?: Permission[];
}

const NAV: NavItem[] = [
  { to: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, end: true, perm: "menu:read" },
  { to: "/admin/categories", label: "الأقسام", icon: FolderTree, perm: "menu:read" },
  { to: "/admin/meals", label: "الوجبات", icon: UtensilsCrossed, perm: "menu:read" },
  {
    to: "/admin/analytics",
    label: "التحليلات",
    icon: BarChart3,
    perm: "analytics:read",
  },
  { to: "/admin/qr", label: "رمز QR", icon: QrCode, perm: "menu:read" },
  {
    to: "/admin/data",
    label: "البيانات",
    icon: Database,
    permAny: ["import:manage", "backup:manage"],
  },
  { to: "/admin/logs", label: "السجل", icon: ScrollText, perm: "logs:read" },
  {
    to: "/admin/admins",
    label: "المستخدمون",
    icon: Users,
    perm: "admin:manage",
  },
  {
    to: "/admin/pos",
    label: "نقاط البيع",
    icon: MonitorSmartphone,
    permAny: ["pos:table:configure", "pos:reports:read", "pos:device:manage"],
  },
  {
    to: "/admin/settings",
    label: "الإعدادات",
    icon: Settings,
    perm: "settings:write",
  },
];

const ADMIN_ROUTE_RULES: Array<{
  matches: (pathname: string) => boolean;
  anyOf: Permission[];
}> = [
  { matches: (path) => path === "/admin", anyOf: ["menu:read"] },
  { matches: (path) => path.startsWith("/admin/categories"), anyOf: ["menu:read"] },
  { matches: (path) => path.startsWith("/admin/meals"), anyOf: ["menu:read"] },
  { matches: (path) => path.startsWith("/admin/analytics"), anyOf: ["analytics:read"] },
  { matches: (path) => path.startsWith("/admin/qr"), anyOf: ["menu:read"] },
  { matches: (path) => path.startsWith("/admin/data"), anyOf: ["import:manage", "backup:manage"] },
  { matches: (path) => path.startsWith("/admin/logs"), anyOf: ["logs:read"] },
  { matches: (path) => path.startsWith("/admin/admins"), anyOf: ["admin:manage"] },
  { matches: (path) => path === "/admin/pos", anyOf: ["pos:table:configure", "pos:reports:read", "pos:device:manage", "pos:audit:read"] },
  { matches: (path) => path.startsWith("/admin/pos/tables"), anyOf: ["pos:table:configure"] },
  { matches: (path) => path.startsWith("/admin/pos/reports"), anyOf: ["pos:reports:read"] },
  { matches: (path) => path.startsWith("/admin/pos/devices"), anyOf: ["pos:device:manage"] },
  { matches: (path) => path.startsWith("/admin/pos/audit"), anyOf: ["pos:audit:read"] },
  { matches: (path) => path.startsWith("/admin/pos/invoices"), anyOf: ["pos:reports:read"] },
  { matches: (path) => path.startsWith("/admin/pos/reservations"), anyOf: ["pos:reservation:manage"] },
  { matches: (path) => path.startsWith("/admin/settings"), anyOf: ["settings:write"] },
];

export function canAccessAdminPath(
  pathname: string,
  permissions: readonly Permission[],
  role?: AdminRole,
) {
  if (role === "CASHIER") return false;
  const rule = ADMIN_ROUTE_RULES.find(({ matches }) => matches(pathname));
  return !!rule && rule.anyOf.some((permission) => permissions.includes(permission));
}

/** Admin shell: dark sidebar (collapsible on mobile) + content area. */
export function AdminLayout() {
  const { admin, logout } = useAuthStore();
  const { role, permissions, can, canAny } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const isPosAdmin =
    location.pathname === "/admin/pos" ||
    location.pathname.startsWith("/admin/pos/");
  const [open, setOpen] = useState(false);

  if (!canAccessAdminPath(location.pathname, permissions, role)) {
    return <Navigate to={can("pos:operate") ? "/pos" : "/admin/login"} replace />;
  }

  const nav = NAV.filter(
    (item) =>
      (!item.perm || can(item.perm)) &&
      (!item.permAny || canAny(...item.permAny)),
  );

  const handleLogout = async () => {
    await logout();
    toast.success("تم تسجيل الخروج");
    navigate("/admin/login");
  };

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <Logo className="text-xl text-white" />
        <span className="text-xs text-white/40">لوحة الإدارة</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {can("pos:operate") && (
          <Link
            to="/pos"
            onClick={() => setOpen(false)}
            className="mb-3 flex items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
          >
            <ShoppingCart className="h-5 w-5" /> فتح نقطة البيع POS
          </Link>
        )}
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <Link
          to="/"
          target="_blank"
          className="mb-2 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="h-5 w-5" /> عرض الموقع
        </Link>
        <div className="mb-2 px-4 text-xs text-white/40">{admin?.name}</div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="h-5 w-5" /> تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "min-h-screen",
        isPosAdmin ? "pos-theme pos-admin-shell" : "bg-muted/40",
      )}
    >
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col bg-ink text-white lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col bg-ink text-white">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:mr-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            className="grid h-10 w-10 place-items-center rounded-lg"
          >
            <Menu />
          </button>
          <Logo className="text-lg" />
          <div className="w-10" />
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* close btn floating on mobile drawer */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed left-4 top-4 z-[60] grid h-10 w-10 place-items-center rounded-full bg-white text-ink lg:hidden"
          aria-label="إغلاق"
        >
          <X />
        </button>
      )}
    </div>
  );
}
