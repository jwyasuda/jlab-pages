// JLab Service Worker — generated at build time; do not edit dist/sw.js directly.
// Template lives at apps/reader/src/sw-template.js; vite.config.ts generates dist/sw.js.

const SW_VERSION = "2026-05-30-10-45-18";
const DICT_VERSION = "3.6.2+20260518145612";
const BASE_PATH = "/jlab-pages/";
const AUDIO_BASE_URL = "https://bkk-nas.taile226fd.ts.net";
const SHELL_CACHE = `jlab-shell-${SW_VERSION}`;
const CONTENT_CACHE = `jlab-content-${SW_VERSION}`;
const DICT_CACHE = `jlab-dict-${DICT_VERSION}`;

const SHELL_ASSETS = [
  "/jlab-pages/index.html",
  "/jlab-pages/manifest.webmanifest",
  "/jlab-pages/apple-touch-icon-180.png",
  "/jlab-pages/icons/icon-192.png",
  "/jlab-pages/icons/icon-512.png",
  "/jlab-pages/icons/icon-maskable-512.png",
  "/jlab-pages/assets/index-CJOhckOl.js",
  "/jlab-pages/assets/index-ChqQ2bqN.css"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        await cache.addAll(SHELL_ASSETS);
      } catch (err) {
        console.warn("[sw] shell pre-cache partial failure", err);
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const KEEP = new Set([SHELL_CACHE, CONTENT_CACHE, DICT_CACHE]);
      await Promise.all(
        keys
          .filter(
            (k) =>
              (k.startsWith("jlab-shell-") ||
                k.startsWith("jlab-content-") ||
                k.startsWith("jlab-dict-")) &&
              !KEEP.has(k),
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }
  return networkFetch;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") return;

  // Skip audio and video by destination — audio must never enter Cache Storage
  if (request.destination === "audio" || request.destination === "video") return;

  const url = new URL(request.url);

  // Skip cross-origin — covers NAS/Tailscale audio endpoint and any CDN
  if (url.origin !== self.location.origin) return;

  const { pathname } = url;

  // Navigation → network-first, fall back to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (
          (await cache.match(request)) ??
          (await cache.match(`${BASE_PATH}index.html`)) ??
          Response.error()
        );
      }),
    );
    return;
  }

  // Hashed Vite assets → cache-first (content-hashed filenames are immutable)
  if (pathname.startsWith(`${BASE_PATH}assets/`)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Dictionary assets → cache-first against the dedicated dict cache.
  // Version-pinned URLs never change content, so no revalidation is needed.
  // Must be checked before the generic .json rule below.
  if (pathname.startsWith(`${BASE_PATH}dict/`)) {
    event.respondWith(cacheFirst(request, DICT_CACHE));
    return;
  }

  // Content JSON → network-first (always try to get fresh data)
  if (pathname.startsWith(BASE_PATH) && pathname.endsWith(".json")) {
    event.respondWith(networkFirst(request, CONTENT_CACHE));
    return;
  }

  // Book cover images → stale-while-revalidate
  // Excludes PWA icons and apple-touch-icon which are already in shell pre-cache
  if (
    pathname.startsWith(BASE_PATH) &&
    /\.(jpg|jpeg|png|webp)$/i.test(pathname) &&
    !pathname.startsWith(`${BASE_PATH}icons/`) &&
    pathname !== `${BASE_PATH}apple-touch-icon-180.png`
  ) {
    event.respondWith(staleWhileRevalidate(request, CONTENT_CACHE));
    return;
  }

  // Everything else (manifest.webmanifest, icons, fonts, etc.) → bypass
  // The browser's HTTP cache handles these; no SW interception needed.
});
