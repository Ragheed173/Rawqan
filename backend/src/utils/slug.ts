/**
 * Slugify supporting Arabic + Latin. Latin is lowercased and hyphenated;
 * Arabic letters are preserved (URL-encoded by the browser). Falls back to a
 * short random suffix when the input yields an empty slug.
 */
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // strip Arabic diacritics
    .replace(/[^\p{L}\p{N}]+/gu, '-') // non alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return base || `item-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ensures uniqueness by probing an async existence check. */
export async function uniqueSlug(
  input: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(input);
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
