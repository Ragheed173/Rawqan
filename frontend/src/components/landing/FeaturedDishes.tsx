import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MenuCard } from '@/components/menu/MenuCard';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useItems } from '@/hooks/useMenu';

/** "Featured Dish Preview" strip on the landing page (Task 1 / Task 18). */
export function FeaturedDishes({ currency = 'EGP' }: { currency?: string }) {
  const { data: items, isLoading } = useItems({ featured: true, limit: 6, sort: 'popular' });

  return (
    <section id="featured" className="container scroll-mt-24 py-20 md:py-28">
      <SectionHeading
        eyebrow="أطباقنا المميزة"
        title="نكهات تستحق التجربة"
        subtitle="مختارات من أشهى أطباقنا التي يعشقها ضيوفنا"
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            ))
          : items?.map((item, i) => <MenuCard key={item.id} item={item} currency={currency} index={i} />)}
      </div>

      {!isLoading && items && items.length > 0 && (
        <div className="mt-12 text-center">
          <Button asChild variant="outline" size="lg">
            <Link to="/menu">
              عرض القائمة كاملة <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
