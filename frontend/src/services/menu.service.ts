import { api, unwrap } from '@/lib/apiClient';
import type { Category, MenuItem, MenuItemDetail, Tag } from '@/types';

export interface ItemFilters {
  categoryId?: string;
  search?: string;
  featured?: boolean;
  bestSeller?: boolean;
  isNew?: boolean;
  vegetarian?: boolean;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'newest' | 'name';
  limit?: number;
}

export const menuService = {
  getCategories: () => unwrap<Category[]>(api.get('/categories')),
  getItems: (filters: ItemFilters = {}) =>
    unwrap<MenuItem[]>(api.get('/items', { params: filters })),
  getItemBySlug: (slug: string) => unwrap<MenuItemDetail>(api.get(`/items/${slug}`)),
  getTags: () => unwrap<Tag[]>(api.get('/tags')),
};
