/* eslint-disable no-restricted-globals */
/** Teardown — erstatter ældre lykkecup26-sw.js. Ingen fetch-interception. */
const CACHE_PREFIX = "lc26-cache-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister()),
  );
});
