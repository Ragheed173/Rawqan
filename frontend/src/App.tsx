import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { SiteLayout } from '@/layouts/SiteLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { ScrollToTop } from '@/components/shared/ScrollToTop';
import { PageLoader } from '@/components/shared/PageLoader';

// Route-level code splitting (Task 12: performance)
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const MenuPage = lazy(() => import('@/pages/MenuPage'));
const DishDetailPage = lazy(() => import('@/pages/DishDetailPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Admin (separate bundle)
const LoginPage = lazy(() => import('@/pages/admin/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const CategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'));
const MealsPage = lazy(() => import('@/pages/admin/MealsPage'));
const MealEditorPage = lazy(() => import('@/pages/admin/MealEditorPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));
const QrPage = lazy(() => import('@/pages/admin/QrPage'));
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
const AdminsPage = lazy(() => import('@/pages/admin/AdminsPage'));
const LogsPage = lazy(() => import('@/pages/admin/LogsPage'));
const DataPage = lazy(() => import('@/pages/admin/DataPage'));

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
