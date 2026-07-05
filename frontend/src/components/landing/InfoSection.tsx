import { motion } from 'framer-motion';
import { Clock, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { telHref, whatsappHref } from '@/lib/contact';
import { WhatsAppIcon } from '@/components/layout/FloatingActions';
import type { RestaurantSettings, Weekday } from '@/types';

const DAYS: Record<Weekday, string> = {
  SUNDAY: 'الأحد',
  MONDAY: 'الإثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
  FRIDAY: 'الجمعة',
  SATURDAY: 'السبت',
};

const TODAY: Weekday[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Opening hours + location + contact block (Task 1). */
export function InfoSection({ settings }: { settings?: RestaurantSettings }) {
  if (!settings) return null;
  const todayKey = TODAY[new Date().getDay()];
  const wa = whatsappHref(settings.whatsapp, 'مرحباً، أود حجز طاولة');

  return (
    <section className="bg-secondary py-20 text-secondary-foreground md:py-28">
      <div className="container">
        <SectionHeading
          eyebrow="زورونا"
          title="نحن في انتظاركم"
          subtitle="تفضلوا بزيارتنا أو تواصلوا معنا لأي استفسار"
          onDark
          className="[&_h2]:text-white [&_p]:text-white/60"
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Opening hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="mb-4 flex items-center gap-2 text-accent">
              <Clock className="h-5 w-5" />
              <h3 className="font-display font-semibold text-white">ساعات العمل</h3>
            </div>
            <ul className="space-y-2 text-sm">
              {settings.openingHours.map((h) => {
                const isToday = h.weekday === todayKey;
                return (
                  <li
                    key={h.weekday}
                    className={`flex justify-between gap-4 rounded-lg px-2 py-1 ${isToday ? 'bg-accent/15 font-medium text-accent' : 'text-white/70'}`}
                  >
                    <span>
                      {DAYS[h.weekday]} {isToday && '· اليوم'}
                    </span>
                    <span className="tabular-nums">{h.isClosed ? 'مغلق' : `${h.opensAt} - ${h.closesAt}`}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>

          {/* Location */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="mb-4 flex items-center gap-2 text-accent">
              <MapPin className="h-5 w-5" />
              <h3 className="font-display font-semibold text-white">الموقع</h3>
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              {settings.addressLine ?? 'سيتم تحديث العنوان قريباً'}
            </p>
            {settings.googleMapsUrl && (
              <Button asChild variant="gold" size="sm" className="mt-4 w-fit">
                <a href={settings.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  فتح في الخرائط
                </a>
              </Button>
            )}
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="mb-4 flex items-center gap-2 text-accent">
              <Phone className="h-5 w-5" />
              <h3 className="font-display font-semibold text-white">تواصل معنا</h3>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              {settings.phone && (
                <Button asChild variant="outline" className="justify-center border-white/20 text-white hover:bg-white/10">
                  <a href={telHref(settings.phone)}>
                    <Phone className="h-4 w-4" /> اتصل بنا
                  </a>
                </Button>
              )}
              {wa && (
                <Button asChild className="justify-center bg-[#25D366] text-white hover:bg-[#1EB959]">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="h-5 w-5" /> واتساب
                  </a>
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
