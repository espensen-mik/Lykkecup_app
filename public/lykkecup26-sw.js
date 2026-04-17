/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "lykkecup26-v1";
const CACHE_NAME = `lc26-cache-${CACHE_VERSION}`;
const APP_SHELL = ["/lykkecup26", "/lykkecup26.webmanifest", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lc26-cache-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Kun offentlige LykkeCup 26-sider + manifest.
  const isLc26Path = url.pathname === "/lykkecup26" || url.pathname.startsWith("/lykkecup26/");
  const isManifest = url.pathname === "/lykkecup26.webmanifest";
  if (!isLc26Path && !isManifest) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match("/lykkecup26"));
    }),
  );
});
