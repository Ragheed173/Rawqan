import { Link } from 'react-router-dom';
import { Facebook, Instagram, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useSettings } from '@/hooks/useMenu';
import { telHref, whatsappHref } from '@/lib/contact';
import { WhatsAppIcon } from './FloatingActions';

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.4a5.99 5.99 0 0 0-.77-.05A5.68 5.68 0 1 0 15.54 15V8.99a7.29 7.29 0 0 0 4.27 1.37V7.27a4.28 4.28 0 0 1-3.21-1.45z" />
    </svg>
  );
}

const days: Record<string, string> = {
  SUNDAY: 'الأحد',
  MONDAY: 'الإثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
  FRIDAY: 'الجمعة',
  SATURDAY: 'السبت',
};

export function Footer() {
  const { data: settings } = useSettings();
  const year = new Date().getFullYear();

  const socials = [
    { href: settings?.instagram, icon: Instagram, label: 'إنستغرام' },
    { href: settings?.facebook, icon: Facebook, label: 'فيسبوك' },
    { href: settings?.tiktok, icon: TikTokIcon, label: 'تيك توك' },
    { href: whatsappHref(settings?.whatsapp), icon: WhatsAppIcon, label: 'واتساب' },
  ].filter((s) => s.href);

  return (
    <footer className="mt-24 border-t border-border bg-secondary text-secondary-foreground">
      <div className="container grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-4">
          <Logo name={settings?.name} logoUrl={settings?.logoUrl} className="text-white" />
          <p className="max-w-xs text-sm leading-relaxed text-white/60">
            {settings?.description ?? 'تجربة طعام فاخرة في أجواء استثنائية.'}
          </p>
          <div className="flex gap-3 pt-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <s.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold text-accent">تواصل معنا</h4>
          {settings?.phone && (
            <a href={telHref(settings.phone)} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
              <Phone className="h-4 w-4" /> {settings.phone}
            </a>
          )}
          {settings?.addressLine && (
            <a
              href={settings.googleMapsUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-white/70 hover:text-white"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {settings.addressLine}
            </a>
          )}
          <Link to="/menu" className="block text-sm text-white/70 hover:text-white">
            تصفّح القائمة
          </Link>
        </div>

        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold text-accent">ساعات العمل</h4>
          <ul className="space-y-1.5 text-sm text-white/70">
            {settings?.openingHours.map((h) => (
              <li key={h.weekday} className="flex justify-between gap-4">
                <span>{days[h.weekday]}</span>
                <span className="tabular-nums">
                  {h.isClosed ? 'مغلق' : `${h.opensAt} - ${h.closesAt}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 border-t border-white/10 py-5 text-center text-xs text-white/50 sm:flex-row sm:justify-between sm:px-6">
        <span>{settings?.footerText ?? `روقان © ${year}`} · جميع الحقوق محفوظة</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
