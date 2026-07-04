import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a price with the restaurant currency, Arabic-Egyptian locale. */
export function formatPrice(value: number | null | undefined, currency = 'EGP'): string {
  if (value == null) return '';
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Percentage discount between base and discounted price. */
export function discountPercent(price: number, discount?: number | null): number | null {
  if (!discount || discount >= price) return null;
  return Math.round(((price - discount) / price) * 100);
}
