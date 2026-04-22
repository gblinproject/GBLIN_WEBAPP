// Minimal service worker for GBLIN PWA install prompt support.
// We intentionally keep this tiny: modern browsers only require a valid SW
// registration (with a fetch handler) to mark the app as installable.

const CACHE_NAME = "gblin-v1";
const CORE_ASSETS = ["/", "/manifest.json", "/LOGO_GBLIN.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first with cache fallback for navigations so the app shell can be installed
// and also works briefly offline. API/RPC calls are always bypassed.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip non-http(s) and cross-origin requests (RPC, Thirdweb API, images on CDN, etc.).
  if (url.origin !== self.location.origin) return;

  // Skip Next.js internal/API and RSC payloads to avoid stale responses.
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
