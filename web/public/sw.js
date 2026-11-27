// Breathprint's offline copy. Pages come from the network when it answers and
// from here when it doesn't. Hashed assets never change, so they come from here first.
// The forecast is kept by the app itself, so the API is left alone.
// scripts/build.ts stamps the two lines below with the build's id and files.
const BUILD = "dev";
const PRECACHE = [];
const CACHE = `breathprint-${BUILD}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") event.respondWith(page(request, url));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(asset(request));
});

/**
 * Each page is kept under its own address. Offline, a page never opened here
 * gets the front page's copy, and the app's router draws the right one.
 */
async function page(request, url) {
  const key = url.pathname.startsWith("/blog") ? "/blog/" : url.pathname;
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
      await cache.put(key, res.clone());
    }
    return res;
  } catch {
    return (await cache.match(key)) ?? (await cache.match("/")) ?? Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}
