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
const NAV_TIMEOUT_MS = 4000;

function navigationResponse(req) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(() => {
      caches.match("/").then((cached) => finish(cached || Response.error()));
    }, NAV_TIMEOUT_MS);
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
      finish(res);
    }).catch(() => {
      caches.match("/").then((cached) => finish(cached || Response.error()));
    });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && /^\/(api|sync|me|household|billing|wishlist)(\/|$)/.test(url.pathname)) return;
  const cacheable = url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com");
  if (!cacheable) return;
  if (req.mode === "navigate") {
    e.respondWith(navigationResponse(req));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        c.put(req, copy);
      }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
