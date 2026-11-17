/* Vapor QRO · app de captura
   - La dirección del script y el PIN se guardan en el celular, no en el código.
   - Funciona sin señal: cada toque se encola con su folio y se sube después.
   - No hay precios ni costos aquí: bajan del Sheet. */

var LS = {
  url: 'vq.url', pin: 'vq.pin', cat: 'vq.cat', cola: 'vq.cola', quien: 'vq.quien'
};
var S = {
  rol: '', datos: null, tab: 'inicio',
  venta: { de: 'Maleta', mo: '', sas: [], pr: '1', pz: 1, mn: 0, fp: 'Efectivo', ef: 0, d: '' },
  res: { per: 'dia', dim: 'modelo', data: null, dia: '' }
};

var $ = function (s) { return document.querySelector(s); };
var el = function (t, c, x) {
  var n = document.createElement(t);
  if (c) n.className = c;
  if (x !== undefined) n.textContent = x;
  return n;
};
var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
var pesos = function (n) {
  return '$' + (Math.round(Number(n) || 0)).toLocaleString('es-MX');
};
var hoyISO = function () {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
};
var horaLocal = function () {
  var d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
var fechaBonita = function (iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return String(iso || '');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
};
var folio = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
};
function avisa(t) {
  var a = $('#aviso');
  a.textContent = t; a.classList.add('ver');
  clearTimeout(avisa.t);
  avisa.t = setTimeout(function () { a.classList.remove('ver'); }, 2200);
}
function hoja(contenido) {
  var h = $('#hoja'), i = $('#hojaIn');
  i.innerHTML = '';
  if (!contenido) { h.classList.remove('ver'); return; }
  i.appendChild(contenido);
  h.classList.add('ver');
}
$('#hoja').addEventListener('click', function (e) { if (e.target.id === 'hoja') hoja(null); });

/* ------------------------------------------------------------------ red */

function cola() { try { return JSON.parse(get(LS.cola) || '[]'); } catch (e) { return []; } }
function guardaCola(c) { set(LS.cola, JSON.stringify(c)); }

function encola(mov) {
  mov.f = mov.f || folio();
  /* Si el movimiento ya trae fecha (una venta de otro día), se respeta. */
  mov.d = mov.d || hoyISO();
  mov.h = mov.h || horaLocal();
  var c = cola(); c.push(mov); guardaCola(c);
  aplicaLocal(mov);
  sube();
}

/* Mueve el stock en la copia local para que la pantalla responda sin señal.
   Vale para todos los movimientos, no solo las ventas: si solo moviera
   ventas, un surtido se registraba pero la pantalla seguía igual y uno
   acababa apretando el botón dos veces. */
function lugarACampo(l) {
  return l === 'Casa' ? 'ca' : (l === 'Maleta' ? 'ma' : (l === 'Franco' ? 'fr' : ''));
}
function aplicaLocal(mov) {
  if (!S.datos || !S.datos.catalogo) return;
  var pz = Number(mov.pz) || 0;
  if (!pz || !mov.mo || !mov.sa) return;
  var de = lugarACampo(mov.de), ha = lugarACampo(mov.ha);
  S.datos.catalogo.forEach(function (r) {
    if (r.mo !== mov.mo || r.sa !== mov.sa) return;
    if (mov.t === 'Ajuste') { if (ha) r[ha] = pz; return; }
    if (de) r[de] = Math.max(0, r[de] - pz);
    if (ha) r[ha] = r[ha] + pz;
  });
  set(LS.cat, JSON.stringify(S.datos.catalogo));
}

var subiendo = false;
function sube() {
  if (subiendo || !navigator.onLine) { pinta(); return; }
  var c = cola();
  if (!c.length) { pinta(); return; }
  subiendo = true;
  var mov = c[0];
  var q = Object.keys(mov).map(function (k) {
    return k + '=' + encodeURIComponent(mov[k]);
  }).join('&');
  fetch(get(LS.url) + '?action=guardar&pin=' + encodeURIComponent(get(LS.pin)) + '&' + q)
    .then(function (r) { return r.json(); })
    .then(function (j) {
      subiendo = false;
      if (j && j.ok) {
        var c2 = cola(); c2.shift(); guardaCola(c2);
        if (c2.length) { sube(); return; }
        pinta();
        /* El Sheet tarda un momento en dejar ver lo que se acaba de
           escribir: si se baja de inmediato, la pantalla contesta con los
           números de antes y la venta recién hecha aparece en cero.
           Pasó el 17 nov en la primera prueba en vivo. Por eso se baja
           dos veces, y la segunda alcanza lo que la primera no vio.
           Se puede quitar la segunda cuando el script haga flush al
           guardar; mientras tanto, dos llamadas valen menos que una
           pantalla que parece haber perdido la venta. */
        setTimeout(function () { baja(true); }, 1200);
        setTimeout(function () { baja(true); }, 4500);
      } else { pinta(); }
    })
    .catch(function () { subiendo = false; pinta(); });
}
window.addEventListener('online', sube);

function baja(silencio) {
  if (!navigator.onLine) {
    if (S.datos) { if (!silencio) avisa('Sin señal'); }
    else pidePin('Sin señal. Conéctate y vuelve a entrar.');
    return;
  }
  var url = (get(LS.url) || '').trim().split('?')[0];
  fetch(url + '?pin=' + encodeURIComponent(get(LS.pin)))
    .then(function (r) {
      if (!r.ok) throw new Error('el servidor contestó ' + r.status);
      return r.text();
    })
    .then(function (t) {
      var j;
      try { j = JSON.parse(t); }
      catch (e) {
        throw new Error('la dirección no devolvió datos. Revisa que termine en /exec y que el script esté publicado para cualquier usuario');
      }
      if (!j.ok) {
        pidePin(j.error === 'pin' ? 'Ese PIN no es. Revísalo en Ajustes del Sheet.'
          : 'El script contestó un error: ' + (j.error || 'desconocido'));
        return;
      }
      S.rol = j.rol; S.datos = j;
      set(LS.cat, JSON.stringify(j.catalogo));
      pinta();
    })
    .catch(function (e) {
      if (S.datos) { if (!silencio) avisa('No se pudo actualizar'); }
      else pidePin('No se pudo conectar: ' + (e.message || 'falló la conexión'));
    });
}

function bajaResultados() {
  var iso = function (x) {
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' +
      String(x.getDate()).padStart(2, '0');
  };
  var desdeISO, hastaISO;
  if (S.res.per === 'dia') {
    desdeISO = hastaISO = (S.res.dia || hoyISO());
  } else {
    var d = new Date(), desde = new Date(d);
    desde.setDate(d.getDate() - (S.res.per === 'semana' ? 6 : 29));
    desdeISO = iso(desde); hastaISO = hoyISO();
  }
  fetch(get(LS.url) + '?action=resultados&pin=' + encodeURIComponent(get(LS.pin)) +
    '&desde=' + desdeISO + '&hasta=' + hastaISO)
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.ok) { S.res.data = j; pinta(); } })
    .catch(function () { avisa('No se pudieron traer los resultados'); });
}

/* ------------------------------------------------------------------ arranque */

function pidePin(msg) {
  var c = el('div', 'col g16');
  c.appendChild(el('h1', null, 'Registro'));
  if (msg) c.appendChild(el('div', 'sub', msg));

  c.appendChild(el('div', 'eti', 'Dirección del script'));
  var u = el('input', 'campo');
  u.type = 'url'; u.placeholder = 'https://script.google.com/...';
  u.value = get(LS.url) || '';
  u.style.fontSize = '14px';
  c.appendChild(u);
  c.appendChild(el('div', 'mini',
    'Se pega una vez por celular y se queda guardada. Tiene que terminar en /exec.'));
  c.u = u;

  c.appendChild(el('div', 'eti', 'Tu PIN'));
  var p = el('input', 'campo');
  p.type = 'tel'; p.inputMode = 'numeric'; p.placeholder = '····';
  c.appendChild(p);

  var b = el('button', 'b gde', 'Entrar');
  b.onclick = function () {
    var dir = (c.u.value || '').trim().split('?')[0];
    if (!dir) { avisa('Falta la dirección'); return; }
    if (dir.indexOf('/exec') < 0) { avisa('La dirección debe terminar en /exec'); return; }
    set(LS.url, dir);
    if (!p.value.trim()) { avisa('Falta el PIN'); return; }
    /* Entrar con un PIN borra lo que quedo del anterior: nadie debe ver,
       ni un instante, datos de la sesion de otro en el mismo telefono. */
    set(LS.cat, ''); set(LS.quien, '');
    S.datos = null; S.rol = ''; S.tab = 'inicio';
    vInventario.lugar = '';
    set(LS.pin, p.value.trim());
    $('#pantalla .wrap').innerHTML = '';
    $('#pantalla .wrap').appendChild(el('div', 'sub', 'Entrando…'));
    baja();
  };
  c.appendChild(b);

  $('#nav').innerHTML = '';
  $('#pantalla .wrap').innerHTML = '';
  $('#pantalla .wrap').appendChild(c);
}

/* JP le manda un link con la direccion del script adentro, para que
   Franco solo teclee su PIN y no tenga que pegar nada. */
