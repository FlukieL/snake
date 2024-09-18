const CACHE_NAME = 'snake-cache-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/SnakeGameMusic.mp3',
    '/GameOverSound.mp3',
    '/EatingSound.mp3'
    // Add other assets to cache as needed
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response from cache
                if (response) {
                    return response;
                }
                // Clone the request for fetching from the network
                return fetch(event.request.clone())
                    .then((networkResponse) => {
                        // If we get a successful response from the network,
                        // put it in the cache and also return the response.
                        if (networkResponse.status === 200) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('Error fetching:', error);
                        // Fallback: Could return a cached error page here.
                        throw error; 
                    });
            })
    );
});