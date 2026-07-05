/** Shared domain types — mirror the backend serializers. */

export type SpiceLevel = 'NONE' | 'MILD' | 'MEDIUM' | 'HOT';

export type Weekday =
  | 'SUNDAY'
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY';

export interface ItemImage {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Tag {
  id: string;
  slug: string;
  label: string;
  labelEn: string | null;
  color: string | null;
}

export interface MenuItem {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  ingredients: string | null;
  price: number;
  discountPrice: number | null;
  discountActive: boolean;
  calories: number | null;
  allergens: string | null;
  spiceLevel: SpiceLevel;
  isAvailable: boolean;
  isArchived: boolean;
  isFeatured: boolean;
  featuredActive: boolean;
  featuredFrom: string | null;
  featuredUntil: string | null;
  promoFrom: string | null;
  promoUntil: string | null;
  viewCount: number;
  isBestSeller: boolean;
  isNew: boolean;
  isVegetarian: boolean;
  isChefRecommendation: boolean;
  sortOrder: number;
  primaryImage: ItemImage | null;
  images: ItemImage[];
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemDetail extends MenuItem {
  related: MenuItem[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
  items?: MenuItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OpeningHour {
  weekday: Weekday;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface RestaurantSettings {
  id: string;
  name: string;
  nameEn: string | null;
  tagline: string | null;
  taglineEn: string | null;
  description: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  coverUrl: string | null;
  coverPublicId: string | null;
  phone: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  googleMapsUrl: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  currency: string;
  footerText: string | null;
  theme: { primary: string | null; accent: string | null; background: string | null };
  isOpen: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  comingSoonMode: boolean;
  openingHours: OpeningHour[];
  updatedAt: string;
}

export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';

export type Permission =
  | 'menu:read'
  | 'menu:write'
  | 'menu:delete'
  | 'category:write'
  | 'category:delete'
  | 'settings:write'
  | 'analytics:read'
  | 'logs:read'
  | 'import:manage'
  | 'admin:manage'
  | 'backup:manage';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  roleLabel: string;
  permissions: Permission[];
  lastLoginAt: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  roleLabel: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  range: { days: number; since: string };
  totals: { views: number; visitors: number; visitorsToday: number; qrScans: number };
  dailyVisitors: { date: string; visitors: number }[];
  mostViewedItems: { id: string; name: string; viewCount: number; price: number; category: string }[];
  popularCategories: { categoryId: string | null; name: string; views: number }[];
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  admin: string;
  adminEmail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totals: {
    categories: number;
    activeCategories: number;
    meals: number;
    availableMeals: number;
    featured: number;
  };
  recentMeals: MenuItem[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    summary: string | null;
    admin: string;
    createdAt: string;
  }[];
}
