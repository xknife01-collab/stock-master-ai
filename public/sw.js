const CACHE_NAME = 'stock-ai-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

// Install Service Worker and cache core shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch events: cache-first with network fallback for assets, bypass external API calls
self.addEventListener('fetch', (e) => {
  // Only handle requests on the same origin (ignore external API requests, Chrome extensions, etc.)
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Bypass non-GET requests (like POST)
  if (e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Dynamically cache Vite compiled production assets (JS/CSS)
        if (response.status === 200) {
          const url = new URL(e.request.url);
          if (url.pathname.includes('/assets/')) {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, cacheCopy);
            });
          }
        }
        return response;
      });
    })
  );
});
