// Service worker: NETWORK-FIRST for page navigations (so new code always wins),
// stale-while-revalidate for /api/* GETs (snappy data).
//
// On upgrade: bump VERSION to invalidate ALL old caches and force fresh HTML.

// v2: owner-view requests bypass the cache entirely (cross-view isolation).
// v3: navy+gold house theme, new icon set.
const VERSION = 'dripp-tracker-v4';

self.addEventListener('install', (e) => {
  // Take over immediately, don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Drop ALL old caches (any name not matching current VERSION)
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      // Take control of any open tabs immediately
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept backend mutations or refresh endpoints
  if (url.pathname.startsWith('/api/sod/sync') || url.pathname.includes('/refresh-')) return;

  // Owner-view requests are NETWORK-ONLY. The Cache API matches by URL and
  // ignores request headers, so a cached internal (non-anonymized) response
  // could otherwise be served to an X-View: owner request at the same URL,
  // and an owner response must never be cached for internal use either.
  if (req.headers.get('X-View') === 'owner' || url.searchParams.get('view') === 'owner') return;

  // Same-origin API GETs only, never intercept cross-origin (e.g. Render
  // backend at drippcan-tracker.onrender.com). Cross-origin fetches must hit
  // the network so the frontend's real fetch error handling fires;
  // intercepting them and returning a fake JSON 503 caused pages to render
  // {offline:true} as if it were real data.
  if (url.pathname.startsWith('/api/') && url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((r) => {
            if (r.ok) cache.put(req, r.clone());
            return r;
          })
          .catch(() => cached);  // No fake-200 fallback; let fetch reject if no cache.
        return cached ?? network;
      }),
    );
    return;
  }

  // Page navigations: NETWORK-FIRST (was cache-first, that's what kept users
  // on stale builds). On network failure, fall back to cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          // Update cache with the fresh response in the background
          if (r.ok) {
            caches.open(VERSION).then((cache) => cache.put(req, r.clone()));
          }
          return r;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/')),
        ),
    );
  }
});
