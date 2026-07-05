import { useQuery } from '@tanstack/react-query';
import {
  adminAnalyticsService,
  adminCategoryService,
  adminDashboardService,
  adminItemService,
  adminLogsService,
  adminSettingsService,
  adminTagService,
  adminUserService,
  type ItemListParams,
} from '@/services/admin/admin.service';

export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  categories: ['admin', 'categories'] as const,
  items: (params?: ItemListParams) => ['admin', 'items', params ?? {}] as const,
  item: (id: string) => ['admin', 'item', id] as const,
  tags: ['admin', 'tags'] as const,
  settings: ['admin', 'settings'] as const,
  analytics: (days: number) => ['admin', 'analytics', days] as const,
  admins: ['admin', 'admins'] as const,
  logs: (params: Record<string, unknown>) => ['admin', 'logs', params] as const,
};

export const useAnalytics = (days = 30) =>
  useQuery({ queryKey: adminKeys.analytics(days), queryFn: () => adminAnalyticsService.summary(days) });

export const useAdminUsers = () =>
  useQuery({ queryKey: adminKeys.admins, queryFn: adminUserService.list });

export const useAdminLogs = (params: { page?: number; action?: string; entityType?: string }) =>
  useQuery({ queryKey: adminKeys.logs(params), queryFn: () => adminLogsService.list(params) });

export const useDashboardStats = () =>
  useQuery({ queryKey: adminKeys.dashboard, queryFn: adminDashboardService.stats });

export const useAdminCategories = () =>
  useQuery({ queryKey: adminKeys.categories, queryFn: adminCategoryService.list });

export const useAdminItems = (params?: ItemListParams) =>
  useQuery({
    queryKey: adminKeys.items(params),
    queryFn: () => adminItemService.list(params),
    placeholderData: (prev) => prev, // keep previous page while fetching the next
  });

export const useAdminTags = () =>
  useQuery({ queryKey: adminKeys.tags, queryFn: adminTagService.list });

export const useAdminSettings = () =>
  useQuery({ queryKey: adminKeys.settings, queryFn: adminSettingsService.get });
