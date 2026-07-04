import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, Leaf, ShoppingBag, Sparkles } from 'lucide-react';
import { Seo } from '@/components/shared/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImageGallery } from '@/components/menu/ImageGallery';
import { ItemBadges } from '@/components/menu/ItemBadges';
import { MenuCard } from '@/components/menu/MenuCard';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { useItem, useSettings } from '@/hooks/useMenu';
import { discountPercent, formatPrice } from '@/lib/utils';
import { whatsappHref } from '@/lib/contact';

const SPICE_LABEL: Record<string, string> = { MILD: 'خفيف', MEDIUM: 'متوسط', HOT: 'حار' };

/** Reusable labeled fact row (ingredients, allergens, calories…). */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

export default function DishDetailPage() {
  const { slug = '' } = useParams();
  const { data: settings } = useSettings();
  const { data: item, isLoading, isError } = useItem(slug);
  const currency = settings?.currency ?? 'EGP';

  if (isLoading) {
    return (
      <div className="container grid gap-10 pb-24 pt-28 md:grid-cols-2 md:pt-36">
        <Skeleton className="aspect-square rounded-3xl md:aspect-[4/3]" />
        <div className="space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-12 w-40" />
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="pt-28 md:pt-36">
        <EmptyState
          title="الطبق غير موجود"
          description="قد يكون هذا الطبق غير متوفر حالياً."
          action={
            <Button asChild variant="gold">
              <Link to="/menu">العودة للقائمة</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const effectiveDiscount = item.discountActive ? item.discountPrice : null;
  const off = discountPercent(item.price, effectiveDiscount);
  const wa = whatsappHref(settings?.whatsapp, `مرحباً، أود الاستفسار عن: ${item.name}`);
  const allergens = item.allergens?.split(/[,،]/).map((a) => a.trim()).filter(Boolean) ?? [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: item.name,
    description: item.description ?? undefined,
    image: item.primaryImage?.url ?? undefined,
    offers: {
      '@type': 'Offer',
      price: effectiveDiscount ?? item.price,
      priceCurrency: currency,
      availability: item.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <Seo
        title={item.name}
        description={item.description ?? undefined}
        image={item.primaryImage?.url}
        path={`/menu/${item.slug}`}
        type="product"
        jsonLd={jsonLd}
      />

      <div className="container pb-20 pt-24 md:pt-32">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" aria-label="مسار التنقل">
          <Link to="/menu" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> القائمة
          </Link>
          <span>/</span>
          <span className="text-foreground">{item.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <ImageGallery images={item.images} name={item.name} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col"
          >
            <ItemBadges item={item} className="mb-3 flex flex-wrap gap-2" />
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">{item.name}</h1>
            {item.nameEn && <p className="mt-1 font-latin text-muted-foreground">{item.nameEn}</p>}

            {item.description && (
              <p className="mt-4 leading-relaxed text-foreground/80">{item.description}</p>
            )}

            {/* Price */}
            <div className="mt-6 flex items-center gap-3">
              <span className="font-display text-3xl font-bold text-foreground">
                {formatPrice(effectiveDiscount ?? item.price, currency)}
              </span>
              {off && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(item.price, currency)}
                  </span>
                  <Badge variant="danger">-{off}%</Badge>
                </>
              )}
            </div>

            {/* Quick flags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.spiceLevel !== 'NONE' && (
                <Badge variant="muted" className="gap-1">
                  <Flame className="h-3 w-3 text-destructive" /> {SPICE_LABEL[item.spiceLevel]}
                </Badge>
              )}
              {item.isVegetarian && (
                <Badge variant="success" className="gap-1">
                  <Leaf className="h-3 w-3" /> نباتي
                </Badge>
              )}
              {item.isNew && (
                <Badge className="gap-1">
                  <Sparkles className="h-3 w-3" /> جديد
                </Badge>
              )}
              {item.tags.map((t) => (
                <Badge key={t.id} variant="outline">
                  {t.label}
                </Badge>
              ))}
            </div>

            {/* Facts */}
            <dl className="mt-6 rounded-2xl border border-border bg-card p-5">
              {item.ingredients && <Fact label="المكونات">{item.ingredients}</Fact>}
              {item.calories != null && <Fact label="السعرات الحرارية">{item.calories} سعرة</Fact>}
              {allergens.length > 0 && (
                <Fact label="مسببات الحساسية">
                  <div className="flex flex-wrap gap-1.5">
                    {allergens.map((a) => (
                      <Badge key={a} variant="danger">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </Fact>
              )}
              <Fact label="التوفر">
                {item.isAvailable ? (
                  <span className="text-emerald-600">متوفر الآن</span>
                ) : (
                  <span className="text-destructive">غير متوفر حالياً</span>
                )}
              </Fact>
            </dl>

            {/* CTA */}
            {wa && (
              <Button asChild variant="gold" size="lg" className="mt-6 w-full sm:w-fit" disabled={!item.isAvailable}>
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <ShoppingBag className="h-5 w-5" /> اطلب عبر واتساب
                </a>
              </Button>
            )}
          </motion.div>
        </div>

        {/* Related */}
        {item.related.length > 0 && (
          <div className="mt-20">
            <SectionHeading align="start" title="قد يعجبك أيضاً" className="mb-6" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {item.related.map((r, i) => (
                <MenuCard key={r.id} item={r} currency={currency} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
