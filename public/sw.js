// Minimal passthrough service worker for the admin PWA install.
// Registered with scope '/admin' from components/admin/InstallAppCard.tsx.
//
// Intentionally caches nothing. Every request goes straight to the network,
// so a Vercel redeploy is live on the very next app open — no reinstall,
// no stale app shell. Do NOT add caching here.
//
// install/activate + skipWaiting/clients.claim keep the worker itself from
// going stale. The fetch listener exists only to satisfy Chromium's
// "has a fetch handler" installability check — it never calls respondWith.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // no-op: falls through to normal network handling
})
