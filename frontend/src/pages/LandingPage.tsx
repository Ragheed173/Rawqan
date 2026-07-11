import { Seo } from '@/components/shared/Seo';
import { Hero } from '@/components/landing/Hero';
import { FeaturedDishes } from '@/components/landing/FeaturedDishes';
import { InfoSection } from '@/components/landing/InfoSection';
import { useSettings } from '@/hooks/useMenu';
import { config } from '@/config/env';

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
      <FeaturedDishes currency={settings?.currency} />
      <InfoSection settings={settings} />
    </>
  );
}
