import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Seo } from '@/components/shared/Seo';
import { useSettings } from '@/hooks/useMenu';
import { telHref } from '@/lib/contact';

/** Shown to public visitors when maintenance mode is enabled (Task 22). */
export default function MaintenancePage() {
  const { data: settings } = useSettings();
  return (
    <>
      <Seo title="صيانة" />
      <div className="grid min-h-screen place-items-center bg-ink px-4 text-center text-white">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Logo name={settings?.name} logoUrl={settings?.logoUrl} className="text-4xl text-white" />
          <div className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent">
            <Wrench className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">الموقع تحت الصيانة</h1>
          <p className="mx-auto mt-3 max-w-md text-white/60">
            {settings?.maintenanceMessage ?? 'نجري بعض التحسينات لخدمتكم بشكل أفضل. نعود إليكم قريباً.'}
          </p>
          {settings?.phone && (
            <a href={telHref(settings.phone)} className="mt-6 inline-block text-accent hover:underline" dir="ltr">
              {settings.phone}
            </a>
          )}
        </motion.div>
      </div>
    </>
  );
}
