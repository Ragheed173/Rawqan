import { Suspense, lazy } from 'react';
import { Seo } from '@/components/shared/Seo';
import { Hero } from '@/components/landing/Hero';
import { LazyMount } from '@/components/shared/LazyMount';
import { useSettings } from '@/hooks/useMenu';
import { config } from '@/config/env';

// Below-the-fold sections (perf): the hero fills 100svh, so these are never
// visible at first paint. React.lazy alone still fires its import() during
// the initial render, so the chunks (and motion-vendor) download inside the
// Lighthouse trace — LazyMount defers mounting until scroll intent, so the
// initial route downloads none of it.
const FeaturedDishes = lazy(() =>
  import('@/components/landing/FeaturedDishes').then((m) => ({ default: m.FeaturedDishes })),
);
const InfoSection = lazy(() =>
  import('@/components/landing/InfoSection').then((m) => ({ default: m.InfoSection })),
);

export default function LandingPage() {
  const { data: settings } = useSettings();

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
      <Hero settings={settings} />
      <LazyMount placeholderId="featured" minHeight={720}>
        <Suspense fallback={<div style={{ minHeight: 720 }} aria-hidden="true" />}>
          <FeaturedDishes currency={settings?.currency} />
        </Suspense>
      </LazyMount>
      <LazyMount minHeight={520}>
        <Suspense fallback={<div style={{ minHeight: 520 }} aria-hidden="true" />}>
          <InfoSection settings={settings} />
        </Suspense>
      </LazyMount>
    </>
  );
}
