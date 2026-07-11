import { motion } from 'framer-motion';
import { Instagram, Facebook } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Seo } from '@/components/shared/Seo';
import { WhatsAppIcon } from '@/components/layout/FloatingActions';
import { useSettings } from '@/hooks/useMenu';
import { whatsappHref } from '@/lib/contact';
import { HERO_IMAGE_WIDTHS, imageSrcSet, optimizedImageUrl } from '@/lib/images';

const FALLBACK =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=80';

/** Elegant "coming soon" splash for pre-launch (Task 22). */
export default function ComingSoonPage() {
  const { data: settings } = useSettings();
  const socials = [
    { href: settings?.instagram, icon: Instagram, label: 'إنستغرام' },
    { href: settings?.facebook, icon: Facebook, label: 'فيسبوك' },
    { href: whatsappHref(settings?.whatsapp), icon: WhatsAppIcon, label: 'واتساب' },
  ].filter((s) => s.href);

  return (
    <>
      <Seo title="قريباً" />
      <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 text-center text-white">
        <div className="absolute inset-0 -z-10">
          <img
            src={optimizedImageUrl(settings?.coverUrl ?? FALLBACK, 1280)}
            srcSet={imageSrcSet(settings?.coverUrl ?? FALLBACK, HERO_IMAGE_WIDTHS)}
            sizes="100vw"
            alt=""
            width={1280}
            height={853}
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-widest backdrop-blur">
            قريباً
          </span>
          <div>
            <Logo name={settings?.name} logoUrl={settings?.logoUrl} className="text-5xl text-white md:text-7xl" />
          </div>
          <p className="mx-auto mt-5 max-w-xl text-lg font-light text-white/85">
            {settings?.tagline ?? 'تجربة طعام فاخرة في أجواء استثنائية — نستعد لاستقبالكم قريباً.'}
          </p>
          {socials.length > 0 && (
            <div className="mt-8 flex justify-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <s.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
