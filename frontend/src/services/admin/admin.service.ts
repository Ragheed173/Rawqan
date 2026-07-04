import { api, unwrap } from '@/lib/apiClient';
import type {
  ActivityLogEntry,
  AdminUser,
  AnalyticsSummary,
  Category,
  DashboardStats,
  ItemImage,
  MenuItem,
  RestaurantSettings,
  Tag,
} from '@/types';

// ─── Categories ──────────────────────────────────────────────
export interface CategoryInput {
  name: string;
  nameEn?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
}

export const adminCategoryService = {
  list: () => unwrap<Category[]>(api.get('/admin/categories')),
  create: (data: CategoryInput) => unwrap<Category>(api.post('/admin/categories', data)),
  update: (id: string, data: Partial<CategoryInput>) =>
    unwrap<Category>(api.patch(`/admin/categories/${id}`, data)),
  remove: (id: string) => api.delete(`/admin/categories/${id}`),
  reorder: (order: { id: string; sortOrder: number }[]) =>
    unwrap<Category[]>(api.patch('/admin/categories/reorder', { order })),
};

// ─── Items / Meals ───────────────────────────────────────────
export interface ItemInput {
  categoryId: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  ingredients?: string | null;
  price: number;
  discountPrice?: number | null;
  calories?: number | null;
  allergens?: string | null;
  spiceLevel?: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT';
  isAvailable?: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  isVegetarian?: boolean;
  isChefRecommendation?: boolean;
  isArchived?: boolean;
  featuredFrom?: string | null;
  featuredUntil?: string | null;
  promoFrom?: string | null;
  promoUntil?: string | null;
  tagIds?: string[];
}

export const adminItemService = {
  list: (params?: { categoryId?: string; search?: string; archived?: boolean }) =>
    unwrap<MenuItem[]>(api.get('/admin/items', { params })),
  get: (id: string) => unwrap<MenuItem>(api.get(`/admin/items/${id}`)),
  create: (data: ItemInput) => unwrap<MenuItem>(api.post('/admin/items', data)),
  update: (id: string, data: Partial<ItemInput>) => unwrap<MenuItem>(api.patch(`/admin/items/${id}`, data)),
  remove: (id: string) => api.delete(`/admin/items/${id}`),
  duplicate: (id: string) => unwrap<MenuItem>(api.post(`/admin/items/${id}/duplicate`)),
};

// ─── Image uploads ───────────────────────────────────────────
export const adminUploadService = {
  /** Generic single upload → { url, publicId }. Used for logos/covers/category images. */
  uploadOne: (file: File, folder?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (folder) form.append('folder', folder);
    return unwrap<{ url: string; publicId: string }>(
      api.post('/admin/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  },
  uploadItemImages: (itemId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return unwrap<ItemImage[]>(
      api.post(`/admin/uploads/items/${itemId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
  deleteImage: (imageId: string) => api.delete(`/admin/uploads/images/${imageId}`),
  setPrimary: (imageId: string) => api.patch(`/admin/uploads/images/${imageId}/primary`),
};

// ─── Tags ────────────────────────────────────────────────────
export const adminTagService = {
  list: () => unwrap<Tag[]>(api.get('/admin/tags')),
  create: (data: { label: string; labelEn?: string | null; color?: string | null }) =>
    unwrap<Tag>(api.post('/admin/tags', data)),
  remove: (id: string) => api.delete(`/admin/tags/${id}`),
};

// ─── Settings ────────────────────────────────────────────────
export const adminSettingsService = {
  get: () => unwrap<RestaurantSettings>(api.get('/admin/settings')),
  update: (data: Record<string, unknown>) =>
    unwrap<RestaurantSettings>(api.patch('/admin/settings', data)),
  updateHours: (hours: RestaurantSettings['openingHours']) =>
    unwrap<RestaurantSettings>(api.patch('/admin/settings/hours', { hours })),
};

// ─── Dashboard ───────────────────────────────────────────────
export const adminDashboardService = {
  stats: () => unwrap<DashboardStats>(api.get('/admin/dashboard/stats')),
};

// ─── QR codes ────────────────────────────────────────────────
export interface QrParams {
  table?: string;
  size?: number;
}

export const adminQrService = {
  /** Authorized preview → base64 data URL (safe for <img src>). */
  preview: (params: QrParams) =>
    unwrap<{ target: string; dataUrl: string }>(
      api.get('/admin/qr', { params: { ...params, format: 'json' } }),
    ),
  /** Authorized file download as a Blob (png/svg/pdf). */
  download: async (format: 'png' | 'svg' | 'pdf', params: QrParams): Promise<Blob> => {
    const res = await api.get('/admin/qr', {
      params: { ...params, format },
      responseType: 'blob',
    });
    return res.data as Blob;
  },
};

// ─── Analytics ───────────────────────────────────────────────
export const adminAnalyticsService = {
  summary: (days = 30) => unwrap<AnalyticsSummary>(api.get('/admin/analytics', { params: { days } })),
};

// ─── Admin users (RBAC) ──────────────────────────────────────
export interface AdminInput {
  email: string;
  name: string;
  password: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';
}

export const adminUserService = {
  list: () => unwrap<AdminUser[]>(api.get('/admin/admins')),
  roles: () => unwrap<{ value: string; label: string }[]>(api.get('/admin/admins/roles')),
  create: (data: AdminInput) => unwrap<AdminUser>(api.post('/admin/admins', data)),
  update: (id: string, data: Partial<Omit<AdminInput, 'email'>> & { isActive?: boolean }) =>
    unwrap<AdminUser>(api.patch(`/admin/admins/${id}`, data)),
  remove: (id: string) => api.delete(`/admin/admins/${id}`),
};

// ─── Activity / audit logs ───────────────────────────────────
export interface LogsResponse {
  data: ActivityLogEntry[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export const adminLogsService = {
  list: async (params: { page?: number; action?: string; entityType?: string } = {}) => {
    const res = await api.get('/admin/logs', { params });
    return res.data as LogsResponse;
  },
};

// ─── Import / Export / Backup ────────────────────────────────
export interface ImportResult {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
}

export const adminDataService = {
  exportMenu: async (format: 'xlsx' | 'csv'): Promise<Blob> => {
    const res = await api.get('/admin/menu/export', { params: { format }, responseType: 'blob' });
    return res.data as Blob;
  },
  importMenu: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<ImportResult>(
      api.post('/admin/menu/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  },
  downloadBackup: async (): Promise<Blob> => {
    const res = await api.get('/admin/menu/backup', { responseType: 'blob' });
    return res.data as Blob;
  },
  restoreBackup: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<{ categories: number; items: number; images: number; tags: number }>(
      api.post('/admin/menu/backup/restore', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  },
};
