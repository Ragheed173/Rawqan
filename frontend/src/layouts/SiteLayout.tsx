import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { PageLoader } from '@/components/shared/PageLoader';
import { useSettings } from '@/hooks/useMenu';

const MaintenancePage = lazy(() => import('@/pages/MaintenancePage'));
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));

// Below-the-fold / non-critical shell pieces (perf): none of these are
// visible or interactive at first paint, and FloatingActions + InstallPrompt
// pull in framer-motion. Lazy-loading them (and analytics) keeps the initial
// bundle down to navbar + hero + CTA.
const Footer = lazy(() => import('@/components/layout/Footer').then((m) => ({ default: m.Footer })));
const FloatingActions = lazy(() =>
  import('@/components/layout/FloatingActions').then((m) => ({ default: m.FloatingActions })),
);
const InstallPrompt = lazy(() =>
  import('@/components/shared/InstallPrompt').then((m) => ({ default: m.InstallPrompt })),
);
const AnalyticsTracker = lazy(() =>
  import('@/components/shared/AnalyticsTracker').then((m) => ({ default: m.AnalyticsTracker })),
);

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
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
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
      <Suspense fallback={null}>
        <Footer />
        <FloatingActions />
        <InstallPrompt />
      </Suspense>
    </div>
  );
}
