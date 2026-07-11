import { Suspense, lazy } from 'react';
import { Seo } from '@/components/shared/Seo';
import { Hero } from '@/components/landing/Hero';
import { useSettings } from '@/hooks/useMenu';
import { config } from '@/config/env';

// Below-the-fold sections (perf): the hero fills 100svh, so these are never
// visible at first paint. Lazy-loading them keeps framer-motion (used by
// MenuCard/SectionHeading/InfoSection) out of the initial bundle entirely.
const FeaturedDishes = lazy(() =>
  import('@/components/landing/FeaturedDishes').then((m) => ({ default: m.FeaturedDishes })),
);
const InfoSection = lazy(() =>
  import('@/components/landing/InfoSection').then((m) => ({ default: m.InfoSection })),
);

export default function LandingPage() {
  const { data: settings, isPending } = useSettings();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: settings?.name ?? 'روقان',
    image: settings?.coverUrl ?? undefined,
    description: settings?.description ?? undefined,
    servesCuisine: 'Middle Eastern',
    telephone: settings?.phone ?? undefined,
    url: config.siteUrl,
    address: settings?.addressLine
      ? { '@type': 'PostalAddress', streetAddress: settings.addressLine }
      : undefined,
    priceRange: '$$',
  };

  return (
    <>
      <Seo
        title="الرئيسية"
        description={settings?.description ?? undefined}
        image={settings?.coverUrl}
        type="restaurant.menu"
        jsonLd={jsonLd}
      />
      <Hero settings={settings} settingsPending={isPending} />
      <Suspense fallback={null}>
        <FeaturedDishes currency={settings?.currency} />
        <InfoSection settings={settings} />
      </Suspense>
    </>
  );
}
