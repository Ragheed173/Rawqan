import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FloatingActions } from '@/components/layout/FloatingActions';
import { InstallPrompt } from '@/components/shared/InstallPrompt';
import { AnalyticsTracker } from '@/components/shared/AnalyticsTracker';
import { PageLoader } from '@/components/shared/PageLoader';
import { useSettings } from '@/hooks/useMenu';

const MaintenancePage = lazy(() => import('@/pages/MaintenancePage'));
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));

/** Public site shell: sticky nav, page outlet, footer, floating actions. */
export function SiteLayout() {
  const { data: settings, isLoading } = useSettings();

  // Site-wide modes take over the whole public surface (Task 22).
  if (!isLoading && settings?.comingSoonMode) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ComingSoonPage />
      </Suspense>
    );
  }
  if (!isLoading && settings?.maintenanceMode) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MaintenancePage />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AnalyticsTracker />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        تخطَّ إلى المحتوى
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <FloatingActions />
      <InstallPrompt />
    </div>
  );
}
