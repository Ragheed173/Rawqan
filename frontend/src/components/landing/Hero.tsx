import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ChevronDown, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { HERO_IMAGE_WIDTHS, imageSrcSet, optimizedImageUrl } from '@/lib/images';
import type { RestaurantSettings } from '@/types';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=80';

interface HeroProps {
  settings?: RestaurantSettings;
  /** True while settings are still loading — delays the cover so we never
   *  download the fallback image only to swap it for the real cover (LCP). */
  settingsPending?: boolean;
}

/** Full-bleed parallax hero with overlay, logo, name, tagline, CTAs, scroll cue. */
export function Hero({ settings, settingsPending = false }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const cover = settings?.coverUrl ?? FALLBACK_COVER;

  return (
    <section ref={ref} className="relative flex h-[100svh] min-h-[600px] items-center justify-center overflow-hidden">
      {/* Parallax background */}
      <motion.div style={{ y }} className="absolute inset-0 -z-10 bg-neutral-900">
        {!settingsPending && (
          <img
            src={optimizedImageUrl(cover, 1280)}
            srcSet={imageSrcSet(cover, HERO_IMAGE_WIDTHS)}
            sizes="100vw"
            alt=""
            width={1280}
            height={853}
            className="h-[120%] w-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      </motion.div>

      {/* Content */}
      <motion.div style={{ opacity }} className="container flex flex-col items-center text-center text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {settings?.isOpen != null && (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${settings.isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {settings.isOpen ? 'مفتوح الآن' : 'مغلق حالياً'}
            </span>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <Logo name={settings?.name} logoUrl={settings?.logoUrl} className="text-5xl text-white md:text-7xl" imgClassName="h-24 md:h-32 mx-auto" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-5 max-w-2xl text-balance text-lg font-light text-white/85 md:text-2xl"
        >
          {settings?.tagline ?? 'تجربة طعام فاخرة في أجواء استثنائية'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button asChild variant="gold" size="lg" className="min-w-[200px]">
            <Link to="/menu">تصفّح القائمة</Link>
          </Button>
          <div className="flex items-center gap-5 text-sm text-white/80">
            {settings?.addressLine && (
              <span className="hidden items-center gap-1.5 sm:flex">
                <MapPin className="h-4 w-4 text-accent" /> {settings.addressLine.split('،')[0]}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-accent" />
              {settings?.isOpen ? 'نستقبلكم الآن' : 'تحقق من ساعات العمل'}
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.a
        href="#featured"
        aria-label="مرّر للأسفل"
        style={{ opacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <ChevronDown className="h-7 w-7" />
      </motion.a>
    </section>
  );
}
