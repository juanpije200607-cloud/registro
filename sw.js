/* Service worker de la versión de prueba: se autodestruye.
   La app nueva no usa service worker; el catálogo se guarda en el celular.
   Esto existe para que a los celulares que ya tenían la prueba instalada
   no se les quede servida la versión vieja desde el caché. */
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll(); })
      .then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); })
  );
});
