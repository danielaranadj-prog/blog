// Service Worker for Instante Trips PWA
const CACHE_NAME = 'instante-trips-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately
const PRECACHE_ASSETS = [
    '/',
    '/offline.html',
    '/manifest.json',
    '/pwa-icon-192.png',
    '/pwa-icon-512.png'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Precaching essential assets');
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    const isSameOrigin = requestUrl.origin === location.origin;

    // Only intercept and cache same-origin requests
    // External resources (Unsplash, Cloudinary, Firebase CDN, etc.) load normally
    if (!isSameOrigin) {
        return; // Let the browser handle external requests natively
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response - needed for cache + return
                const responseToCache = response.clone();

                // Cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }

                return response;
            })
            .catch(() => {
                // Network failed - try cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // If it's a navigate request and no cache, show offline page
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }

                    // Return a simple error response for failed same-origin requests
                    return new Response('Network error', {
                        status: 408,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
    );
});
