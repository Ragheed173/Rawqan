import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { PageLoader } from '@/components/shared/PageLoader';

/**
 * Guards admin routes. On first mount attempts a silent session restore via the
 * refresh cookie; redirects to /admin/login when unauthenticated.
 */
export function ProtectedRoute() {
  const { status, restore } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (status === 'idle') void restore();
  }, [status, restore]);

  if (status === 'idle' || status === 'loading') return <PageLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
