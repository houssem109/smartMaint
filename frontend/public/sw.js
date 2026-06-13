/// <reference lib="webworker" />

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Do not intercept API or Next assets — avoids breaking login on phone PWA.
self.addEventListener('fetch', (event) => {
  const { pathname } = new URL(event.request.url);
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return;
  }
  event.respondWith(fetch(event.request));
});
