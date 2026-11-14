// JLab Speak service worker — generated at build time; do not edit dist/sw.js directly.
// Own scope (/jlab-pages/speak/) so it wins over the Reader's worker, which would otherwise
// fall back to the Reader's index.html offline.

const SW_VERSION = "2026-11-14-05-04-04";
const BASE_PATH = "/jlab-pages/speak/";
const SHELL_CACHE = `speak-shell-${SW_VERSION}`;
const DICT_CACHE = "speak-dict-v1";

const SHELL_ASSETS = [
  "/jlab-pages/speak/index.html",
  "/jlab-pages/speak/manifest.webmanifest",
  "/jlab-pages/speak/apple-touch-icon-180.png",
  "/jlab-pages/speak/icons/icon-192.png",
  "/jlab-pages/speak/icons/icon-512.png",
  "/jlab-pages/speak/icons/icon-maskable-512.png",
  "/jlab-pages/speak/assets/index-CFdtdgNJ.js",
  "/jlab-pages/speak/assets/index-CTfso_kv.css",
  "/jlab-pages/speak/assets/kuromoji-BJh3Jl1v.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        await cache.addAll(SHELL_ASSETS);
      } catch (err) {
        console.warn("[speak-sw] shell pre-cache partial failure", err);
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("speak-shell-") && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Audio must never enter Cache Storage (Range requests; no offline audio in v1).
  if (request.destination === "audio" || request.destination === "video") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const { pathname } = url;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(`${BASE_PATH}index.html`)) ?? Response.error();
      }),
    );
    return;
  }

  // Hashed Vite assets are immutable.
  if (pathname.startsWith(`${BASE_PATH}assets/`)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // IPADIC files (~17 MB): fetched once, then served from cache. kuromoji gunzips them itself,
  // so a response the server already content-encoded is unusable: never cache one.
  if (pathname.startsWith(`${BASE_PATH}dict/`)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DICT_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && !response.headers.get("content-encoding")) await cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }
});
