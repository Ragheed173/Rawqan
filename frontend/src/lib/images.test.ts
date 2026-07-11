import { describe, expect, it } from 'vitest';
import { imageSrcSet, optimizedImageUrl } from './images';

const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/v123/rawaqan/dish.jpg';
const UNSPLASH = 'https://images.unsplash.com/photo-123?auto=format&fit=crop&w=2000&q=80';

describe('optimizedImageUrl', () => {
  it('injects a transformation segment into Cloudinary URLs', () => {
    expect(optimizedImageUrl(CLOUDINARY, 640)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v123/rawaqan/dish.jpg',
    );
  });

  it('rewrites Unsplash width/quality params', () => {
    const url = new URL(optimizedImageUrl(UNSPLASH, 480));
    expect(url.searchParams.get('w')).toBe('480');
    expect(url.searchParams.get('auto')).toBe('format');
  });

  it('returns non-CDN URLs untouched', () => {
    const other = 'https://example.com/img.png';
    expect(optimizedImageUrl(other, 640)).toBe(other);
  });
});

describe('imageSrcSet', () => {
  it('builds a width-described srcset for Cloudinary URLs', () => {
    const srcSet = imageSrcSet(CLOUDINARY, [320, 640]);
    expect(srcSet).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_320/v123/rawaqan/dish.jpg 320w, ' +
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v123/rawaqan/dish.jpg 640w',
    );
  });

  it('returns undefined for non-resizable sources', () => {
    expect(imageSrcSet('https://example.com/img.png')).toBeUndefined();
    expect(imageSrcSet('')).toBeUndefined();
  });
});
