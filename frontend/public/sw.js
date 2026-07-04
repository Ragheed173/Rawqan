/* Rawaqan service worker (Task 22): offline support, image caching, offline menu.
   Hand-written (no build-time precache) so it survives Vite's hashed asset names. */

const VERSION = 'v1';
const SHELL_CACHE = `rawaqan-shell-${VERSION}`;
const ASSET_CACHE = `rawaqan-assets-${VERSION}`;
const IMAGE_CACHE = `rawaqan-images-${VERSION}`;
const API_CACHE = `rawaqan-api-${VERSION}`;

const OFFLINE_URLS = ['/', '/menu'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(OFFLINE_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

const isImage = (req) =>
  req.destination === 'image' || /\.(png|jpe?g|webp|avif|svg|gif)$/i.test(new URL(req.url).pathname);

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // SPA navigations → network-first, fall back to cached shell (offline menu).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Public API GETs → network-first with cache fallback (offline menu data).
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin')) {
    event.respondWith(networkFirst(request, API_CACHE).catch(() => new Response('[]', {
      headers: { 'Content-Type': 'application/json' },
    })));
    return;
  }

  // Images (incl. cross-origin Cloudinary/Unsplash) → cache-first.
  if (isImage(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Hashed build assets → stale-while-revalidate.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});
