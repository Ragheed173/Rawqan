/* Rawaqan service worker (Task 22): offline support, image caching, offline menu.
   Hand-written (no build-time precache) so it survives Vite's hashed asset names. */

const VERSION = 'pos-v6';
const SHELL_CACHE = `rawaqan-shell-${VERSION}`;
const ASSET_CACHE = `rawaqan-assets-${VERSION}`;
const IMAGE_CACHE = `rawaqan-images-${VERSION}`;
const API_CACHE = `rawaqan-api-${VERSION}`;
const POS_READY_KEY = '/__rawaqan_pos_ready__';

const OFFLINE_URLS = ['/', '/menu', '/pos'];
const CACHEABLE_PUBLIC_API_PATHS = new Set(['/api/categories', '/api/items', '/api/tags', '/api/settings']);

self.addEventListener('install', (event) => {
  // A worker is installable only after the complete POS shell is durable.
  // Serving cached HTML without its hashed modules produces a blank cold start.
  event.waitUntil(precachePosAssets());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'PRECACHE_POS') event.waitUntil(precachePosAssets());
  if (event.data?.type === 'GET_STATUS') {
    event.waitUntil(caches.match(POS_READY_KEY).then((ready) => event.ports[0]?.postMessage({ version: VERSION, shellReady: Boolean(ready) })));
  }
});

async function precachePosAssets() {
  const shellCache = await caches.open(SHELL_CACHE);
  await shellCache.addAll(OFFLINE_URLS);
  const response = await fetch('/manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('POS manifest unavailable');
  const manifest = await response.json();
  const selected = new Set(['index.html', ...Object.keys(manifest).filter((key) => key.includes('src/pos/'))]);
  const visited = new Set();
  const visit = (key) => {
    if (!key || visited.has(key)) return;
    visited.add(key);
    selected.add(key);
    const entry = manifest[key];
    if (!entry) return;
    // POS dynamic entries are already selected above. Only their static graph
    // is required; downloading every public/admin route would waste storage.
    for (const dependency of entry.imports || []) visit(dependency);
  };
  [...selected].forEach(visit);
  const urls = [...selected].flatMap((key) => {
    const entry = manifest[key];
    return entry ? [entry.file, ...(entry.css || []), ...(entry.assets || [])].map((file) => `/${file}`) : [];
  });
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all([...new Set(urls)].map((url) => cache.add(url)));
  await shellCache.put(POS_READY_KEY, new Response(VERSION, { headers: { 'content-type': 'text/plain' } }));
}

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
    if (res && (res.ok || res.type === 'opaque')) await cache.put(req, res.clone());
    return res;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  // Static servers commonly emit `Vary: Origin`. The install-time precache and
  // a later module request can carry different Origin headers even though the
  // immutable hashed URL is identical, so header-sensitive matching can miss.
  const cached = await cache.match(req, { ignoreVary: true });
  const network = fetch(req)
    .then(async (res) => {
      if (res && res.ok) await cache.put(req, res.clone());
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

  // SPA navigations → network-first, fall back to the correct cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match(url.pathname.startsWith('/pos') ? '/pos' : '/'))),
    );
    return;
  }

  // Only anonymous menu endpoints may enter Cache Storage. Auth, POS, admin,
  // financial, sync and health responses must never be cached by the SW.
  if (url.origin === self.location.origin && CACHEABLE_PUBLIC_API_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(request, API_CACHE));
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
