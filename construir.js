/* Genera la copia por pedazos a partir de la app de verdad.
 *
 * La fuente sigue siendo app/index.html: ahí se edita la app, como siempre.
 * Esto saca su CSS y su código y los deja en p/app.txt, que es lo que el
 * arranque de p/index.html baja en pedazos de 20 KB.
 *
 * Correr después de CADA cambio en app/index.html:
 *     node construir.js
 *
 * Si no se corre, p/ se queda con la versión anterior. No se rompe nada:
 * simplemente los teléfonos que usen p/ no ven el cambio.
 */
const fs = require('fs');
const crypto = require('crypto');

const fuente = fs.readFileSync('app/index.html', 'utf8');

/* El CSS es el único bloque <style> del documento. */
const css = (fuente.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
if (!css) { console.error('no encontré el <style> en app/index.html'); process.exit(1); }

/* El código de la app es el bloque <script> más grande, por mucho: los
   otros dos son la red de seguridad del arranque y el registro del sw,
   que en la copia por pedazos no van. */
const bloques = [...fuente.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!bloques.length) { console.error('no encontré bloques <script>'); process.exit(1); }
const js = bloques.reduce((a, b) => (b.length > a.length ? b : a));
if (js.length < 50000) { console.error('el bloque más grande mide ' + js.length + ', no parece la app'); process.exit(1); }

const SEP = '\n/*==VQ==*/\n';
const carga = css + SEP + js;
const bytes = Buffer.byteLength(carga, 'utf8');
const version = crypto.createHash('sha1').update(carga).digest('hex').slice(0, 10);

fs.mkdirSync('p', { recursive: true });
fs.writeFileSync('p/app.txt', carga);
fs.writeFileSync('p/version.txt', version + '|' + bytes);
for (const f of ['icon.svg', 'manifest.webmanifest']) {
  if (fs.existsSync('app/' + f)) fs.copyFileSync('app/' + f, 'p/' + f);
}

console.log('p/app.txt   ', (bytes / 1024).toFixed(1), 'KB');
console.log('p/version   ', version);
console.log('pedazos de 20 KB:', Math.ceil(bytes / 20000));
