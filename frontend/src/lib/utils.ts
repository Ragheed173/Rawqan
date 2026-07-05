import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '';

  return `₪${Number(value).toFixed(0)}`;
}

export function discountPercent(price: number, discount?: number | null): number | null {
  if (!discount || discount >= price) return null;
  return Math.round(((price - discount) / price) * 100);
}
