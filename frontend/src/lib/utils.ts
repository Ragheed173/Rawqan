import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(
  value: number | null | undefined,
  currency = 'ILS'
): string {
  if (value == null) return '';

  return new Intl.NumberFormat('ar-PS', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function discountPercent(price: number, discount?: number | null): number | null {
  if (!discount || discount >= price) return null;
  return Math.round(((price - discount) / price) * 100);
}
