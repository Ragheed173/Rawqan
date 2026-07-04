import { useQuery } from '@tanstack/react-query';
import { menuService, type ItemFilters } from '@/services/menu.service';
import { settingsService } from '@/services/settings.service';

export const queryKeys = {
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  items: (filters: ItemFilters) => ['items', filters] as const,
  item: (slug: string) => ['item', slug] as const,
  tags: ['tags'] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsService.get,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: menuService.getCategories,
    staleTime: 60 * 1000,
  });
}

export function useItems(filters: ItemFilters = {}) {
  return useQuery({
    queryKey: queryKeys.items(filters),
    queryFn: () => menuService.getItems(filters),
    staleTime: 60 * 1000,
  });
}

export function useItem(slug: string) {
  return useQuery({
    queryKey: queryKeys.item(slug),
    queryFn: () => menuService.getItemBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: menuService.getTags, staleTime: 5 * 60 * 1000 });
}
