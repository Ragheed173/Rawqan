import { describe, it, expect } from 'vitest';
import { listItemsQuerySchema } from '../src/modules/menu/item.schemas.js';
import { updateSettingsSchema } from '../src/modules/settings/settings.schemas.js';

describe('listItemsQuerySchema — query boolean coercion (regression: archived=false)', () => {
  it('parses "false" as false (NOT true)', () => {
    const parsed = listItemsQuerySchema.parse({ archived: 'false' });
    expect(parsed.archived).toBe(false);
  });

  it('parses "true" as true', () => {
    expect(listItemsQuerySchema.parse({ archived: 'true' }).archived).toBe(true);
  });

  it('parses "1"/"0" correctly', () => {
    expect(listItemsQuerySchema.parse({ featured: '1' }).featured).toBe(true);
    expect(listItemsQuerySchema.parse({ featured: '0' }).featured).toBe(false);
  });

  it('leaves omitted booleans undefined', () => {
    const parsed = listItemsQuerySchema.parse({});
    expect(parsed.archived).toBeUndefined();
    expect(parsed.featured).toBeUndefined();
  });

  it('coerces limit and rejects invalid sort', () => {
    expect(listItemsQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(() => listItemsQuerySchema.parse({ sort: 'nope' })).toThrow();
  });
});

describe('updateSettingsSchema — optional URL fields (regression: empty string 400)', () => {
  it('normalizes empty string to null', () => {
    const parsed = updateSettingsSchema.parse({ facebook: '', instagram: '', tiktok: '', googleMapsUrl: '' });
    expect(parsed.facebook).toBeNull();
    expect(parsed.instagram).toBeNull();
    expect(parsed.tiktok).toBeNull();
    expect(parsed.googleMapsUrl).toBeNull();
  });

  it('accepts null and undefined', () => {
    expect(updateSettingsSchema.parse({ facebook: null }).facebook).toBeNull();
    expect(updateSettingsSchema.parse({}).facebook).toBeUndefined();
  });

  it('accepts a valid URL', () => {
    expect(updateSettingsSchema.parse({ facebook: 'https://facebook.com/rawaqan' }).facebook).toBe(
      'https://facebook.com/rawaqan',
    );
  });

  it('rejects an invalid URL', () => {
    expect(() => updateSettingsSchema.parse({ facebook: 'not-a-url' })).toThrow();
  });

  it('rejects an out-of-range latitude but allows null', () => {
    expect(() => updateSettingsSchema.parse({ latitude: 200 })).toThrow();
    expect(updateSettingsSchema.parse({ latitude: null }).latitude).toBeNull();
  });
});
