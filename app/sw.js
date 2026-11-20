/* Vapor QRO · guarda la app en el teléfono.
 *
 * Para qué existe: la app pesa ~114 KB y con datos malos no termina de
 * bajar, así que no abre. Esto la guarda la primera vez y de ahí en
 * adelante abre desde el teléfono, sin red. La señal solo hace falta para
 * traer los datos del Sheet, que son unos pocos KB.
 *
 * La trampa conocida de los service workers es dejar a los teléfonos
 * pegados para siempre en una versión vieja. Aquí no pasa: cada vez que se
 * abre, se sirve lo guardado Y se pide la versión nueva en segundo plano.
 * La próxima vez que abra, ya es la nueva. Nunca se queda esperando a la
 * red para abrir, y nunca se queda atorado en lo viejo.
 *
 * Lo de Google NO se guarda nunca: es de otro dominio y se deja pasar
 * derecho, porque los datos del negocio tienen que ser los de ahorita.
 */
var CACHE = 'vq-app-1';
var BASE = new URL('./', self.location).pathname;
var ARCHIVOS = ['./', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ARCHIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u;
  try { u = new URL(r.url); } catch (err) { return; }
  /* El script de Google vive en otro dominio: ni tocarlo. */
  if (u.origin !== self.location.origin) return;
  if (u.pathname.indexOf(BASE) !== 0) return;

  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(function (guardado) {
      var red = fetch(r).then(function (res) {
        if (res && res.ok) {
          var copia = res.clone();
          caches.open(CACHE).then(function (c) { c.put(r, copia); });
        }
        return res;
      }).catch(function () { return guardado; });
      /* Lo guardado primero: abrir al instante vale más que abrir al día. */
      return guardado || red;
    })
  );
});
