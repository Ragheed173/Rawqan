/** Builds tel:/wa.me links from raw phone strings, tolerant of formatting. */
export function telHref(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsappHref(phone?: string | null, text?: string): string | undefined {
  if (!phone) return undefined;
  const number = phone.replace(/[^\d]/g, '');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${number}${query}`;
}
