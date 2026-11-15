/* Norte · service worker
   Guarda el armazón de la app para que abra sin internet.
   Las llamadas a la hoja (script.google.com) nunca se cachean. */

var CACHE = "norte-v1";
var SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  if (e.request.method !== "GET") return;
  if (url.hostname === "script.google.com" || url.hostname.indexOf("googleusercontent") !== -1) return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // refresca en segundo plano
        fetch(e.request).then(function (r) {
          if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, r.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (r) {
        if (r && r.ok && url.origin === location.origin) {
          var copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
        }
        return r;
      }).catch(function () {
        return caches.match("./index.html");
      });
    })
  );
});
