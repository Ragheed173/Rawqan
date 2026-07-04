import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { key: 'light', icon: Sun, label: 'فاتح' },
  { key: 'dark', icon: Moon, label: 'داكن' },
  { key: 'system', icon: Monitor, label: 'النظام' },
] as const;

/** Segmented light / dark / system switcher (Task 22). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="سمة العرض"
      className={cn('inline-flex items-center gap-1 rounded-full border border-border bg-card p-1', className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={theme === o.key}
          aria-label={o.label}
          title={o.label}
          onClick={() => setTheme(o.key)}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full transition-colors',
            theme === o.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <o.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
