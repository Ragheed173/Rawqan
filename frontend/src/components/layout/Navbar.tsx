import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useMenu';

const links = [
  { to: '/', label: 'الرئيسية' },
  { to: '/menu', label: 'القائمة' },
];

/** Sticky, scroll-aware navigation. Transparent over the hero, solid after scroll. */
export function Navbar() {
  const { data: settings } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/85 backdrop-blur-lg shadow-soft border-b border-border'
          : 'bg-transparent',
      )}
    >
      <nav className="container flex h-16 items-center justify-between md:h-20">
        <Link to="/" className="flex items-center gap-2" aria-label={settings?.name ?? 'روقان'}>
          <Logo
            name={settings?.name}
            logoUrl={settings?.logoUrl}
            className={cn('transition-colors', scrolled ? 'text-foreground' : 'text-white drop-shadow')}
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'relative text-sm font-medium transition-colors',
                  scrolled ? 'text-foreground/80 hover:text-foreground' : 'text-white/90 hover:text-white',
                  isActive && 'text-accent',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          <Button asChild variant="gold" size="sm">
            <Link to="/menu">تصفّح القائمة</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className={cn(
            'grid h-10 w-10 place-items-center rounded-full md:hidden',
            scrolled ? 'text-foreground' : 'text-white',
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t border-border bg-background/95 backdrop-blur-lg md:hidden"
        >
          <div className="container flex flex-col gap-1 py-4">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-4 py-3 text-sm font-medium',
                    isActive ? 'bg-muted text-accent' : 'text-foreground/80',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Button asChild variant="gold" className="mt-2" onClick={() => setOpen(false)}>
              <Link to="/menu">تصفّح القائمة</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
