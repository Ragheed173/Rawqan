import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Permission } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  perm?: Permission;
  permAny?: Permission[];
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/admin/categories', label: 'الأقسام', icon: FolderTree },
  { to: '/admin/meals', label: 'الوجبات', icon: UtensilsCrossed },
  { to: '/admin/analytics', label: 'التحليلات', icon: BarChart3, perm: 'analytics:read' },
  { to: '/admin/qr', label: 'رمز QR', icon: QrCode },
  { to: '/admin/data', label: 'البيانات', icon: Database, permAny: ['import:manage', 'backup:manage'] },
  { to: '/admin/logs', label: 'السجل', icon: ScrollText, perm: 'logs:read' },
  { to: '/admin/admins', label: 'المستخدمون', icon: Users, perm: 'admin:manage' },
  { to: '/admin/settings', label: 'الإعدادات', icon: Settings, perm: 'settings:write' },
];

/** Admin shell: dark sidebar (collapsible on mobile) + content area. */
export function AdminLayout() {
  const { admin, logout } = useAuthStore();
  const { can, canAny } = usePermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = NAV.filter(
    (item) => (!item.perm || can(item.perm)) && (!item.permAny || canAny(...item.permAny)),
  );

  const handleLogout = async () => {
    await logout();
    toast.success('تم تسجيل الخروج');
    navigate('/admin/login');
  };

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <Logo className="text-xl text-white" />
        <span className="text-xs text-white/40">لوحة الإدارة</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-accent text-accent-foreground' : 'text-white/70 hover:bg-white/10 hover:text-white',
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
    <div className="min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col bg-ink text-white lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col bg-ink text-white">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:mr-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="فتح القائمة" className="grid h-10 w-10 place-items-center rounded-lg">
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