function tomaDelLink() {
  var h = location.hash || '';
  var m = h.match(/[#&]s=([^&]+)/);
  if (!m) return;
  try {
    var dir = decodeURIComponent(m[1]).trim().split('?')[0];
    if (dir.indexOf('/exec') > 0) set(LS.url, dir);
  } catch (e) {}
  try { history.replaceState(null, '', location.pathname); } catch (e) { location.hash = ''; }
}

function arranca() {
  tomaDelLink();
  var cache = get(LS.cat);
  if (cache && cache.length > 2 && get(LS.pin) && get(LS.url) && get(LS.quien)) {
    try {
      S.datos = { catalogo: JSON.parse(cache), pendientes: [], hoy: {}, minimo: 1 };
      S.rol = get(LS.quien) || 'JP';
      pinta();
    } catch (e) {}
  }
  if (!get(LS.pin) || !get(LS.url)) { pidePin(''); return; }
  baja(true);
}

/* ------------------------------------------------------------------ pintar */

function pinta() {
  if (!S.datos) return;
  set(LS.quien, S.rol);
  var p = $('#pantalla .wrap');
  p.innerHTML = '';
  /* Solo al cambiar de pestaña: si se reiniciara en cada repintado,
     elegir un sabor te brincaría al inicio de la pantalla. */
  if (pinta.ultima !== S.tab) { $('#pantalla').scrollTop = 0; pinta.ultima = S.tab; }
  ({
    inicio: vInicio, venta: vVenta, pend: vPendientes,
    inv: vInventario, franco: vFranco, res: vResultados
  }[S.tab] || vInicio)(p);
  pintaNav();
}

function pintaNav() {
  var n = $('#nav');
  n.innerHTML = '';
  var tabs = (S.rol === 'Franco')
    ? [['inicio', '◎', 'Inicio'], ['venta', '＋', 'Venta'], ['inv', '▦', 'Mi stock']]
    : [['inicio', '◎', 'Inicio'], ['venta', '＋', 'Venta'], ['inv', '▦', 'Inventario'],
       ['franco', '◍', 'Franco'], ['res', '◴', 'Resultados']];
  tabs.forEach(function (t) {
    var b = el('button', S.tab === t[0] ? 'on' : '');
    b.appendChild(el('i', null, t[1]));
    b.appendChild(el('span', null, t[2]));
    b.onclick = function () {
      S.tab = t[0];
      if (t[0] === 'res' && !S.res.data) { pinta(); bajaResultados(); return; }
      pinta();
    };
    n.appendChild(b);
  });
}

function barraCola(p) {
  var c = cola();
  if (!c.length) return;
  var d = el('div', 'cola', c.length + (c.length === 1
    ? ' movimiento esperando señal' : ' movimientos esperando señal'));
  p.appendChild(d);
}

/* ------------------------------------------------------------------ inicio */

function vInicio(p) {
  var h = S.datos.hoy || {};
  var esJP = S.rol === 'JP';

  var cab = el('div', 'fila');
  var izq = el('div', 'col');
  izq.appendChild(el('h1', null, esJP ? 'Hoy' : 'Hola, Franco'));
  izq.appendChild(el('div', 'sub', new Date().toLocaleDateString('es-MX',
    { weekday: 'long', day: 'numeric', month: 'long' })));
  cab.appendChild(izq);
  var g = el('button', 'b chico', 'Ajustes');
  g.onclick = vAjustes;
  cab.appendChild(g);
  p.appendChild(cab);
  barraCola(p);

  /* lo del día */
  var c = el('div', 'card');
  c.appendChild(el('div', 'mini', esJP ? 'Utilidad de hoy' : 'Vendido hoy'));
  c.appendChild(el('div', 'num', pesos(esJP ? h.utilidad : h.ingresos)));
  p.appendChild(c);

  var k = el('div', 'kpis');
  [['Piezas', String(h.piezas || 0)],
   esJP ? ['Ingresos', pesos(h.ingresos)] : ['Tu comisión', pesos(h.comision)],
   esJP ? ['Tuyas / Franco', (h.mias || 0) + ' / ' + (h.franco || 0)]
        : ['Ingresos', pesos(h.ingresos)]]
    .filter(Boolean).forEach(function (x) {
      var d = el('div', 'kpi');
      d.appendChild(el('b', null, x[1]));
      d.appendChild(el('span', null, x[0]));
      k.appendChild(d);
    });
  p.appendChild(k);

  /* Franco: lo primero que necesita ver es lo que debe y lo que le llegó */
  if (!esJP) {
    var sfy = S.datos.saldoFranco || {};
    var cd = el('div', 'card');
    cd.appendChild(el('div', 'mini', 'Le debes a JP'));
    cd.appendChild(el('div', 'num', pesos(sfy.debe)));
    [['Piezas que has vendido', String(sfy.piezas || 0)],
     ['Tu comisión acumulada', pesos(sfy.comision)],
     ['Ya le entregaste', pesos(sfy.pagado)],
     sfy.porCobrar ? ['Te deben clientes', pesos(sfy.porCobrar)] : null]
      .filter(Boolean).forEach(function (x) {
        var ren = el('div', 'ren');
        ren.appendChild(el('div', 'mini', x[0]));
        ren.appendChild(el('div', 'tab-num', x[1]));
        cd.appendChild(ren);
      });
    p.appendChild(cd);

    var pc = S.datos.porConfirmar || [];
    if (pc.length) {
      var tot = pc.reduce(function (a, b) { return a + b.piezas; }, 0);
      p.appendChild(el('div', 'cap', 'JP te mandó ' + tot +
        (tot === 1 ? ' pieza' : ' piezas')));
      var gc = el('div', 'group');
      pc.forEach(function (x) {
        var ren = el('div', 'ren');
        var iz = el('div', 'col');
        iz.appendChild(el('div', null, x.sabor));
        iz.appendChild(el('div', 'mini', x.modelo + ' · ' + x.fecha + ' ' + x.hora));
        ren.appendChild(iz);
        ren.appendChild(el('div', 'tab-num', '×' + x.piezas));
        gc.appendChild(ren);
      });
      p.appendChild(gc);
      var fb = el('div', 'fila');
      fb.style.gap = '8px';
      var bf = el('button', 'b', 'Falta algo');
      bf.style.flex = '1';
      bf.onclick = function () { faltaAlgo(pc); };
      var br = el('button', 'b gde', 'Recibido');
      br.style.flex = '1.3';
      br.onclick = function () {
        pc.forEach(function (x) {
          encola({ t: 'Recibido', q: 'Franco', rf: x.folio, mo: x.modelo, sa: x.sabor,
                   pz: 0, no: 'Confirmado por Franco' });
        });
        S.datos.porConfirmar = [];
        avisa('Confirmado');
        pinta();
      };
      fb.appendChild(bf); fb.appendChild(br);
      p.appendChild(fb);
    }
  }

  /* ventas del día por hora */
  var horas = h.horas || [];
  var ch = el('div', 'card');
  ch.appendChild(el('div', 'fila', ''));
  var fh = ch.firstChild;
  fh.appendChild(el('div', 'mini', 'Ventas de hoy por hora'));
  fh.appendChild(el('div', 'mini', (h.piezas || 0) + ' piezas'));
  if (!horas.length) {
    ch.appendChild(el('div', 'mini', 'Todavía no hay ventas hoy.'));
  } else {
    var desde = 8, hasta = 23;
    horas.forEach(function (x) {
      var n = parseInt(x.h, 10);
      if (!isNaN(n)) { desde = Math.min(desde, n); hasta = Math.max(hasta, n); }
    });
    var mapa = {};
    horas.forEach(function (x) { mapa[parseInt(x.h, 10)] = x; });
    var max = 1;
    horas.forEach(function (x) { max = Math.max(max, x.piezas); });
    var barras = el('div', 'barras');
    var ejes = el('div', 'ejes');
    var ahora = new Date().getHours();
    for (var i = desde; i <= hasta; i++) {
      var x2 = mapa[i];
      var b = el('div', i === ahora ? 'hoy' : '');
      b.style.height = Math.round(100 * ((x2 ? x2.piezas : 0) / max)) + '%';
      b.title = i + ':00 · ' + (x2 ? x2.piezas + ' piezas · ' + pesos(x2.ingresos) : 'nada');
      barras.appendChild(b);
      var e = el('span', null, (i % 3 === 0 || i === ahora) ? String(i) : '');
      ejes.appendChild(e);
    }
    ch.appendChild(barras);
    ch.appendChild(ejes);
    var pico = horas.slice().sort(function (a, b2) { return b2.piezas - a.piezas; })[0];
    ch.appendChild(el('div', 'mini',
      'La hora más fuerte fue la de ' + parseInt(pico.h, 10) + ':00, con ' +
      pico.piezas + (pico.piezas === 1 ? ' pieza.' : ' piezas.')));
  }
  p.appendChild(ch);

  /* Últimos movimientos del día, agrupados por venta: una venta de tres
     sabores es un renglón, no tres. Tocarlo abre deshacer y editar. */
  var ventasHoy = agrupaVentas(h.ultimas);
  if (ventasHoy.length) {
    p.appendChild(el('div', 'cap', esJP ? 'Lo último de hoy' : 'Tus ventas de hoy'));
    var gu = el('div', 'group');
    ventasHoy.slice(0, esJP ? 5 : 8).forEach(function (g2) {
      var ren = el('button', 'ren');
      ren.style.cssText = 'width:100%; border:0; background:none; color:inherit; text-align:left';
      var iz = el('div', 'col');
      iz.appendChild(el('div', null, tituloVenta(g2)));
      iz.appendChild(el('div', 'mini', g2.hora +
        (esJP && g2.quien !== 'JP' ? ' · ' + g2.quien : '') +
        (g2.piezas > 1 ? ' · ' + g2.piezas + ' piezas' : '') +
        (g2.fp === 'Pendiente' ? ' · debe' : '')));
      ren.appendChild(iz);
      ren.appendChild(el('div', 'tab-num', pesos(g2.monto)));
      ren.onclick = function () { hojaVenta(g2); };
      gu.appendChild(ren);
    });
    p.appendChild(gu);
  }

  /* por cobrar: siempre a la vista, aunque esté en cero */
  var pend = (S.datos.pendientes || []);
  var total = pend.reduce(function (a, b) { return a + b.resta; }, 0);
  var atras = pend.filter(function (x) { return x.dias >= (S.datos.diasAtraso || 14); }).length;
  var cabp = el('div', 'fila');
  cabp.appendChild(el('div', 'cap', 'Por cobrar'));
  if (pend.length) {
    var pil = el('div', 'pill ' + (atras ? 'bad' : 'n'),
      atras ? atras + ' atrasados' : pend.length + ' ventas');
    cabp.appendChild(pil);
  }
  p.appendChild(cabp);

  var gp = el('div', 'group');
  if (!pend.length) {
    var vac = el('div', 'ren');
    vac.appendChild(el('div', 'mini', 'Nadie te debe. Así se ve cuando está limpio.'));
    gp.appendChild(vac);
  } else {
    var tot = el('div', 'ren');
    tot.appendChild(el('div', null, 'Te deben en total'));
    var tv = el('div', 'tab-num');
    tv.style.fontWeight = '700';
    tv.textContent = pesos(total);
    tot.appendChild(tv);
    gp.appendChild(tot);
    pend.slice(0, 3).forEach(function (x) {
      var ren = el('div', 'ren');
      var iz = el('div', 'col');
      iz.appendChild(el('div', null, x.cliente || 'Sin nombre'));
      var sub = el('div', 'mini', x.modelo.split(' ').slice(0, 2).join(' ') + ' · hace ' +
        x.dias + ' días' + (x.abonado ? ' · abonó ' + pesos(x.abonado) : ''));
      if (x.dias >= (S.datos.diasAtraso || 14)) sub.className = 'mini malo';
      iz.appendChild(sub);
      ren.appendChild(iz);
      ren.appendChild(el('div', 'tab-num', pesos(x.resta)));
      ren.onclick = function () { cobro(x); };
      gp.appendChild(ren);
    });
    var ver = el('div', 'ren');
    ver.appendChild(el('div', null, pend.length > 3
      ? 'Ver los ' + pend.length + ' y cobrar' : 'Cobrar'));
    ver.appendChild(el('div', 'mini', '›'));
    ver.onclick = function () { S.tab = 'pend'; pinta(); };
    gp.appendChild(ver);
  }
  p.appendChild(gp);

  /* pendientes de JP: maleta y Franco */
  if (esJP) {
    var falta = faltaMaleta();
    var gj = el('div', 'group');
    if (falta.length) {
      var ren1 = el('div', 'ren');
      var iz1 = el('div', 'col');
      var t1 = el('div', null, 'A la maleta le faltan ' +
        falta.reduce(function (a, b) { return a + b.n; }, 0) + ' piezas');
      t1.className = 'alerta';
      iz1.appendChild(t1);
      iz1.appendChild(el('div', 'mini', falta.slice(0, 2).map(function (x) {
        return x.sa + ' ×' + x.n;
      }).join(' · ') + (falta.length > 2 ? ' y ' + (falta.length - 2) + ' más' : '')));
      ren1.appendChild(iz1);
      ren1.appendChild(el('div', 'mini', '›'));
      ren1.onclick = rellenarMaleta;
      gj.appendChild(ren1);
    }
    var sf = S.datos.saldoFranco;
    if (sf) {
      var ren2 = el('div', 'ren');
      var iz2 = el('div', 'col');
      iz2.appendChild(el('div', null, 'Franco te debe'));
      iz2.appendChild(el('div', 'mini', sf.piezas + ' piezas vendidas' +
        (sf.porCobrar ? ' · ' + pesos(sf.porCobrar) + ' por cobrar a clientes' : '')));
      ren2.appendChild(iz2);
      var v2 = el('div', 'tab-num', pesos(sf.debe));
      v2.style.fontWeight = '600';
      ren2.appendChild(v2);
      ren2.onclick = function () { S.tab = 'franco'; pinta(); };
      gj.appendChild(ren2);
    }
    if (gj.childNodes.length) {
      p.appendChild(el('div', 'cap', 'Te toca'));
      p.appendChild(gj);
    }
  }

  var nv = el('button', 'b gde', 'Nueva venta');
  nv.onclick = function () { S.tab = 'venta'; pinta(); };
  p.appendChild(nv);
}

/* Meta de la maleta: 2 por sabor en Waka 33k/36k/15k/100k y Lana; 1 en Fasta y Elfbar */
function metaMaleta(modelo) {
  if (/Waka 30k/.test(modelo)) return 0;
  if (/Waka (33k|36k|15k|100k)|Lana/.test(modelo)) return 2;
  return 1;
}
function faltaMaleta() {
  var out = [];
  (S.datos.catalogo || []).forEach(function (r) {
    var m = metaMaleta(r.mo);
    if (r.ma < m && r.ca > 0) {
      out.push({ mo: r.mo, sa: r.sa, n: Math.min(m - r.ma, r.ca), ca: r.ca });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ venta */

function vVenta(p) {
  var v = S.venta;
  var ed = v.editando;
  p.appendChild(el('h1', null, ed ? 'Editar venta' : 'Venta'));
  barraCola(p);
  var w = el('div', 'col g16');
  w.style.marginTop = '14px';
  p.appendChild(w);

  if (ed) {
    var ce = el('div', 'card');
    var ct2 = el('div', 'alerta', 'Estás corrigiendo la venta de las ' + ed.hora +
      ' de ' + pesos(ed.monto) + '.');
    ce.appendChild(ct2);
    ce.appendChild(el('div', 'mini',
      'Al guardar se cancela la anterior y se registra esta en su lugar.'));
    var bsal = el('button', 'b chico', 'Dejarla como estaba');
    bsal.onclick = function () {
      S.venta = { de: 'Maleta', mo: '', sas: [], pr: '1', pz: 1, mn: 0,
                  fp: 'Efectivo', ef: 0, d: '' };
      S.tab = 'inicio';
      pinta();
    };
    ce.appendChild(bsal);
    w.appendChild(ce);
  }

  /* Día de la venta. Por defecto hoy; si es otro, se ve fuerte para que
     nadie capture a un día equivocado sin darse cuenta. */
  var dVenta = v.d || hoyISO();
  var esHoy = dVenta === hoyISO();
  var gd = el('div', esHoy ? 'fila' : 'card');
  var etq = el('div', esHoy ? 'mini' : null, esHoy
    ? 'Venta de hoy'
    : 'Venta del ' + fechaBonita(dVenta));
  if (!esHoy) etq.className = 'alerta';
  gd.appendChild(etq);
  var fdia = el('div', 'fila');
  fdia.style.gap = '6px';
  var inpD = el('input');
  inpD.type = 'date'; inpD.value = dVenta; inpD.max = hoyISO();
  inpD.className = 'b chico';
  inpD.style.cssText = 'min-width:132px; padding:8px 10px';
  inpD.onchange = function () { v.d = inpD.value || hoyISO(); pinta(); };
  fdia.appendChild(inpD);
  if (!esHoy) {
    var bh = el('button', 'b chico', 'Volver a hoy');
    bh.onclick = function () { v.d = ''; pinta(); };
    fdia.appendChild(bh);
  }
  gd.appendChild(fdia);
  w.appendChild(gd);

  if (S.rol === 'JP') {
    /* Uber no es un lugar donde viva el stock: la pieza sale de la maleta
       y el chofer solo entrega. Por eso se registra como venta desde
       Maleta a nombre de Uber, y lo que le pagas va aparte como gasto. */
    w.appendChild(grupo('Desde', ['Maleta', 'Casa', 'Uber'], v.de, function (x) {
      v.de = x; pinta();
    }));
  } else { v.de = 'Franco'; }

  var salidaReal = v.de === 'Uber' ? 'Maleta' : v.de;

  var modelos = [];
  (S.datos.catalogo || []).forEach(function (r) {
    if (modelos.indexOf(r.mo) < 0) modelos.push(r.mo);
  });
  var campo = lugarACampo(salidaReal) || 'ma';

  var gm = el('div', 'col g8');
  gm.appendChild(el('div', 'eti', 'Modelo'));
  var rej = el('div', 'rejilla');
  modelos.forEach(function (mo) {
    var n = (S.datos.catalogo || []).filter(function (r) { return r.mo === mo; })
      .reduce(function (a, r) { return a + r[campo]; }, 0);
    var b = el('button', 'b' + (v.mo === mo ? ' on' : '') + (n ? '' : ' cero'));
    b.appendChild(el('span', null, mo.replace(/ (Blade|Burst|Boost|Optimus|SoPro|Drop|Lush King|Plus)$/, '')));
    b.appendChild(el('span', 'mini', String(n)));
    b.onclick = function () { v.mo = mo; v.sas = []; pinta(); };
    rej.appendChild(b);
  });
  gm.appendChild(rej);
  w.appendChild(gm);

  if (!v.mo) return;

  var gp = el('div', 'col g8');
  gp.appendChild(el('div', 'eti', 'Cómo se vende'));
  var seg = el('div', 'seg');
  [['1', '1 pieza'], ['2x', '2× promo'], ['esp', 'Especial']].forEach(function (x) {
    var b = el('button', v.pr === x[0] ? 'on' : '', x[1]);
    b.onclick = function () {
      v.pr = x[0];
      v.pz = x[0] === '2x' ? 2 : (x[0] === 'esp' ? (v.pz || 1) : 1);
      if (x[0] !== '2x' && v.sas.length > 1) v.sas = [v.sas[0]];
      calcula();
      pinta();
    };
    seg.appendChild(b);
  });
  gp.appendChild(seg);
  w.appendChild(gp);

  var sabores = (S.datos.catalogo || []).filter(function (r) { return r.mo === v.mo; })
    .sort(function (a, b) { return b[campo] - a[campo]; });

  /* Cuántos sabores caben: 1 en unidad, 2 en el 2x, y en la especial
     tantos como piezas lleve la venta. Se puede repetir el mismo. */
  if (v.pr === 'esp') {
    var gpz = el('div', 'col g8');
    gpz.appendChild(el('div', 'eti', 'Cuántas piezas'));
    var fpz = el('div', 'fila');
    var menos = el('button', 'b', '−'); menos.style.minWidth = '58px';
    var cuenta = el('div', 'num', String(v.pz));
    cuenta.style.cssText = 'flex:1; text-align:center';
    var mas = el('button', 'b on', '+'); mas.style.minWidth = '58px';
    menos.onclick = function () {
      v.pz = Math.max(1, v.pz - 1);
      if (v.sas.length > v.pz) v.sas = v.sas.slice(0, v.pz);
      pinta();
    };
    mas.onclick = function () { v.pz = v.pz + 1; pinta(); };
    fpz.appendChild(menos); fpz.appendChild(cuenta); fpz.appendChild(mas);
    gpz.appendChild(fpz);
    w.appendChild(gpz);
  }

  var tope = v.pr === '2x' ? 2 : (v.pr === 'esp' ? v.pz : 1);
  var gs = el('div', 'col g6');
  gs.appendChild(el('div', 'eti', tope > 1
    ? 'Sabores · toca uno por pieza, repite si van iguales'
    : 'Sabor'));
  var li = el('div', 'col g6 lista');
  sabores.forEach(function (r) {
    var veces = v.sas.filter(function (x) { return x === r.sa; }).length;
    var b = el('button', 'b' + (veces ? ' on' : '') + (r[campo] ? '' : ' cero'));
    b.appendChild(el('span', null, r.sa));
    var der = el('span', 'mini', r[campo] ? String(r[campo]) : 'agotado');
    if (veces) der.textContent = '×' + veces + ' · quedan ' + (r[campo] || 0);
    b.appendChild(der);
    b.onclick = function () {
      if (tope === 1) { v.sas = [r.sa]; }
      else if (v.sas.length < tope) { v.sas.push(r.sa); }
      else { avisa('Ya elegiste ' + tope + '. Quítale a alguno abajo.'); return; }
      calcula();
      pinta();
    };
    li.appendChild(b);
  });
  gs.appendChild(li);
  w.appendChild(gs);

  if (!v.sas.length) return;

  /* los elegidos, para poder quitar sin adivinar */
  if (tope > 1) {
    w.appendChild(el('div', 'cap', 'Van en esta venta · ' + v.sas.length + ' de ' + tope));
    var ge2 = el('div', 'group');
    agrupaSabores(v.sas).forEach(function (gr) {
      var ren = el('div', 'ren');
      var iz = el('div', 'col');
      iz.appendChild(el('div', null, gr.sa));
      iz.appendChild(el('div', 'mini', gr.n + (gr.n === 1 ? ' pieza' : ' piezas')));
      ren.appendChild(iz);
      var q = el('button', 'b chico', 'Quitar');
      q.onclick = function () {
        var i = v.sas.lastIndexOf(gr.sa);
        if (i >= 0) v.sas.splice(i, 1);
        calcula(); pinta();
      };
      ren.appendChild(q);
      ge2.appendChild(ren);
    });
    w.appendChild(ge2);
    if (v.sas.length < tope) {
      var av2 = el('div', 'mini alerta');
      av2.textContent = v.pr === '2x'
        ? 'Si las dos piezas son del mismo sabor, así déjalo.'
        : 'Faltan ' + (tope - v.sas.length) + ' por elegir, o bájale a las piezas.';
      w.appendChild(av2);
    }
  }

  if (v.pr === 'esp') {
    var ge = el('div', 'card');
    var gpr = el('div', 'col g8');
    gpr.appendChild(el('div', 'eti', 'Precio total de la venta'));
    var inp = el('input', 'campo');
    inp.type = 'tel'; inp.inputMode = 'numeric'; inp.value = v.mn || '';
    inp.oninput = function () { v.mn = Number(inp.value) || 0; };
    gpr.appendChild(inp);
    var lista = precioLista();
    var dif = lista - (v.mn || 0);
    gpr.appendChild(el('div', 'mini', 'Precio de lista por ' + v.pz +
      (v.pz === 1 ? ' pieza' : ' piezas') + ': ' + pesos(lista) +
      (v.mn && dif > 0 ? ' · le bajas ' + pesos(dif) : '') +
      (v.mn && dif < 0 ? ' · le subes ' + pesos(-dif) : '')));
    ge.appendChild(gpr);
    w.appendChild(ge);
  } else {
    calcula();
    var ct = el('div', 'card');
    var ft = el('div', 'fila');
    ft.appendChild(el('div', 'mini', 'Total'));
    var tt = el('div', null, pesos(v.mn));
    tt.style.cssText = 'font:700 26px var(--f-d)';
    ft.appendChild(tt);
    ct.appendChild(ft);
    w.appendChild(ct);
  }

  /* Para Franco importa a quién le llegó la transferencia: si fue a JP,
     Franco no debe ese dinero. */
  var formas = S.rol === 'Franco'
    ? ['Efectivo', 'Nu', 'Transferencia a Franco', 'Mixto', 'Pendiente']
    : ['Efectivo', 'Nu', 'Mixto', 'Pendiente'];
  var nombres = {
    'Nu': S.rol === 'Franco' ? 'Transfer a JP' : 'Transfer',
    'Transferencia a Franco': 'Transfer a mí',
    'Pendiente': 'Debe'
  };
  w.appendChild(grupo('Cómo paga', formas, v.fp, function (x) {
    v.fp = x; pinta();
  }, nombres));

  if (v.fp === 'Mixto') {
    var gmx = el('div', 'col g8');
    gmx.appendChild(el('div', 'eti', 'Cuánto en efectivo'));
    var ie = el('input', 'campo');
    ie.type = 'tel'; ie.inputMode = 'numeric'; ie.value = v.ef || '';
    ie.oninput = function () { v.ef = Number(ie.value) || 0; };
    gmx.appendChild(ie);
    gmx.appendChild(el('div', 'mini', 'El resto se registra como transferencia.'));
    w.appendChild(gmx);
  }

  var extra = el('div', 'col g8');
  var mas2 = el('button', 'b chico', 'Más datos · cliente, envío, nota');
  mas2.onclick = vMasDatos;
  extra.appendChild(mas2);
  w.appendChild(extra);

  var reg = el('button', 'b gde', ed ? 'Guardar cambios'
    : (esHoy ? 'Registrar venta'
             : 'Registrar venta del ' + fechaBonita(dVenta)));
  reg.style.cssText = 'width:100%; margin-top:4px';
  reg.disabled = !v.mn && v.fp !== 'Pendiente';
  reg.onclick = function () {
    if (!v.mn) { avisa('Falta el precio'); return; }
    if (v.sas.length < 1) { avisa('Falta el sabor'); return; }
    var pr = v.pr === '2x' ? '2x' : (v.pr === 'esp' ? 'Especial' : 'Unidad');
    var grupos = agrupaSabores(v.sas);
    var piezasTotal = v.pr === '2x' ? 2 : (v.pr === 'esp' ? v.pz : 1);
    /* Si eligió menos sabores que piezas, las que faltan van del primero. */
    if (grupos.length === 1) grupos[0].n = piezasTotal;

    var nota = v.no || '';
    if (v.pr === 'esp') {
      var lista = precioLista();
      if (lista && lista !== v.mn) {
        nota = (nota ? nota + ' · ' : '') + 'precio especial, lista ' + pesos(lista);
      }
    }
    if (grupos.length > 1) {
      nota = (nota ? nota + ' · ' : '') + pr + ' de ' + grupos.length + ' sabores';
    }
    if (!esHoy) {
      nota = (nota ? nota + ' · ' : '') + 'capturada el ' + fechaBonita(hoyISO());
    }
    /* Editar: primero se cancela la vieja y después se registra la nueva.
       En ese orden, porque la cola sube en orden y el stock de la pantalla
       tiene que regresar antes de que la venta nueva lo vuelva a bajar. */
    if (ed) {
      nota = (nota ? nota + ' · ' : '') + 'corrige la venta de las ' + ed.hora;
      revierteLocal(ed);
      encolaCancelacion(ed, 'Corregida: se volvió a registrar · ' + pesos(ed.monto));
    }

    var efTotal = v.fp === 'Mixto' ? v.ef : (v.fp === 'Efectivo' ? v.mn : 0);
    var suma = grupos.reduce(function (a, g) { return a + g.n; }, 0) || 1;
    var montoRepartido = 0, efRepartido = 0;

    /* Ancla de la venta: el folio de la primera fila, que todas llevan en
       Ref folio. Es lo que permite deshacerla completa después. */
    var ancla = folio();

    grupos.forEach(function (g, i) {
      var ultimo = i === grupos.length - 1;
      /* El último se lleva el redondeo, así los pesos cuadran exactos. */
      var mn = ultimo ? (v.mn - montoRepartido) : Math.round(v.mn * g.n / suma);
      var ef = ultimo ? (efTotal - efRepartido) : Math.round(efTotal * g.n / suma);
      montoRepartido += mn; efRepartido += ef;
      encola({
        f: i === 0 ? ancla : undefined, rf: ancla,
        t: 'Venta', q: v.de === 'Uber' ? 'Uber' : S.rol, mo: v.mo, sa: g.sa, pr: pr,
        d: dVenta, pz: g.n, mn: mn, ef: ef, fp: v.fp,
        cl: v.cl || '', en: i === 0 ? (v.en || 0) : 0, no: nota,
        de: salidaReal, ha: 'Cliente'
      });
    });

    if (v.de === 'Uber' && Number(v.uber) > 0) {
      encola({ t: 'Gasto', q: 'Uber', mn: Number(v.uber),
               no: 'Entrega en Uber' + (v.cl ? ' a ' + v.cl : '') });
    }

    avisa(ed ? 'Venta corregida'
             : (grupos.length > 1 ? 'Venta registrada, ' + grupos.length + ' sabores'
                                  : 'Venta registrada'));
    S.venta = { de: v.de, mo: '', sas: [], pr: '1', pz: 1, mn: 0,
                fp: 'Efectivo', ef: 0, d: esHoy ? '' : dVenta };
    S.tab = 'inicio';
    pinta();
  };
  w.appendChild(reg);
}

/* Agrupa ['A','B','A'] en [{sa:'A',n:2},{sa:'B',n:1}] */
function agrupaSabores(lista) {
  var orden = [], m = {};
  lista.forEach(function (x) {
    if (!m[x]) { m[x] = { sa: x, n: 0 }; orden.push(m[x]); }
    m[x].n++;
  });
  return orden;
}

/* ------------------------------------------------- deshacer y editar */

/* Las filas de una misma venta comparten ancla: el folio de la primera,
   que todas traen en Ref folio. Una fila sin ancla es una venta de una
   sola fila (así se registraban antes de esta regla). */
function agrupaVentas(lista) {
  var orden = [], m = {};
  (lista || []).forEach(function (u) {
    var a = u.rf || u.folio;
    if (!m[a]) {
      m[a] = { ancla: a, filas: [], piezas: 0, monto: 0 };
      orden.push(m[a]);
    }
    m[a].filas.push(u);
    m[a].piezas += Number(u.piezas) || 0;
    m[a].monto += Number(u.monto) || 0;
  });
  orden.forEach(function (g) {
    var p0 = g.filas[0];
    g.hora = p0.hora; g.quien = p0.quien; g.modelo = p0.modelo;
    g.pr = p0.pr; g.fp = p0.fp; g.cl = p0.cl || '';
    g.de = p0.de || ''; g.fecha = p0.fecha || '';
  });
  return orden;
}

function tituloVenta(g) {
  var corto = String(g.modelo || '').split(' ').slice(0, 2).join(' ');
  var pre = g.pr === '2x' ? '2× ' : '';
  if (g.filas.length === 1) return pre + corto + ' · ' + g.filas[0].sabor;
  return pre + corto + ' · ' + g.filas.length + ' sabores';
}

/* El stock vuelve a la pantalla al instante. La cancelación viaja como un
   solo movimiento sin piezas, así que aquí se revierte fila por fila. */
function revierteLocal(g) {
  g.filas.forEach(function (x) {
    if (x.de) {
      aplicaLocal({ t: 'Cancelación', mo: x.modelo, sa: x.sabor,
                    pz: Number(x.piezas) || 0, ha: x.de });
    }
  });
  var h = S.datos.hoy || {};
  h.piezas = Math.max(0, (h.piezas || 0) - g.piezas);
  h.ingresos = (h.ingresos || 0) - g.monto;
  if (g.quien === 'Franco') h.franco = Math.max(0, (h.franco || 0) - g.piezas);
  else h.mias = Math.max(0, (h.mias || 0) - g.piezas);
  if (S.rol === 'JP' && h.utilidad !== undefined) {
    /* Aproximación sin comisión: el número exacto llega con la siguiente
       bajada, en cuanto la cola termine de subir. */
    var costos = S.datos.costos || {};
    var ut = 0;
    g.filas.forEach(function (x) {
      ut += (Number(x.monto) || 0) -
            (Number(costos[x.modelo]) || 0) * (Number(x.piezas) || 0);
    });
    h.utilidad = (h.utilidad || 0) - ut;
  }
  h.ultimas = (h.ultimas || []).filter(function (u) {
    return (u.rf || u.folio) !== g.ancla;
  });
  var ids = {};
  g.filas.forEach(function (x) { ids[x.folio] = true; });
  S.datos.pendientes = (S.datos.pendientes || []).filter(function (x) {
    return !ids[x.folio];
  });
}

function encolaCancelacion(g, nota) {
  encola({ t: 'Cancelación', rf: g.ancla, q: S.rol, no: nota });
}

/* Se puede deshacer si el script publicado ya lo sabe hacer (v >= 2) y la
   venta es de hoy. Un botón que no está es mejor que uno que dice que
   canceló sin haber cancelado nada. */
function sePuedeDeshacer(g) {
  if (Number((S.datos || {}).v || 0) < 2) return 'script';
  if (g.fecha && g.fecha !== hoyISO()) return 'dia';
  return '';
}

function hojaVenta(g) {
  var w = el('div', 'col g12');
  w.appendChild(el('h1', null, 'Venta de las ' + g.hora));
  var c = el('div', 'card');
  g.filas.forEach(function (x) {
    var ren = el('div', 'ren');
    var iz = el('div', 'col');
    iz.appendChild(el('div', null,
      String(x.modelo).split(' ').slice(0, 2).join(' ') + ' · ' + x.sabor));
    iz.appendChild(el('div', 'mini',
      x.piezas + (x.piezas === 1 ? ' pieza' : ' piezas')));
    ren.appendChild(iz);
    ren.appendChild(el('div', 'tab-num', pesos(x.monto)));
    c.appendChild(ren);
  });
  var tot = el('div', 'ren');
  tot.appendChild(el('div', null, 'Total'));
  var tv = el('div', 'tab-num');
  tv.style.fontWeight = '700';
  tv.textContent = pesos(g.monto);
  tot.appendChild(tv);
  c.appendChild(tot);
  c.appendChild(el('div', 'mini',
    (g.pr === '2x' ? '2× promo · ' : (g.pr === 'Especial' ? 'Especial · ' : '')) +
    (g.fp === 'Pendiente' ? 'queda a deber' : g.fp) +
    (g.cl ? ' · ' + g.cl : '') + (g.de ? ' · salió de ' + g.de : '')));
  w.appendChild(c);

  var no = sePuedeDeshacer(g);
  if (no) {
    w.appendChild(el('div', 'mini', no === 'dia'
      ? 'Solo se deshacen las ventas de hoy. Esta es de otro día: se arregla en el Sheet.'
      : 'Falta publicar la versión nueva del script para poder deshacer desde aquí.'));
    var cr = el('button', 'b gde', 'Cerrar');
    cr.onclick = function () { hoja(null); };
    w.appendChild(cr);
    hoja(w);
    return;
  }

  var bd = el('button', 'b gde', 'Deshacer esta venta');
  bd.style.background = 'var(--bad)';
  bd.style.color = '#fff';
  bd.onclick = function () { confirmaDeshacer(g); };
  w.appendChild(bd);
  var be = el('button', 'b', 'Editarla');
  be.onclick = function () { hoja(null); abreEdicion(g); };
  w.appendChild(be);
  hoja(w);
}

function confirmaDeshacer(g) {
  var w = el('div', 'col g12');
  w.appendChild(el('h1', null, '¿Deshacer?'));
  w.appendChild(el('div', 'sub', 'Se cancela la venta de ' + pesos(g.monto) +
    ' y ' + (g.piezas === 1 ? 'una pieza regresa' : g.piezas + ' piezas regresan') +
    ' al inventario. No se borra nada: queda el rastro de que se deshizo.'));
  var si = el('button', 'b gde', 'Sí, deshacer');
  si.style.background = 'var(--bad)';
  si.style.color = '#fff';
  si.onclick = function () {
    hoja(null);
    revierteLocal(g);
    encolaCancelacion(g, 'Deshecha la venta de las ' + g.hora + ' · ' + pesos(g.monto));
    avisa('Venta deshecha');
    S.tab = 'inicio';
    pinta();
  };
  w.appendChild(si);
  var mn = el('button', 'b', 'Mejor no');
  mn.onclick = function () { hoja(null); };
  w.appendChild(mn);
  hoja(w);
}

/* Editar es deshacer y volver a registrar, no corregir en su lugar: un
   solo camino de código y el historial cuenta lo que de verdad pasó. */
function abreEdicion(g) {
  var sas = [];
  g.filas.forEach(function (x) {
    for (var i = 0; i < (Number(x.piezas) || 0); i++) sas.push(x.sabor);
  });
  S.venta = {
    editando: g,
    de: g.quien === 'Uber' ? 'Uber' : (g.de || 'Maleta'),
    mo: g.modelo,
    sas: sas,
    pr: g.pr === '2x' ? '2x' : (g.pr === 'Especial' ? 'esp' : '1'),
    pz: g.piezas,
    mn: g.monto,
    fp: g.fp || 'Efectivo',
    ef: g.filas.reduce(function (a, x) { return a + (Number(x.ef) || 0); }, 0),
    en: g.filas.reduce(function (a, x) { return a + (Number(x.en) || 0); }, 0),
    cl: g.cl || '',
    no: '',
    d: ''
  };
  S.tab = 'venta';
  pinta();
}

function precioLista() {
  var v = S.venta;
  var r = (S.datos.catalogo || []).filter(function (x) {
    return x.mo === v.mo && x.sa === (v.sas[0] || '');
  })[0];
  if (!r) return 0;
  if (v.pr === '2x') return r.p2;
  if (v.pr === 'esp') return Math.floor(v.pz / 2) * r.p2 + (v.pz % 2) * r.p1;
  return r.p1;
}
function calcula() {
  var v = S.venta;
  if (v.pr === 'esp') return;
  v.mn = precioLista();
  v.pz = v.pr === '2x' ? 2 : 1;
}

function grupo(titulo, ops, sel, cb, nombres) {
  var g = el('div', 'col g8');
  g.appendChild(el('div', 'eti', titulo));
  var f = el('div', 'fila g6');
  f.style.cssText = 'gap:6px; flex-wrap:wrap';
  ops.forEach(function (o) {
    var b = el('button', 'b chico' + (sel === o ? ' on' : ''),
      (nombres && nombres[o]) ? nombres[o] : o);
    b.style.cssText = 'flex:1 1 auto; min-width:72px';
    b.onclick = function () { cb(o); };
    f.appendChild(b);
  });
  g.appendChild(f);
  return g;
}

function vMasDatos() {
  var v = S.venta;
  var c = el('div', 'col g16');
  c.appendChild(el('h1', null, 'Más datos'));
  var campos = [['cl', 'Cliente', 'text'], ['en', 'Envío cobrado', 'tel'], ['no', 'Nota', 'text']];
  if (v.de === 'Uber') campos.splice(2, 0, ['uber', 'Lo que le pagas al chofer', 'tel']);
  campos.forEach(function (x) {
      var g = el('div', 'col g8');
      g.appendChild(el('div', 'eti', x[1]));
      var i = el('input', 'campo');
      i.type = x[2]; i.value = v[x[0]] || '';
      i.oninput = function () { v[x[0]] = x[2] === 'tel' ? (Number(i.value) || 0) : i.value; };
      g.appendChild(i);
      c.appendChild(g);
    });
  var b = el('button', 'b gde', 'Listo');
  b.onclick = function () { hoja(null); pinta(); };
  c.appendChild(b);
  hoja(c);
}

/* Si lo que le llego no cuadra, Franco lo dice con sus palabras y JP lo ve.
   No se toca el inventario: lo corrige JP con un ajuste por conteo. */
function faltaAlgo(pc) {
  var d = { txt: '' };
  var c = el('div', 'col g16');
  c.appendChild(el('h1', null, 'Falta algo'));
  c.appendChild(el('div', 'mini',
    'Escribe qué no llegó o qué llegó de más. JP lo ve y lo corrige; el stock no se mueve con esto.'));
  var i = el('input', 'campo');
  i.type = 'text';
  i.placeholder = 'Ej. faltó 1 Mojito Mint';
  i.oninput = function () { d.txt = i.value; };
  c.appendChild(i);
  var b = el('button', 'b gde', 'Avisarle a JP');
  b.onclick = function () {
    if (!d.txt.trim()) { avisa('Escribe qué pasó'); return; }
    pc.forEach(function (x) {
      encola({ t: 'Recibido', q: 'Franco', rf: x.folio, mo: x.modelo, sa: x.sabor,
               pz: 0, no: 'Franco reporta: ' + d.txt.trim() });
    });
    S.datos.porConfirmar = [];
    hoja(null); avisa('Avisado'); pinta();
  };
  c.appendChild(b);
  hoja(c);
}

/* ------------------------------------------------------------------ pendientes */

function vPendientes(p) {
  var pend = S.datos.pendientes || [];
  p.appendChild(el('h1', null, 'Pendientes'));
  p.appendChild(el('div', 'sub', pesos(pend.reduce(function (a, b) { return a + b.resta; }, 0)) +
    ' por cobrar · ' + pend.length + ' ventas'));
  barraCola(p);

  var w = el('div', 'col g8');
  w.style.marginTop = '14px';
  pend.forEach(function (x) {
    var atras = x.dias >= (S.datos.diasAtraso || 14);
    var c = el('div', 'card' + (atras ? ' mal' : ''));
    var f = el('div', 'fila');
    var n = el('div', null, x.cliente || 'Sin nombre');
    n.style.cssText = 'font-size:15px; font-weight:600';
    f.appendChild(n);
    var m = el('div', null, pesos(x.resta));
    m.style.cssText = 'font-size:16px; font-weight:700';
    f.appendChild(m);
    c.appendChild(f);
    var f2 = el('div', 'fila');
    f2.style.marginTop = '6px';
    f2.appendChild(el('div', 'mini', x.modelo + ' · ' + x.sabor + ' · ' + x.quien));
    var d = el('div', 'mini', 'hace ' + x.dias + ' días');
    if (atras) d.style.color = 'var(--bad)';
    f2.appendChild(d);
    c.appendChild(f2);
    if (x.abonado) {
      var bar = el('div');
      bar.style.cssText = 'height:5px; border-radius:3px; background:var(--line); margin-top:9px; overflow:hidden';
      var in2 = el('div', 'barra');
      in2.style.cssText = 'height:5px; width:' + Math.round(100 * x.abonado / x.total) + '%';
      bar.appendChild(in2);
      c.appendChild(bar);
      c.appendChild(el('div', 'mini', 'Abonó ' + pesos(x.abonado) + ' · restan ' + pesos(x.resta)));
    }
    c.onclick = function () { cobro(x); };
    w.appendChild(c);
  });
  if (!pend.length) w.appendChild(el('div', 'sub', 'Nadie te debe.'));
  p.appendChild(w);
}

function cobro(x) {
  var modo = { parcial: false, ef: x.resta, nu: 0 };
  function dibuja() {
    var c = el('div', 'col g16');
    var f = el('div', 'fila');
    var t = el('div', null, 'Cobrar a ' + (x.cliente || 'este cliente'));
    t.style.cssText = 'font-size:17px; font-weight:700';
    f.appendChild(t);
    f.appendChild(el('div', 'sub', 'debe ' + pesos(x.resta)));
    c.appendChild(f);

    var seg = el('div', 'fila');
    seg.style.gap = '7px';
    [['Liquidar todo', false], ['Abonar parte', true]].forEach(function (o) {
      var b = el('button', 'b' + (modo.parcial === o[1] ? ' on' : ''), o[0]);
      b.style.flex = '1';
      b.onclick = function () {
        modo.parcial = o[1];
        if (!o[1]) { modo.ef = x.resta; modo.nu = 0; }
        else { modo.ef = 0; modo.nu = 0; }
        hoja(null); dibuja();
      };
      seg.appendChild(b);
    });
    c.appendChild(seg);

    c.appendChild(el('div', 'eti', 'Cuánto y cómo'));
    var fil = el('div', 'fila');
    fil.style.gap = '8px';
    [['Efectivo', 'ef'], ['Nu', 'nu']].forEach(function (o) {
      var g = el('div', 'col g6');
      g.style.flex = '1';
      g.appendChild(el('div', 'mini', o[0]));
      var i = el('input', 'campo');
      i.type = 'tel'; i.inputMode = 'numeric'; i.value = modo[o[1]] || '';
      i.oninput = function () { modo[o[1]] = Number(i.value) || 0; resto(); };
      g.appendChild(i);
      fil.appendChild(g);
    });
    c.appendChild(fil);
    var av = el('div', 'mini', '');
    c.appendChild(av);
    function resto() {
      var falta = x.resta - (modo.ef + modo.nu);
      av.textContent = falta > 0
        ? 'Después de este cobro le quedan ' + pesos(falta) + '.'
        : (falta < 0 ? 'Eso es más de lo que debe.' : 'Con esto queda liquidado.');
    }
    resto();

    var b = el('button', 'b gde', 'Registrar cobro');
    b.onclick = function () {
      var total = modo.ef + modo.nu;
      if (total <= 0) { avisa('Falta el monto'); return; }
      if (total > x.resta) { avisa('Es más de lo que debe'); return; }
      encola({
        t: 'Cobro de pendiente', q: S.rol, rf: x.folio, cl: x.cliente,
        mn: total, ef: modo.ef,
        fp: modo.ef && modo.nu ? 'Mixto' : (modo.ef ? 'Efectivo' : 'Nu'),
        no: total < x.resta ? 'Abono parcial' : 'Liquidado'
      });
      x.abonado += total; x.resta -= total;
      if (x.resta <= 0) {
        S.datos.pendientes = S.datos.pendientes.filter(function (y) { return y.folio !== x.folio; });
      }
      hoja(null);
      avisa(total < x.resta + total ? 'Cobro registrado' : 'Liquidado');
      pinta();
    };
    c.appendChild(b);
    hoja(c);
  }
  dibuja();
}

/* ------------------------------------------------------------------ inventario */

function vInventario(p) {
  if (S.rol === 'Franco') vInventario.lugar = 'fr';
  else if (!vInventario.lugar || vInventario.lugar === 'fr') vInventario.lugar = 'ca';
  var lugar = vInventario.lugar;
  p.appendChild(el('h1', null, S.rol === 'Franco' ? 'Mi stock' : 'Inventario'));
  barraCola(p);

  if (S.rol === 'JP') {
    var seg = el('div', 'seg');
    seg.style.margin = '12px 0';
    [['ca', 'Casa'], ['ma', 'Maleta'], ['fr', 'Franco']].forEach(function (o) {
      var b = el('button', lugar === o[0] ? 'on' : '', o[1]);
      b.onclick = function () { vInventario.lugar = o[0]; pinta(); };
      seg.appendChild(b);
    });
    p.appendChild(seg);

    if (lugar === 'ma') {
      var falta = faltaMaleta();
      if (falta.length) {
        var cm = el('div', 'card ac');
        cm.style.marginBottom = '12px';
        var t = el('div', null, 'Faltan ' + falta.reduce(function (a, b) { return a + b.n; }, 0) + ' piezas');
        t.style.cssText = 'font-size:15px; font-weight:600; color:var(--warn)';
        cm.appendChild(t);
        cm.appendChild(el('div', 'mini', falta.map(function (x) {
          return x.mo.split(' ')[0] + ' ' + x.mo.split(' ')[1] + ' ' + x.sa + ' ×' + x.n;
        }).join(' · ')));
        var b = el('button', 'b gde', 'Rellenar la maleta');
        b.style.cssText = 'width:100%; margin-top:10px; min-height:44px; font-size:14px';
        b.onclick = rellenarMaleta;
        cm.appendChild(b);
        p.appendChild(cm);
      }
    }
  }

  var modelos = [];
  (S.datos.catalogo || []).forEach(function (r) {
    if (modelos.indexOf(r.mo) < 0) modelos.push(r.mo);
  });
  var total = (S.datos.catalogo || []).reduce(function (a, r) { return a + r[lugar]; }, 0);
  p.appendChild(el('div', 'eti', total + ' piezas'));

  var w = el('div', 'col g8');
  w.style.marginTop = '8px';
  modelos.forEach(function (mo) {
    var sab = (S.datos.catalogo || []).filter(function (r) { return r.mo === mo; });
    var n = sab.reduce(function (a, r) { return a + r[lugar]; }, 0);
    var c = el('div', 'card');
    var f = el('div', 'fila');
    var t = el('div', null, mo);
    t.style.cssText = 'font-size:15px; font-weight:600';
    f.appendChild(t);
    f.appendChild(el('div', 'sub', n + (vInventario.abierto === mo ? ' ⌄' : ' ›')));
    c.appendChild(f);
    if (vInventario.abierto === mo) {
      sab.sort(function (a, b) { return b[lugar] - a[lugar]; }).forEach(function (r) {
        var ren = el('div', 'ren');
        var s = el('div', null, r.sa);
        var v = el('div', null, String(r[lugar]));
        if (!r[lugar]) { s.style.color = 'var(--bad)'; v.style.color = 'var(--bad)'; v.textContent = '0'; }
        ren.appendChild(s); ren.appendChild(v);
        c.appendChild(ren);
      });
    }
    c.onclick = function () {
      vInventario.abierto = vInventario.abierto === mo ? '' : mo;
      pinta();
    };
    w.appendChild(c);
  });
  p.appendChild(w);

  if (S.rol === 'JP') {
    var fb = el('div', 'fila g8');
    fb.style.cssText = 'gap:8px; margin-top:12px';
    [['Entrada de proveedor', 'Compra a proveedor'], ['Ajuste por conteo', 'Ajuste']]
      .forEach(function (o) {
        var b = el('button', 'b', o[0]);
        b.style.flex = '1';
        b.onclick = function () { vMovimiento(o[1]); };
        fb.appendChild(b);
      });
    p.appendChild(fb);
  }
}

function vMovimiento(tipo) {
  var d = { mo: '', sa: '', pz: 1, mn: 0, ha: tipo === 'Ajuste' ? 'Casa' : 'Casa' };
  var modelos = [];
  (S.datos.catalogo || []).forEach(function (r) {
    if (modelos.indexOf(r.mo) < 0) modelos.push(r.mo);
  });
  function dibuja() {
    var c = el('div', 'col g16');
    c.appendChild(el('h1', null, tipo));
    var sm = el('select', 'campo');
    sm.appendChild(el('option', null, 'Elige modelo'));
    modelos.forEach(function (m) {
      var o = el('option', null, m); o.value = m;
      if (d.mo === m) o.selected = true;
      sm.appendChild(o);
    });
    sm.onchange = function () { d.mo = sm.value; d.sa = ''; hoja(null); dibuja(); };
    c.appendChild(sm);

    if (d.mo) {
      var ss = el('select', 'campo');
      ss.appendChild(el('option', null, 'Elige sabor'));
      (S.datos.catalogo || []).filter(function (r) { return r.mo === d.mo; })
        .forEach(function (r) {
          var o = el('option', null, r.sa); o.value = r.sa;
          if (d.sa === r.sa) o.selected = true;
          ss.appendChild(o);
        });
      ss.onchange = function () { d.sa = ss.value; };
      c.appendChild(ss);
    }

    if (tipo === 'Ajuste') {
      c.appendChild(grupo('En qué lugar contaste', ['Casa', 'Maleta', 'Franco'], d.ha,
        function (x) { d.ha = x; hoja(null); dibuja(); }));
    }

    var g = el('div', 'col g8');
    g.appendChild(el('div', 'eti', tipo === 'Ajuste' ? 'Piezas que contaste' : 'Piezas que llegaron'));
    var i = el('input', 'campo');
    i.type = 'tel'; i.inputMode = 'numeric'; i.value = d.pz;
    i.oninput = function () { d.pz = Number(i.value) || 0; };
    g.appendChild(i);
    c.appendChild(g);

    if (tipo !== 'Ajuste') {
      var g2 = el('div', 'col g8');
      g2.appendChild(el('div', 'eti', 'Lo que pagaste (opcional)'));
      var i2 = el('input', 'campo');
      i2.type = 'tel'; i2.inputMode = 'numeric';
      i2.oninput = function () { d.mn = Number(i2.value) || 0; };
      g2.appendChild(i2);
      c.appendChild(g2);
    }

    var b = el('button', 'b gde', 'Registrar');
    b.onclick = function () {
      if (!d.mo || !d.sa) { avisa('Falta modelo o sabor'); return; }
      encola({
        t: tipo, q: 'JP', mo: d.mo, sa: d.sa, pz: d.pz, mn: d.mn,
        de: tipo === 'Ajuste' ? '' : 'Proveedor', ha: d.ha,
        no: tipo === 'Ajuste' ? 'Ajuste por conteo en ' + d.ha : ''
      });
      hoja(null); avisa('Registrado'); baja(true);
    };
    c.appendChild(b);
    hoja(c);
  }
  dibuja();
}

/* La app propone, JP confirma pieza por pieza: nada se mueve sin que él
   diga qué sí metió a la maleta y qué no. */
function rellenarMaleta() {
  var falta = faltaMaleta();
  var sel = {};
  falta.forEach(function (x) { sel[x.mo + '|' + x.sa] = x.n; });

  function dibuja() {
    var c = el('div', 'col g12');
    c.appendChild(el('h1', null, 'Rellenar la maleta'));
    c.appendChild(el('div', 'mini',
      'Ya traen la cantidad que falta. Bájale o súbele a lo que de verdad metiste.'));
    var cuerpo = el('div', 'col g6');
    cuerpo.style.cssText = 'max-height:48vh; overflow-y:auto';
    falta.forEach(function (x) {
      var k = x.mo + '|' + x.sa;
      var ren = el('div', 'ren');
      var izq = el('div', 'col');
      izq.appendChild(el('div', null, x.sa));
      izq.appendChild(el('div', 'mini', x.mo + ' · ' + x.ca + ' en casa'));
      ren.appendChild(izq);
      var f = el('div', 'fila');
      f.style.gap = '8px';
      var menos = el('button', 'b chico', '−'); menos.style.minWidth = '38px';
      var num = el('div', null, String(sel[k]));
      num.style.cssText = 'min-width:22px; text-align:center; font-weight:600';
      var mas = el('button', 'b chico', '+'); mas.style.minWidth = '38px';
      menos.onclick = function () { sel[k] = Math.max(0, sel[k] - 1); hoja(null); dibuja(); };
      mas.onclick = function () { sel[k] = Math.min(x.ca, sel[k] + 1); hoja(null); dibuja(); };
      f.appendChild(menos); f.appendChild(num); f.appendChild(mas);
      ren.appendChild(f);
      cuerpo.appendChild(ren);
    });
    c.appendChild(cuerpo);

    var n = Object.keys(sel).reduce(function (a, k) { return a + sel[k]; }, 0);
    var b = el('button', 'b gde', n ? 'Pasé ' + n + ' piezas a la maleta' : 'No metí nada');
    b.disabled = !n;
    b.onclick = function () {
      Object.keys(sel).forEach(function (k) {
        if (!sel[k]) return;
        var pz = k.split('|');
        encola({ t: 'Surtido', q: 'JP', mo: pz[0], sa: pz[1], pz: sel[k], de: 'Casa', ha: 'Maleta' });
      });
      hoja(null); avisa('Maleta actualizada'); pinta();
    };
    c.appendChild(b);
    hoja(c);
  }
  if (!falta.length) { avisa('La maleta está completa'); return; }
  dibuja();
}

/* ------------------------------------------------------------------ franco */

function vFranco(p) {
  var sf = S.datos.saldoFranco || {};
  p.appendChild(el('h1', null, 'Franco'));
  barraCola(p);

  var c = el('div', 'card col g12');
  c.style.marginTop = '14px';
  c.appendChild(el('div', 'mini', 'Te debe'));
  var n = el('div', 'num', pesos(sf.debe));
  n.style.color = 'var(--ink)';
  c.appendChild(n);
  var det = el('div', 'col');
  det.style.cssText = 'border-top:.5px solid var(--sep); padding-top:10px';
  [['Piezas vendidas', sf.piezas || 0], ['− Sus comisiones', pesos(sf.comision)],
   ['− Ya te pagó', pesos(sf.pagado)]].forEach(function (x) {
    var f = el('div', 'fila');
    f.style.cssText = 'font-size:13px; padding:3px 0';
    f.appendChild(el('div', 'sub', x[0]));
    f.appendChild(el('div', null, String(x[1])));
    det.appendChild(f);
  });
  c.appendChild(det);
  var b = el('button', 'b gde', 'Me pagó');
  b.style.cssText = 'width:100%; min-height:46px; font-size:15px';
  b.onclick = pagoFranco;
  c.appendChild(b);
  p.appendChild(c);

  var stock = (S.datos.catalogo || []).filter(function (r) { return r.fr > 0; });
  var cs = el('div', 'card col g8');
  cs.style.marginTop = '12px';
  var fs = el('div', 'fila');
  var t = el('div', null, 'Su stock');
  t.style.cssText = 'font-size:15px; font-weight:600';
  fs.appendChild(t);
  fs.appendChild(el('div', 'sub', stock.reduce(function (a, r) { return a + r.fr; }, 0) + ' piezas'));
  cs.appendChild(fs);
  stock.slice(0, 8).forEach(function (r) {
    var ren = el('div', 'ren');
    ren.appendChild(el('div', null, r.mo.split(' ').slice(0, 2).join(' ') + ' · ' + r.sa));
    ren.appendChild(el('div', null, String(r.fr)));
    cs.appendChild(ren);
  });
  if (stock.length > 8) cs.appendChild(el('div', 'mini', 'y ' + (stock.length - 8) + ' sabores más'));
  p.appendChild(cs);

  var bs = el('button', 'b', 'Surtirle de casa');
  bs.style.cssText = 'width:100%; margin-top:12px';
  bs.onclick = surtido;
  p.appendChild(bs);
}

function pagoFranco() {
  var d = { mn: 0 };
  var c = el('div', 'col g16');
  c.appendChild(el('h1', null, 'Franco te pagó'));
  var g = el('div', 'col g8');
  g.appendChild(el('div', 'eti', 'Cuánto te dio'));
  var i = el('input', 'campo');
  i.type = 'tel'; i.inputMode = 'numeric';
  i.oninput = function () { d.mn = Number(i.value) || 0; };
  g.appendChild(i);
  c.appendChild(g);
  var b = el('button', 'b gde', 'Registrar pago');
  b.onclick = function () {
    if (!d.mn) { avisa('Falta el monto'); return; }
    encola({ t: 'Pago de vendedor', q: 'Franco', mn: d.mn, fp: 'Efectivo', ef: d.mn });
    hoja(null); avisa('Pago registrado'); baja(true);
  };
  c.appendChild(b);
  hoja(c);
}

function surtido() {
  var sel = {};
  function dibuja() {
    var c = el('div', 'col g12');
    c.appendChild(el('h1', null, 'Surtirle de casa'));
    c.appendChild(el('div', 'mini', 'Elige cuántas piezas de cada sabor le entregas.'));
    var cuerpo = el('div', 'col g6');
    cuerpo.style.cssText = 'max-height:46vh; overflow-y:auto';
    (S.datos.catalogo || []).filter(function (r) { return r.ca > 0; })
      .forEach(function (r) {
        var k = r.mo + '|' + r.sa;
        var ren = el('div', 'ren');
        ren.appendChild(el('div', null, r.mo.split(' ').slice(0, 2).join(' ') + ' · ' + r.sa +
          '  (' + r.ca + ' en casa)'));
        var f = el('div', 'fila');
        f.style.gap = '8px';
        var menos = el('button', 'b chico', '−'); menos.style.minWidth = '34px';
        var num = el('div', null, String(sel[k] || 0));
        num.style.minWidth = '20px';
        var mas = el('button', 'b chico', '+'); mas.style.minWidth = '34px';
        menos.onclick = function () { sel[k] = Math.max(0, (sel[k] || 0) - 1); hoja(null); dibuja(); };
        mas.onclick = function () { sel[k] = Math.min(r.ca, (sel[k] || 0) + 1); hoja(null); dibuja(); };
        f.appendChild(menos); f.appendChild(num); f.appendChild(mas);
        ren.appendChild(f);
        cuerpo.appendChild(ren);
      });
    c.appendChild(cuerpo);
    var n = Object.keys(sel).reduce(function (a, k) { return a + sel[k]; }, 0);
    var b = el('button', 'b gde', n ? 'Entregar ' + n + ' piezas' : 'Entregar surtido');
    b.disabled = !n;
    b.onclick = function () {
      Object.keys(sel).forEach(function (k) {
        if (!sel[k]) return;
        var pz = k.split('|');
        encola({ t: 'Surtido', q: 'JP', mo: pz[0], sa: pz[1], pz: sel[k], de: 'Casa', ha: 'Franco' });
      });
      hoja(null); avisa('Surtido registrado'); baja(true);
    };
    c.appendChild(b);
    hoja(c);
  }
  dibuja();
}

/* ------------------------------------------------------------------ resultados */

function vResultados(p) {
  p.appendChild(el('h1', null, 'Resultados'));
  var seg = el('div', 'seg');
  seg.style.margin = '12px 0';
  [['dia', 'Un día'], ['semana', 'Semana'], ['mes', 'Mes']].forEach(function (o) {
    var b = el('button', S.res.per === o[0] ? 'on' : '', o[1]);
    b.onclick = function () {
      S.res.per = o[0]; S.res.data = null;
      if (o[0] === 'dia' && !S.res.dia) S.res.dia = hoyISO();
      pinta(); bajaResultados();
    };
    seg.appendChild(b);
  });
  p.appendChild(seg);

  /* Navegar días: flechas y calendario, como en la app anterior. */
  if (S.res.per === 'dia') {
    var dia = S.res.dia || hoyISO();
    var mueve = function (n) {
      var pz = dia.split('-');
      var x = new Date(Number(pz[0]), Number(pz[1]) - 1, Number(pz[2]));
      x.setDate(x.getDate() + n);
      var nuevo = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' +
        String(x.getDate()).padStart(2, '0');
      if (nuevo > hoyISO()) return;
      S.res.dia = nuevo; S.res.data = null; pinta(); bajaResultados();
    };
    var nav = el('div', 'fila');
    nav.style.gap = '8px';
    var bA = el('button', 'b chico', '‹');
    bA.style.minWidth = '46px';
    bA.onclick = function () { mueve(-1); };
    var ip = el('input');
    ip.type = 'date'; ip.value = dia; ip.max = hoyISO();
    ip.className = 'b chico';
    ip.style.cssText = 'flex:1; min-width:0; padding:9px 10px';
    ip.onchange = function () {
      S.res.dia = ip.value || hoyISO(); S.res.data = null; pinta(); bajaResultados();
    };
    var bS = el('button', 'b chico', '›');
    bS.style.minWidth = '46px';
    bS.disabled = dia >= hoyISO();
    bS.onclick = function () { mueve(1); };
    nav.appendChild(bA); nav.appendChild(ip); nav.appendChild(bS);
    p.appendChild(nav);
    var titulo = el('div', 'cap', dia === hoyISO() ? 'Hoy' : fechaBonita(dia));
    p.appendChild(titulo);
  }

  var d = S.res.data;
  if (!d) { p.appendChild(el('div', 'sub', 'Trayendo los números…')); return; }

  var cab = el('div', 'col g6');
  cab.appendChild(el('div', 'mini', (S.rol === 'JP' ? 'Utilidad' : 'Vendido') +
    (S.res.per === 'dia' ? ' de ese día'
      : (S.res.per === 'semana' ? ' de los últimos 7 días' : ' de los últimos 30 días'))));
  var n = el('div', 'num', pesos(S.rol === 'JP' ? d.utilidad : d.ingresos));
  n.style.fontSize = '40px';
  cab.appendChild(n);
  p.appendChild(cab);

  var tres = el('div', 'fila g8');
  tres.style.cssText = 'gap:8px; margin:12px 0';
  [['Piezas', d.piezas], ['Ingresos', pesos(d.ingresos)], ['Por cobrar', pesos(d.porCobrar)]]
    .forEach(function (x) {
      var c = el('div', 'card col');
      c.style.cssText = 'flex:1; padding:11px 12px';
      c.appendChild(el('div', 'mini', x[0]));
      var v = el('div', null, String(x[1]));
      v.style.cssText = 'font-size:19px; font-weight:700';
      c.appendChild(v);
      tres.appendChild(c);
    });
  p.appendChild(tres);

  if (d.dia && d.dia.length) {
    var cg = el('div', 'card col g8');
    cg.appendChild(el('div', 'mini', S.rol === 'JP' ? 'Utilidad por día' : 'Vendido por día'));
    var max = Math.max.apply(null, d.dia.map(function (x) {
      return Math.abs(S.rol === 'JP' ? x.utilidad : x.ingresos);
    })) || 1;
    var bars = el('div', 'barras');
    d.dia.slice(-14).forEach(function (x, i, arr) {
      var v = Math.abs(S.rol === 'JP' ? x.utilidad : x.ingresos);
      var b = el('div', i === arr.length - 1 ? 'hoy' : '');
      b.style.height = Math.max(3, Math.round(100 * v / max)) + '%';
      bars.appendChild(b);
    });
    cg.appendChild(bars);
    p.appendChild(cg);
  }

  if (S.res.per === 'dia' && (d.ultimas || []).length) {
    p.appendChild(el('div', 'cap', 'Ventas de ese día'));
    var gd2 = el('div', 'group');
    d.ultimas.forEach(function (u) {
      var ren = el('div', 'ren');
      var iz = el('div', 'col');
      iz.appendChild(el('div', null, (u.pr === '2x' ? '2× ' : '') +
        u.modelo.split(' ').slice(0, 2).join(' ') + ' · ' + u.sabor));
      iz.appendChild(el('div', 'mini', u.hora +
        (S.rol === 'JP' && u.quien !== 'JP' ? ' · ' + u.quien : '') +
        (u.fp === 'Pendiente' ? ' · debe' : '')));
      ren.appendChild(iz);
      ren.appendChild(el('div', 'tab-num', pesos(u.monto)));
      gd2.appendChild(ren);
    });
    p.appendChild(gd2);
  }

  var dims = (S.rol === 'JP')
    ? [['modelo', 'Modelo'], ['sabor', 'Sabor'], ['quien', 'Quién vendió'], ['dia', 'Día']]
    : [['modelo', 'Modelo'], ['sabor', 'Sabor'], ['dia', 'Día']];
  var fd = el('div', 'fila');
  fd.style.cssText = 'gap:7px; margin:12px 0; overflow-x:auto';
  dims.forEach(function (o) {
    var b = el('button', 'b chico' + (S.res.dim === o[0] ? ' on' : ''), o[1]);
    b.style.whiteSpace = 'nowrap';
    b.onclick = function () { S.res.dim = o[0]; pinta(); };
    fd.appendChild(b);
  });
  p.appendChild(fd);

  var filas = d[S.res.dim] || [];
  var max2 = Math.max.apply(null, filas.map(function (x) {
    return Math.abs(S.rol === 'JP' ? x.utilidad : x.ingresos);
  })) || 1;
  var w = el('div', 'col');
  filas.forEach(function (x) {
    var box = el('div', 'col g6');
    box.style.cssText = 'padding:9px 0; border-top:.5px solid var(--sep)';
    var f = el('div', 'fila');
    f.appendChild(el('div', null, x.k));
    var der = el('div', 'fila');
    der.style.gap = '12px';
    der.appendChild(el('div', 'sub', x.piezas + ' pz'));
    var v = el('div', null, pesos(S.rol === 'JP' ? x.utilidad : x.ingresos));
    v.style.fontWeight = '600';
    der.appendChild(v);
    f.appendChild(der);
    box.appendChild(f);
    var bar = el('div', 'barra');
    bar.style.width = Math.max(2, Math.round(100 *
      Math.abs(S.rol === 'JP' ? x.utilidad : x.ingresos) / max2)) + '%';
    box.appendChild(bar);
    w.appendChild(box);
  });
  p.appendChild(w);

  if (S.rol === 'JP' && d.francoDeja !== undefined) {
    var cf = el('div', 'card ac fila');
    cf.style.marginTop = '12px';
    var ci = el('div', 'col g6');
    var t = el('div', null, 'Lo que te deja Franco');
    t.style.cssText = 'font-size:14px; font-weight:600; color:var(--warn)';
    ci.appendChild(t);
    ci.appendChild(el('div', 'mini', 'ya sin su comisión'));
    cf.appendChild(ci);
    var v2 = el('div', null, pesos(d.francoDeja));
    v2.style.cssText = 'font-size:20px; font-weight:700';
    cf.appendChild(v2);
    p.appendChild(cf);
  }
}

/* ------------------------------------------------------------------ ajustes */

function vAjustes() {
  var c = el('div', 'col g16');
  c.appendChild(el('h1', null, 'Ajustes'));
  c.appendChild(el('div', 'mini', S.rol === 'JP'
    ? 'Precios, costos, comisiones y vendedores se cambian en el Sheet, no aquí.'
    : 'Si algo no cuadra, avísale a JP: los precios y las comisiones se cambian de su lado.'));

  var b1 = el('button', 'b', 'Actualizar catálogo y stock');
  b1.onclick = function () { hoja(null); baja(); avisa('Actualizando…'); };
  c.appendChild(b1);

  var n = cola().length;
  var b2 = el('button', 'b', n ? 'Subir ' + n + ' movimientos pendientes' : 'No hay nada por subir');
  b2.disabled = !n;
  b2.onclick = function () { hoja(null); sube(); };
  c.appendChild(b2);

  var b3 = el('button', 'b', 'Salir y olvidar el PIN de este celular');
  b3.onclick = function () {
    set(LS.pin, ''); set(LS.cat, ''); set(LS.quien, '');
    S.datos = null; S.rol = ''; vInventario.lugar = '';
    hoja(null); pidePin('');
  };
  c.appendChild(b3);
  hoja(c);
}

arranca();
