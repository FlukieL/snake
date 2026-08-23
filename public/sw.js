// Service worker with a "network-first, cache-fallback" strategy for the app
// shell (HTML/CSS/JS) so users always get the latest deployed code when
// online, while still working offline from the last successfully cached
// version. Static media (audio/images) use cache-first since they rarely
// change and are larger to re-fetch.
//
// IMPORTANT: bump CACHE_VERSION on every deploy that changes cached files,
// so old caches are cleaned up and clients pick up fresh assets.
const CACHE_VERSION = 'v11';
const CACHE_NAME = `snake-cache-${CACHE_VERSION}`;

const APP_SHELL = [
    '/',
    '/index.html',
    '/style.css',
    '/site.webmanifest',
    '/js/main.js',
    '/js/state.js',
    '/js/dom.js',
    '/js/storage.js',
    '/js/ui.js',
    '/js/audio.js',
    '/js/nokiaMode.js',
    '/js/render.js',
    '/js/game.js',
    '/js/leaderboard.js',
    '/js/auth.js',
    '/js/input.js',
    '/js/levels.js',
    '/js/powerupInfo.js'
];

const STATIC_MEDIA = [
    '/SnakeGameMusic.mp3',
    '/GameOverSound.mp3',
    '/EatingSound.mp3',
    '/favicon.ico',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/apple-touch-icon.png',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/logo.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_SHELL, ...STATIC_MEDIA]))
    );
    // Activate the new service worker immediately, without waiting for old
    // tabs to close, so cache/version updates roll out as fast as possible.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames
                .filter((name) => name !== CACHE_NAME)
                .map((name) => caches.delete(name))
        ))
    );
    // Take control of any already-open pages immediately.
    self.clients.claim();
});

function isAppShellRequest(url) {
    return APP_SHELL.some((path) => url.pathname === path) || url.pathname === '/';
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache the leaderboard API - always hit the network for live data.
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (isAppShellRequest(url)) {
        // Network-first: try to fetch the latest version; fall back to cache
        // if offline. This ensures deployed code/style updates are picked up
        // as soon as the network is available, rather than being stuck on a
        // stale cached copy indefinitely.
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Static media: cache-first (rarely changes, and this saves bandwidth).
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
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

// Allow the page to trigger an immediate activation of a waiting service
// worker (e.g. after detecting an update), so users can refresh to the
// latest version without waiting for all tabs to close.
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
