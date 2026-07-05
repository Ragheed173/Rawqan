import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'start';
  /** Set on dark sections so the eyebrow keeps the bright brand gold (already AA there). */
  onDark?: boolean;
  className?: string;
}

/** Consistent section heading with gold eyebrow and animated reveal. */
export function SectionHeading({ eyebrow, title, subtitle, align = 'center', onDark = false, className }: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={cn('mb-10 max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-start', className)}
    >
      {eyebrow && (
        <span
          className={cn(
            'mb-3 inline-block text-sm font-semibold uppercase tracking-widest',
            onDark ? 'text-accent' : 'text-accent-ink',
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </motion.div>
  );
}
