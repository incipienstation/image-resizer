"use strict";

const CACHE_NAME = "image-resizer-v5";
const ASSET_PATHS = [
  "./",
  "./index.html",
  "./style.css",
  "./scale-slider.css",
  "./app.js",
  "./scale-slider.js",
  "./manifest.webmanifest",
  "./icon.svg",
];
const ALLOWED_URLS = new Set(ASSET_PATHS.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_PATHS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || !ALLOWED_URLS.has(requestUrl.href)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});
