import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, QrCode, X } from 'lucide-react';
import { useSettings } from '@/hooks/useMenu';
import { telHref, whatsappHref } from '@/lib/contact';
import { config } from '@/config/env';
import { cn } from '@/lib/utils';

/** WhatsApp glyph (lucide has no brand icon). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.04 21.5a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 1 1 8 4.41z" />
    </svg>
  );
}

/**
 * Bottom-right floating action stack: WhatsApp, Call, and an expandable QR
 * indicator (Task 1). Positioned to avoid the mobile menu / bottom-nav.
 */
export function FloatingActions() {
  const { data: settings } = useSettings();
  const [qrOpen, setQrOpen] = useState(false);

  const wa = whatsappHref(settings?.whatsapp, 'مرحباً، أود الاستفسار عن القائمة');
  const tel = telHref(settings?.phone);
  const qrSrc = `${config.apiBaseUrl}/qr?format=png&size=512`; // public menu QR

  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-3">
      <AnimatePresence>
        {qrOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="rounded-2xl border border-border bg-card p-3 shadow-card"
          >
            <div className="mb-2 flex items-center justify-between gap-6">
              <span className="text-xs font-medium text-muted-foreground">امسح القائمة</span>
              <button onClick={() => setQrOpen(false)} aria-label="إغلاق">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <img
              src={qrSrc}
              alt="رمز QR لقائمة روقان"
              className="h-40 w-40 rounded-lg"
              loading="lazy"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => setQrOpen((v) => !v)}
          className={cn(
            'grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform hover:scale-105',
          )}
          aria-label="عرض رمز QR"
          aria-pressed={qrOpen}
        >
          <QrCode className="h-5 w-5" />
        </button>
        {tel && (
          <a
            href={tel}
            className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground shadow-gold transition-transform hover:scale-105"
            aria-label="اتصل بنا"
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-card transition-transform hover:scale-105"
            aria-label="تواصل عبر واتساب"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>
        )}
      </div>
    </div>
  );
}

export { WhatsAppIcon };
