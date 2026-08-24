import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "@/layouts/SiteLayout";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { PageLoader } from "@/components/shared/PageLoader";

// Admin shell is never needed on the public route — keep it out of the entry.
const AdminLayout = lazy(() =>
  import("@/layouts/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const ProtectedRoute = lazy(() =>
  import("@/components/admin/ProtectedRoute").then((m) => ({
    default: m.ProtectedRoute,
  })),
);

// Route-level code splitting (Task 12: performance)
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const MenuPage = lazy(() => import("@/pages/MenuPage"));
const DishDetailPage = lazy(() => import("@/pages/DishDetailPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

// Admin (separate bundle)
const LoginPage = lazy(() => import("@/pages/admin/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const CategoriesPage = lazy(() => import("@/pages/admin/CategoriesPage"));
const MealsPage = lazy(() => import("@/pages/admin/MealsPage"));
const MealEditorPage = lazy(() => import("@/pages/admin/MealEditorPage"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/AdminSettingsPage"));
const QrPage = lazy(() => import("@/pages/admin/QrPage"));
const AnalyticsPage = lazy(() => import("@/pages/admin/AnalyticsPage"));
const AdminsPage = lazy(() => import("@/pages/admin/AdminsPage"));
const LogsPage = lazy(() => import("@/pages/admin/LogsPage"));
const DataPage = lazy(() => import("@/pages/admin/DataPage"));
const PosLayout = lazy(() =>
  import("@/pos/components/PosLayout").then((m) => ({ default: m.PosLayout })),
);
const PosProtectedRoute = lazy(() =>
  import("@/pos/auth/PosProtectedRoute").then((m) => ({
    default: m.PosProtectedRoute,
  })),
);
const PosDashboardPage = lazy(() => import("@/pos/pages/DashboardPage"));
const PosOrderPage = lazy(() => import("@/pos/pages/OrderPage"));
const PosCheckoutPage = lazy(() => import("@/pos/pages/CheckoutPage"));
const SplitPage = lazy(() =>
  import("@/pos/pages/OperationsPages").then((m) => ({ default: m.SplitPage })),
);
const ReservationsPage = lazy(() =>
  import("@/pos/pages/OperationsPages").then((m) => ({
    default: m.ReservationsPage,
  })),
);
const ShiftsPage = lazy(() =>
  import("@/pos/pages/OperationsPages").then((m) => ({
    default: m.ShiftsPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("@/pos/pages/OperationsPages").then((m) => ({
    default: m.InvoicesPage,
  })),
);
const InvoiceDetailPage = lazy(() =>
  import("@/pos/pages/OperationsPages").then((m) => ({
    default: m.InvoiceDetailPage,
  })),
);
const AdminPosHome = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminPosHome,
  })),
);
const AdminPosTables = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminTablesPage,
  })),
);
const AdminPosReports = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminReportsPage,
  })),
);
const AdminPosDevices = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminDevicesPage,
  })),
);
const AdminPosAudit = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminAuditPage,
  })),
);
const AdminPosInvoices = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminInvoicesPage,
  })),
);
const AdminPosInvoiceDetail = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminInvoiceDetailPage,
  })),
);
const AdminPosReservations = lazy(() =>
  import("@/pos/pages/AdminPosPages").then((m) => ({
    default: m.AdminReservationsPage,
  })),
);
const PosDiagnostics = lazy(() => import("@/pos/pages/DiagnosticsPage"));

export function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="menu/:slug" element={<DishDetailPage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="meals" element={<MealsPage />} />
              <Route path="meals/new" element={<MealEditorPage />} />
              <Route path="meals/:id" element={<MealEditorPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="qr" element={<QrPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="data" element={<DataPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route path="pos" element={<AdminPosHome />} />
              <Route path="pos/tables" element={<AdminPosTables />} />
              <Route path="pos/reports" element={<AdminPosReports />} />
              <Route path="pos/devices" element={<AdminPosDevices />} />
              <Route path="pos/audit" element={<AdminPosAudit />} />
              <Route path="pos/invoices" element={<AdminPosInvoices />} />
              <Route
                path="pos/invoices/:id"
                element={<AdminPosInvoiceDetail />}
              />
              <Route
                path="pos/reservations"
                element={<AdminPosReservations />}
              />
            </Route>
          </Route>

          <Route path="/pos" element={<PosProtectedRoute />}>
            <Route element={<PosLayout />}>
              <Route index element={<PosDashboardPage />} />
              <Route path="table/:id" element={<PosOrderPage />} />
              <Route path="checkout/:orderId" element={<PosCheckoutPage />} />
              <Route path="split/:orderId" element={<SplitPage />} />
              <Route path="reservations" element={<ReservationsPage />} />
              <Route path="shifts" element={<ShiftsPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="diagnostics" element={<PosDiagnostics />} />
            </Route>
          </Route>

          <Route element={<SiteLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
