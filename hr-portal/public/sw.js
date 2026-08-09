// Minimal service worker, caches only the static app shell (the login
// page and a couple of static assets) so opening the app with no signal
// shows something instead of a browser error, on the way to a real
// connection. Deliberately does not cache API responses or any other
// page: attendance, roster, and recruitment data must always come from
// the network, since serving stale data offline would be actively
// misleading.

const CACHE_NAME = 'nxc-portal-shell-v1';
const SHELL_URLS = ['/login', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !SHELL_URLS.includes(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
