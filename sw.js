/* ============================================================
   Startup Demo — Production Service Worker (PWA & Offline Mode)
   Optimized for high-concurrency demo events with network-first
   fallbacks, cache cleanup, and zero-interference with Supabase API.
   ============================================================ */

const CACHE_NAME = 'startup-demo-live-v2.6.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './metrics-frontend.js',
  './app.js',
  './config.js',
  './vendor/supabase.min.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/logo.png',
  './assets/icon-app.png'
];

// Install: Pre-cache core shell assets & skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((err) => {
        console.warn('[SW] Pre-caching partial notice:', err);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Claim clients and purge all obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[SW] Purging outdated cache:', key);
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        );
      })
      .then(() => self.clients.claim())
      .catch((err) => {
        console.warn('[SW] Activation cleanup error:', err);
      })
  );
});

// Fetch: Strategy customized by request type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never intercept or cache non-GET requests (prevents mutation/RPC breakages)
  if (req.method !== 'GET') {
    return;
  }

  // 2. Bypass cache for Supabase REST API & Realtime WebSockets
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/realtime/v1/')) {
    return;
  }

  // 3. For navigation/HTML requests: Network-first with cache fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(req, copy))
              .catch((err) => console.warn('[SW] Cache put failed:', err));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('./index.html');
          return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // 4. For static assets (CSS, JS, Fonts, Images): Cache-first with background revalidation
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        if (url.origin === location.origin) {
          fetch(req)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(req, response))
                  .catch((err) => console.warn('[SW] Revalidation cache put notice:', err));
              }
            })
            .catch((err) => {
              console.debug('[SW] Background revalidation offline:', err);
            });
        }
        return cached;
      }

      return fetch(req)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(req, copy))
            .catch((err) => console.warn('[SW] Asset caching error:', err));
          return response;
        })
        .catch(() => caches.match(req));
    })
  );
});
