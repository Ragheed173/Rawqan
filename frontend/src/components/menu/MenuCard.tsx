import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { LazyImage } from '@/components/shared/LazyImage';
import { ItemBadges } from './ItemBadges';
import { cn, discountPercent, formatPrice } from '@/lib/utils';
import type { MenuItem } from '@/types';

interface MenuCardProps {
  item: MenuItem;
  currency?: string;
  index?: number;
}

/** Premium menu item card — image zoom on hover, badges, price with discount. */
export function MenuCard({ item, currency = 'EGP', index = 0 }: MenuCardProps) {
  // Discounts only apply inside their scheduled promo window (Task 22).
  const effectiveDiscount = item.discountActive ? item.discountPrice : null;
  const off = discountPercent(item.price, effectiveDiscount);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-card',
        !item.isAvailable && 'opacity-70',
      )}
    >
      <Link to={`/menu/${item.slug}`} className="relative block aspect-[4/3] overflow-hidden">
        <LazyImage
          src={item.primaryImage?.url}
          alt={item.primaryImage?.alt ?? item.name}
          wrapperClassName="h-full w-full"
          zoom
        />
        <ItemBadges item={item} className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5" />
        {off && (
          <Badge variant="danger" className="absolute left-3 top-3 font-semibold">
            -{off}%
          </Badge>
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
            <Badge variant="muted">غير متوفر حالياً</Badge>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/menu/${item.slug}`} className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-foreground group-hover:text-accent">
              {item.name}
            </h3>
          </Link>
        </div>
        {item.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold text-foreground">
              {formatPrice(effectiveDiscount ?? item.price, currency)}
            </span>
            {off && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(item.price, currency)}
              </span>
            )}
          </div>
          {item.calories != null && (
            <span className="text-xs text-muted-foreground">{item.calories} سعرة</span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
