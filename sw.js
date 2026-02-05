const CACHE = "calorias-pwa-v3";
const ASSETS=["./","./index.html","./styles.css","./app.js","./foods.json","./manifest.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("fetch",e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
