import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design tokens map to CSS variables (see src/index.css) so the admin theme
 * editor can override colors at runtime without a rebuild.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          ink: 'hsl(var(--accent-ink))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        gold: {
          DEFAULT: '#D4AF37',
          50: '#FBF7EA',
          100: '#F5EBC7',
          200: '#EBD891',
          300: '#E0C55B',
          400: '#D4AF37',
          500: '#B8952A',
          600: '#8F7220',
        },
        ink: { DEFAULT: '#111111', soft: '#1B1B1B' },
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Cairo', 'system-ui', 'sans-serif'],
        latin: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'IBM Plex Sans Arabic', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 2px 12px rgba(17, 17, 17, 0.06)',
        card: '0 8px 30px rgba(17, 17, 17, 0.08)',
        gold: '0 8px 30px rgba(212, 175, 55, 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Dialog entrance — animates *within* the centered translate so it
        // never overrides the -translate-x/y-1/2 centering (no `both` fill).
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease-out both',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'dialog-in': 'dialog-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
