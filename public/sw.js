/**
 * Tulip Fragrance Company - Ultra-Fast PWA & Offline Service Worker
 * Features:
 * - Instant Cache-First strategy for static assets, scripts, stylesheets, fonts, and images.
 * - Fast Network-First with 1.2s timeout fallback to cache for /api/sync.
 * - Full offline resilience for installable PWA mode.
 */

const CACHE_NAME = 'tulip-pwa-v3';
const API_CACHE_NAME = 'tulip-api-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/tulip-logo.svg',
  '/tulip-extrait-default.jpg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache notice:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (orders submission, telegram test, etc.)
  if (request.method !== 'GET') {
    return;
  }

  // Handle /api/sync with fast 1200ms network timeout -> cached response fallback
  if (url.pathname === '/api/sync') {
    event.respondWith(
      new Promise((resolve) => {
        let hasResolved = false;

        const timer = setTimeout(async () => {
          if (!hasResolved) {
            hasResolved = true;
            const apiCache = await caches.open(API_CACHE_NAME);
            const cachedResponse = await apiCache.match(request);
            if (cachedResponse) {
              resolve(cachedResponse);
            }
          }
        }, 1200);

        fetch(request)
          .then((networkResponse) => {
            clearTimeout(timer);
            if (!hasResolved) {
              hasResolved = true;
              if (networkResponse && networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(API_CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              resolve(networkResponse);
            }
          })
          .catch(async () => {
            clearTimeout(timer);
            if (!hasResolved) {
              hasResolved = true;
              const apiCache = await caches.open(API_CACHE_NAME);
              const cachedResponse = await apiCache.match(request);
              if (cachedResponse) {
                resolve(cachedResponse);
              } else {
                resolve(
                  new Response(
                    JSON.stringify({ status: 'ok', products: [], orders: [], customerApplications: [], customerUsers: [], adBanners: [] }),
                    { headers: { 'Content-Type': 'application/json' } }
                  )
                );
              }
            }
          });
      })
    );
    return;
  }

  // Handle SPA navigation requests (e.g. refresh on any route or offline reload)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = (await cache.match(request)) || (await cache.match('/')) || (await cache.match('/index.html'));
          if (cached) return cached;
          return new Response('<h1>Tulip Fragrance</h1><p>Mode Hors-ligne</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Cache-First strategy for static assets: scripts, styles, images, fonts, svg
  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ico|json)$/i) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Serve from cache immediately, optionally revalidate in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse);
              }
            })
            .catch(() => {});
          return cached;
        }

        // Not in cache -> fetch from network and store
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default network fetch with cache fallback
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(request);
    })
  );
});
