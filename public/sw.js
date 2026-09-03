// Service worker with a "network-first, cache-fallback" strategy for the app
// shell (HTML/CSS/JS) so users always get the latest deployed code when
// online, while still working offline from the last successfully cached
// version. Static media (audio/images) use cache-first since they rarely
// change and are larger to re-fetch.
//
// IMPORTANT: bump CACHE_VERSION on every deploy that changes cached files,
// so old caches are cleaned up and clients pick up fresh assets.
const CACHE_VERSION = 'v69';
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
    '/js/offline.js',
    '/js/ui.js',
    '/js/audio.js',
    '/js/haptics.js',
    '/js/nokiaMode.js',
    '/js/render.js',
    '/js/game.js',
    '/js/leaderboard.js',
    '/js/auth.js',
    '/js/input.js',
    '/js/levels.js',
    '/js/powerupInfo.js',
    '/js/logoAnimation.js'
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

// Caches each URL individually rather than using cache.addAll(), which is
// atomic - if even ONE resource in the list fails to fetch (a transient
// network hiccup, a typo'd path, deploy timing, etc.), addAll() aborts the
// ENTIRE install with no cache populated at all, silently leaving the app
// with zero offline capability despite the service worker appearing to
// register successfully. This is very likely the cause of "This site
// can't be reached" errors when opening the installed PWA offline - a
// single failed resource during install meant literally nothing (not even
// index.html) ever got cached. Caching individually means one failure only
// skips that one resource, while everything else still gets cached
// successfully.
function cacheAll(cache, urls) {
    return Promise.all(urls.map((url) =>
        cache.add(url).catch((err) => {
            console.error('Service worker: failed to cache', url, err);
        })
    ));
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cacheAll(cache, [...APP_SHELL, ...STATIC_MEDIA]))
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

    // Let the browser handle cross-origin requests (Google Sign-In script,
    // Google Fonts, etc.) entirely natively - don't intercept them at all.
    // These are third-party resources this service worker has no business
    // trying to cache-manage, and attempting to (particularly opaque
    // cross-origin responses, which can't be inspected/validated the same
    // way as same-origin ones) previously risked misbehaving while offline
    // rather than just cleanly failing the way an un-intercepted request
    // would. The app already tolerates these failing offline (Google
    // Sign-In simply doesn't render - see auth.js), so there's no need for
    // this service worker to be involved with them at all.
    if (url.origin !== self.location.origin) {
        return;
    }

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
                .catch(() => caches.match(event.request).then((cached) => {
                    // Final fallback specifically for navigation requests
                    // (e.g. the PWA's manifest start_url "/index.html" being
                    // loaded when the OS launches the installed app while
                    // offline) - if this exact URL somehow wasn't cached for
                    // any reason, fall back to whichever of "/" or
                    // "/index.html" IS cached rather than surfacing a raw
                    // failed-fetch/"can't be reached" error, since they're
                    // the same document either way.
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html').then((indexFallback) => indexFallback || caches.match('/'));
                    }
                    return undefined;
                }))
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
        return;
    }

    // The Settings screen reads its displayed version from this response,
    // making CACHE_VERSION the sole release-version source of truth.
    if (event.data === 'GET_VERSION') {
        event.ports[0]?.postMessage({ type: 'VERSION', version: CACHE_VERSION });
    }
});
