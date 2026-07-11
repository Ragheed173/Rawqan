import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ChevronDown, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { HERO_IMAGE_WIDTHS, imageSrcSet, optimizedImageUrl } from '@/lib/images';
import type { RestaurantSettings } from '@/types';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=80';

/** Last cover delivered by the API, so repeat visits paint the right image
 *  instantly instead of waiting ~1 RTT for /api/settings (LCP render delay). */
const COVER_CACHE_KEY = 'rawaqan:cover';

function cachedCover(): string | null {
  try {
    return localStorage.getItem(COVER_CACHE_KEY);
  } catch {
    return null;
  }
}

interface HeroProps {
  settings?: RestaurantSettings;
}

/**
 * Full-bleed parallax hero with overlay, logo, name, tagline, CTAs, scroll cue.
 *
 * Perf (LCP): no framer-motion here. Entrance animations are pure CSS
 * (transform/opacity keyframes) and the scroll parallax is a passive
 * rAF-throttled listener that only WRITES `transform`/`opacity`. Nothing reads
 * element geometry (offsetWidth/clientHeight/getBoundingClientRect), so first
 * paint never forces a synchronous layout.
 */
export function Hero({ settings }: HeroProps) {
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Hero height is 100svh with a 600px floor — mirror that without touching
    // element geometry (window.innerHeight never forces document layout).
    let heroH = Math.max(window.innerHeight, 600);
    let raf = 0;

    const update = () => {
      raf = 0;
      const progress = Math.min(Math.max(window.scrollY / heroH, 0), 1);
      const fade = String(Math.max(1 - progress / 0.8, 0));
      if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${progress * 30}%, 0)`;
      if (contentRef.current) contentRef.current.style.opacity = fade;
      if (cueRef.current) cueRef.current.style.opacity = fade;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      heroH = Math.max(window.innerHeight, 600);
      onScroll();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Render the image IMMEDIATELY — never gate the LCP element on the settings
  // request. Cached cover (repeat visits) or the static fallback paints at
  // once; the real cover simply replaces it when settings arrive.
  const cover = settings?.coverUrl ?? cachedCover() ?? FALLBACK_COVER;

  useEffect(() => {
    if (!settings?.coverUrl) return;
    try {
      localStorage.setItem(COVER_CACHE_KEY, settings.coverUrl);
    } catch {
      /* storage unavailable — harmless */
    }
  }, [settings?.coverUrl]);

  return (
    <section className="relative flex h-[100svh] min-h-[600px] items-center justify-center overflow-hidden">
      {/* Parallax background (transform-only, driven by the rAF listener) */}
      <div ref={bgRef} className="absolute inset-0 -z-10 bg-neutral-900 will-change-transform">
        <img
          src={optimizedImageUrl(cover, 1280, 'hero')}
          srcSet={imageSrcSet(cover, HERO_IMAGE_WIDTHS, 'hero')}
          sizes="100vw"
          alt=""
          width={1280}
          height={853}
          className="h-[120%] w-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      </div>

      {/* Content */}
      <div ref={contentRef} className="container flex flex-col items-center text-center text-white">
        <div className="animate-scale-in">
          {settings?.isOpen != null && (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${settings.isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {settings.isOpen ? 'مفتوح الآن' : 'مغلق حالياً'}
            </span>
          )}
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <Logo name={settings?.name} logoUrl={settings?.logoUrl} className="text-5xl text-white md:text-7xl" imgClassName="h-24 md:h-32 mx-auto" />
        </div>

        <p
          className="animate-fade-up mt-5 max-w-2xl text-balance text-lg font-light text-white/85 md:text-2xl"
          style={{ animationDelay: '0.25s' }}
        >
          {settings?.tagline ?? 'تجربة طعام فاخرة في أجواء استثنائية'}
        </p>

        <div
          className="animate-fade-up mt-9 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: '0.4s' }}
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
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        ref={cueRef}
        href="#featured"
        aria-label="مرّر للأسفل"
        className="animate-cue-bob absolute bottom-8 left-1/2 text-white/70"
      >
        <ChevronDown className="h-7 w-7" />
      </a>
    </section>
  );
}
