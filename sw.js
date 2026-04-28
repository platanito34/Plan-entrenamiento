const CACHE_NAME = 'ironlog-v1';

const PRECACHE_URLS = [
  '/app.html',
  '/index.html',
  '/login.html',
  '/register.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/router.js',
  '/js/data.js',
  '/js/state.js',
  '/js/plans.js',
  '/js/session.js',
  '/js/history.js',
  '/js/weights.js',
  '/js/exercises.js',
  '/js/progress.js',
  '/js/achievements.js',
  '/js/customExercises.js',
  '/manifest.json',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Cache-first for static assets; network-first for API calls
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Always go to network for API requests
  if (url.hostname === 'ironlogapp.duckmydns.org') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for html, css, js, images, json
  if (/\.(html|css|js|gif|png|jpg|jpeg|webp|svg|json)$/.test(url.pathname) || url.pathname === '/') {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request).then(function (response) {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
