import { Flame, Leaf, Sparkles, Star, ChefHat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MenuItem } from '@/types';

/** Derives the premium flag badges shown on cards and detail pages. */
export function ItemBadges({ item, className }: { item: MenuItem; className?: string }) {
  const badges: { key: string; label: string; icon: typeof Star; variant: 'gold' | 'default' | 'success' | 'danger' }[] = [];

  if (item.isBestSeller) badges.push({ key: 'best', label: 'الأكثر مبيعاً', icon: Star, variant: 'gold' });
  if (item.isChefRecommendation)
    badges.push({ key: 'chef', label: 'اختيار الشيف', icon: ChefHat, variant: 'default' });
  if (item.isNew) badges.push({ key: 'new', label: 'جديد', icon: Sparkles, variant: 'default' });
  if (item.isVegetarian) badges.push({ key: 'veg', label: 'نباتي', icon: Leaf, variant: 'success' });
  if (item.spiceLevel === 'HOT') badges.push({ key: 'hot', label: 'حار', icon: Flame, variant: 'danger' });

  if (!badges.length) return null;

  return (
    <div className={className}>
      {badges.map((b) => (
        <Badge key={b.key} variant={b.variant} className="gap-1 shadow-soft">
          <b.icon className="h-3 w-3" />
          {b.label}
        </Badge>
      ))}
    </div>
  );
}
