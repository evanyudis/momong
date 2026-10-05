// Offline shell: network-first for navigations, stale-while-revalidate for same-origin assets and fonts.
// API calls (same-origin /api, /sync, /me, /household) are never cached (sync handles offline itself).
const CACHE = "bb-v5";
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const res = await fetch('/offline-assets.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('offline assets unavailable');
    const assets = await res.json();
    const cache = await caches.open(CACHE);
    await cache.addAll(['/', '/manifest.webmanifest', '/icon.svg', ...assets]);
  })());
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && /^\/(api|sync|me|household|billing|wishlist)(\/|$)/.test(url.pathname)) return;
  const cacheable = url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com");
  if (!cacheable) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put("/", res.clone())); return res; }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
