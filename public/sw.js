const CACHE_NAME = 'snake-cache-v4';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/SnakeGameMusic.mp3',
    '/GameOverSound.mp3',
    '/EatingSound.mp3',
    '/favicon.ico',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/apple-touch-icon.png',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/logo.jpg',
    '/site.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache the leaderboard API - always go to the network for live data
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) return response;
                return fetch(event.request.clone())
                    .then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, networkResponse.clone()));
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('Error fetching:', error);
                        throw error;
                    });
            })
    );
});
