// Flolux — мінімальний service worker для PWA install criteria.
// Стратегія: network-first для статики; API-запити НЕ кешуються.
// Спеціально не кешуємо API, бо це ламає сповіщення, чернетки, тощо.

const CACHE_NAME = 'flolux-v1';
const PRECACHE = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Не кешуємо API (сповіщення/чернетки/живі дані мають іти напряму)
  if (url.pathname.startsWith('/api/')) return;
  // Не кешуємо upload-файли
  if (url.pathname.startsWith('/uploads/')) return;
  // Лише свій origin
  if (url.origin !== self.location.origin) return;

  // Network-first з fallback на кеш (для офлайн-старту SPA)
  event.respondWith(
    fetch(req).then((res) => {
      // Кешуємо ok-відповіді на статику (basic/cors)
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});
