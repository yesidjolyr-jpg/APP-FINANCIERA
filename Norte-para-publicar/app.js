/* ============================================================================
   NORTE · aplicación
   Vanilla JS, sin build. Un solo archivo para que sea fácil de mantener.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.NORTE_DATA;
  var CATS = D.categorias;
  var MESES = D.meses;

  var LS = {
    movs: "norte.movs.v1",
    topes: "norte.topes.v1",
    cfg: "norte.cfg.v1"
  };

  /* ------------------------------------------------------------- estado --- */
  var state = {
    view: "inicio",
    ym: D.hoy.slice(0, 7),
    movs: [],
    topes: {},
    cfg: { endpoint: "", token: "", live: false },
    q: "",
    filtro: "Todos",
    base: D.movimientos.slice() // respaldo para "deshacer"
  };

  /* ---------------------------------------------------------- persistencia */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function hidratar() {
    var guardados = load(LS.movs, null);
    state.movs = (guardados && guardados.length ? guardados : D.movimientos).slice();
    state.topes = load(LS.topes, D.topes);
    var cfg = load(LS.cfg, null);
    if (cfg) state.cfg = Object.assign(state.cfg, cfg);
    ordenar();
  }

  function ordenar() {
    state.movs.sort(function (a, b) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return b.valor - a.valor;
    });
  }

  /* ------------------------------------------------------------ formato --- */
  function num(n) {
    return Math.round(n).toLocaleString("es-CO");
  }
  function cop(n) {
    var s = num(Math.abs(n));
    return (n < 0 ? "−$ " : "$ ") + s;
  }
  function corto(n) {
    var a = Math.abs(n);
    if (a >= 1000000) return "$" + (a / 1000000).toFixed(1).replace(".", ",") + "M";
    if (a >= 1000) return "$" + Math.round(a / 1000) + "k";
    return "$" + a;
  }
  function pct(n) { return Math.round(n * 100) + "%"; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function catMeta(c) {
    return CATS[c] || { label: c || "Sin categoría", color: "#7b8494", icon: "sliders", kind: "out" };
  }

  var MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function mesLargo(ym) {
    var p = ym.split("-");
    return MESES[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function mesCorto(ym) {
    var p = ym.split("-");
    return MES_CORTO[parseInt(p[1], 10) - 1];
  }
  function diaLargo(iso) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return D.dias[d.getDay()] + " " + (+p[2]) + " de " + MESES[+p[1] - 1];
  }
  function diaCorto(iso) {
    var p = iso.split("-");
    return (+p[2]) + " " + MES_CORTO[+p[1] - 1];
  }
  function etiquetaDia(iso) {
    if (iso === D.hoy) return "Hoy";
    var h = new Date(D.hoy + "T12:00:00");
    h.setDate(h.getDate() - 1);
    var ayer = h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0") + "-" + String(h.getDate()).padStart(2, "0");
    if (iso === ayer) return "Ayer";
    return diaCorto(iso);
  }

  function ymDe(iso) { return iso.slice(0, 7); }
  function mesAnterior(ym) {
    var p = ym.split("-");
    var d = new Date(+p[0], +p[1] - 2, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function mesSiguiente(ym) {
    var p = ym.split("-");
    var d = new Date(+p[0], +p[1], 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  /* ----------------------------------------------------------- cálculos --- */
  function delMes(ym) {
    return state.movs.filter(function (m) { return m.fecha.slice(0, 7) === ym; });
  }

  function resumen(ym) {
    var rows = delMes(ym);
    var ing = 0, gas = 0, tra = 0;
    var porCat = {};
    rows.forEach(function (m) {
      if (m.tipo === "Ingreso") ing += m.valor;
      else if (m.tipo === "Traslado") tra += m.valor;
      else {
        gas += m.valor;
        porCat[m.categoria] = (porCat[m.categoria] || 0) + m.valor;
      }
    });
    return { rows: rows, ing: ing, gas: gas, tra: tra, disp: ing - gas - tra, porCat: porCat, n: rows.length };
  }

  function totalTope() {
    var t = 0;
    Object.keys(state.topes).forEach(function (k) { t += Number(state.topes[k]) || 0; });
    return t;
  }

  /* Serie acumulada de gasto, día a día, para el sparkline */
  function serieGasto(ym) {
    var p = ym.split("-");
    var dias = new Date(+p[0], +p[1], 0).getDate();
    if (ym === D.hoy.slice(0, 7)) dias = +D.hoy.slice(8, 10);
    var rows = delMes(ym);
    var acum = new Array(dias).fill(0);
    rows.forEach(function (m) {
      if (m.tipo !== "Gasto") return;
      var d = +m.fecha.slice(8, 10);
      if (d <= dias) acum[d - 1] += m.valor;
    });
    var total = 0;
    return acum.map(function (v) { total += v; return total; });
  }

  function sparkline(valores, w, h) {
    if (!valores.length) return "";
    var max = Math.max.apply(null, valores) || 1;
    var min = Math.min.apply(null, valores);
    var span = (max - min) || 1;
    var n = valores.length;
    var pts = valores.map(function (v, i) {
      var x = n === 1 ? w / 2 : 5 + (i / (n - 1)) * (w - 20);
      var y = h - 4 - ((v - min) / span) * (h - 12);
      return [x, y];
    });

    var linea = pts.map(function (p, i) {
      if (i === 0) return "M" + p[0].toFixed(1) + " " + p[1].toFixed(1);
      var prev = pts[i - 1];
      var cx = (prev[0] + p[0]) / 2;
      return "C" + cx.toFixed(1) + " " + prev[1].toFixed(1) + " " + cx.toFixed(1) + " " + p[1].toFixed(1) + " " + p[0].toFixed(1) + " " + p[1].toFixed(1);
    }).join(" ");

    var area = linea + " L" + w + " " + h + " L0 " + h + " Z";
    var last = pts[pts.length - 1];
    var gid = "g" + Math.random().toString(36).slice(2, 7);

    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" fill="none">' +
      "<defs>" +
        '<linearGradient id="' + gid + '-a" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#a78bfa" stop-opacity=".38"/>' +
          '<stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>' +
        "</linearGradient>" +
        '<linearGradient id="' + gid + '-l" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#2dd4bf"/>' +
          '<stop offset=".55" stop-color="#a78bfa"/>' +
          '<stop offset="1" stop-color="#f472b6"/>' +
        "</linearGradient>" +
      "</defs>" +
      '<path d="' + area + '" fill="url(#' + gid + '-a)"/>' +
      '<path d="' + linea + '" stroke="url(#' + gid + '-l)" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.2" fill="#fff"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="7" fill="#f472b6" opacity=".22"/>' +
    "</svg>";
  }

  function ic(name, cls) {
    return '<svg class="ic ' + (cls || "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function chipCat(c) {
    var m = catMeta(c);
    return '<span class="ico" style="--c:' + m.color + ';--tint:' + m.color + '22">' + ic(m.icon) + "</span>";
  }

  /* ------------------------------------------------------------- vistas --- */
  function topbar(saludo, sub) {
    return '<header class="topbar">' +
      "<div>" +
        '<div class="eyebrow">Norte</div>' +
        '<h1 class="greet">' + saludo + "</h1>" +
        (sub ? '<div class="greet-sub">' + sub + "</div>" : "") +
      "</div>" +
      '<div class="avatar">Y</div>' +
    "</header>";
  }

  function monthBar(ym, extra) {
    var esActual = ym === D.hoy.slice(0, 7);
    var siguiente = mesSiguiente(ym);
    var haySiguiente = siguiente <= D.hoy.slice(0, 7);
    return '<div class="monthbar">' +
      '<button class="mbtn" data-act="prev" aria-label="Mes anterior">' + ic("left") + "</button>" +
      '<div class="mtitle">' + mesLargo(ym) +
        (esActual ? '<span class="now">ahora</span>' : "") +
        (extra || "") +
      "</div>" +
      '<button class="mbtn" data-act="next" aria-label="Mes siguiente"' + (haySiguiente ? "" : " disabled") + ">" + ic("right") + "</button>" +
    "</div>";
  }

  /* ------------------------------------------------------------- INICIO --- */
  function vistaInicio() {
    var r = resumen(state.ym);
    var tope = totalTope();
    var consumo = r.ing > 0 ? r.gas / r.ing : 0;
    var serie = serieGasto(state.ym);

    /* comparación de gasto contra el mismo tramo del mes anterior */
    var prev = mesAnterior(state.ym);
    var diaActual = state.ym === D.hoy.slice(0, 7) ? +D.hoy.slice(8, 10) : 31;
    var gasPrev = delMes(prev).reduce(function (acc, m) {
      if (m.tipo !== "Gasto") return acc;
      return +m.fecha.slice(8, 10) <= diaActual ? acc + m.valor : acc;
    }, 0);
    var delta = gasPrev > 0 ? (r.gas - gasPrev) / gasPrev : 0;
    var dispPos = r.disp >= 0;

    var cats = Object.keys(r.porCat).map(function (c) {
      return { cat: c, val: r.porCat[c] };
    }).sort(function (a, b) { return b.val - a.val; });

    var filasCat = cats.slice(0, 6).map(function (x) {
      var m = catMeta(x.cat);
      var part = r.gas ? x.val / r.gas : 0;
      var cuenta = r.rows.filter(function (m2) { return m2.categoria === x.cat && m2.tipo === "Gasto"; }).length;
      return '<div class="cat" data-cat="' + esc(x.cat) + '">' +
        chipCat(x.cat) +
        '<div class="cat-main">' +
          '<div class="cat-name">' + esc(m.label) + "</div>" +
          '<div class="cat-meta">' + cuenta + (cuenta === 1 ? " movimiento" : " movimientos") + "</div>" +
        "</div>" +
        '<div class="cat-right">' +
          '<div class="cat-val">' + cop(x.val) + "</div>" +
          '<div class="cat-pct">' + pct(part) + "</div>" +
        "</div>" +
        '<div class="cat-bar"><i style="width:' + Math.min(100, part * 100).toFixed(1) + "%;--c:" + m.color + '"></i></div>' +
      "</div>";
    }).join("");

    var ultimos = r.rows.slice(0, 5).map(function (m, i) {
      return txRow(m, i);
    }).join("");

    return topbar("Hola, Yesid") +
      monthBar(state.ym) +
      '<section class="hero">' +
        '<div class="hero-top">' +
          '<span class="hero-label">Disponible</span>' +
          '<span class="pill' + (delta > 0.005 ? " down" : "") + '">' +
            (Math.abs(delta) < 0.005 ? "sin cambio" :
              (delta > 0 ? "+" : "−") + Math.abs(Math.round(delta * 100)) + "% gasto") + "</span>" +
        "</div>" +
        '<span class="hero-amount">' +
          '<span class="cur">' + (dispPos ? "$" : "−$") + "</span>" + num(Math.abs(r.disp)) +
        "</span>" +
        '<div class="hero-sub">Te queda de <b>' + cop(r.ing) + "</b> que entraron</div>" +
        '<div class="track"><i style="width:' + Math.min(100, consumo * 100).toFixed(1) + '%"></i></div>' +
        '<div class="hero-sub" style="margin-top:7px;font-size:11px">' +
          pct(consumo) + " del ingreso ya gastado · vs. mismo tramo de " + mesCorto(prev) +
        "</div>" +
        sparkline(serie, 380, 62) +
        '<div class="hero-stats">' +
          '<div class="hs"><span class="hs-label">Gastos</span><span class="hs-val out">' + cop(r.gas) + "</span></div>" +
          '<div class="hs"><span class="hs-label">Ahorro e inversión</span><span class="hs-val in">' + cop(r.tra) + "</span></div>" +
        "</div>" +
      "</section>" +

      '<section class="block">' +
        '<div class="block-head">' +
          "<h2 class=\"block-title\">A dónde se va</h2>" +
          '<button class="link" data-act="ir-presupuestos">Presupuestos ' + ic("right") + "</button>" +
        "</div>" +
        '<div class="card cat-list">' + (filasCat || vacio("Sin gastos este mes")) + "</div>" +
      "</section>" +

      '<section class="block">' +
        '<div class="block-head">' +
          "<h2 class=\"block-title\">Últimos movimientos</h2>" +
          '<button class="link" data-act="ir-movs">Ver todos ' + ic("right") + "</button>" +
        "</div>" +
        '<div class="card">' +
          (ultimos || vacio("Todavía no hay movimientos")) +
        "</div>" +
      "</section>";
  }

  function vacio(txt) {
    return '<div class="empty">' + ic("info") + "<p>" + esc(txt) + "</p></div>";
  }

  /* -------------------------------------------------------------- FILA TX --- */
  function txRow(m, i) {
    var meta = catMeta(m.categoria);
    var tipo = m.tipo === "Ingreso" ? " in" : m.tipo === "Traslado" ? " tr" : "";
    var signo = m.tipo === "Ingreso" ? "+" : m.tipo === "Traslado" ? "" : "−";
    var sub = meta.label + (m.contraparte ? " · " + m.contraparte : "");
    return '<div class="tx" data-id="' + m.id + '" style="--i:' + (i % 12) + '">' +
      '<span class="ico" style="--c:' + meta.color + ';--tint:' + meta.color + '22">' + ic(meta.icon) + "</span>" +
      '<div style="min-width:0">' +
        '<div class="tx-name">' + esc(m.concepto) + "</div>" +
        '<div class="tx-sub">' + esc(sub) + "</div>" +
      "</div>" +
      '<div class="tx-amt' + tipo + '">' + signo + cop(m.valor).replace("$ ", "$ ") +
        "<small>" + esc(m.propietario || "") + "</small>" +
      "</div>" +
    "</div>";
  }

  /* --------------------------------------------------------- MOVIMIENTOS --- */
  function vistaMovs() {
    var r = resumen(state.ym);
    return topbar("Movimientos", r.n + " movimientos · " + cop(r.gas) + " en gastos") +
      monthBar(state.ym) +
      '<div class="search">' + ic("search") +
        '<input id="q" type="search" placeholder="Buscar concepto o contraparte" value="' + esc(state.q) + '" autocomplete="off">' +
      "</div>" +
      '<div class="chips" id="chips" style="margin-top:14px">' +
        ["Todos", "Gastos", "Ingresos", "Traslados"].map(function (f) {
          return '<button class="chip' + (state.filtro === f ? " on" : "") + '" data-filtro="' + f + '">' + f + "</button>";
        }).join("") +
      "</div>" +
      '<div id="lista-movs" style="margin-top:6px">' + listaMovs() + "</div>";
  }

  function listaMovs() {
    var rows = delMes(state.ym);
    if (state.filtro === "Gastos") rows = rows.filter(function (m) { return m.tipo === "Gasto"; });
    if (state.filtro === "Ingresos") rows = rows.filter(function (m) { return m.tipo === "Ingreso"; });
    if (state.filtro === "Traslados") rows = rows.filter(function (m) { return m.tipo === "Traslado"; });

    var q = state.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (m) {
        return (m.concepto + " " + m.categoria + " " + (m.contraparte || "") + " " + catMeta(m.categoria).label)
          .toLowerCase().indexOf(q) !== -1;
      });
    }

    if (!rows.length) return '<div class="card">' + vacio("No hay movimientos con ese filtro") + "</div>";

    var grupos = [];
    var actual = null;
    var i = 0;
    rows.forEach(function (m) {
      if (!actual || actual.fecha !== m.fecha) {
        actual = { fecha: m.fecha, rows: [], gasto: 0, ingreso: 0 };
        grupos.push(actual);
      }
      actual.rows.push(m);
      if (m.tipo === "Ingreso") actual.ingreso += m.valor;
      else if (m.tipo === "Gasto") actual.gasto += m.valor;
    });

    return grupos.map(function (g) {
      var filas = g.rows.map(function (m) { return txRow(m, i++); }).join("");
      var marca = g.gasto > 0 ? "−" + cop(g.gasto) : g.ingreso > 0 ? "+" + cop(g.ingreso) : "";
      return '<div class="day-head"><span>' + esc(etiquetaDia(g.fecha)) + "</span>" +
        '<span class="sum">' + marca + "</span></div>" +
        '<div class="card">' + filas + "</div>";
    }).join('<div style="height:6px"></div>');
  }

  /* ---------------------------------------------------------- PRESUPUESTOS --- */
  function vistaPresupuestos() {
    var r = resumen(state.ym);
    var tope = totalTope();
    var usado = tope ? Math.min(1.2, r.gas / tope) : 0;
    var C = 2 * Math.PI * 46;
    var dash = (Math.min(1, usado) * C).toFixed(1);
    var sobra = tope - r.gas;
    var color = usado > 1 ? "#fb7185" : usado > 0.85 ? "#fbbf24" : "#34d399";

    /* Últimos 6 meses CERRADOS. El mes en curso vive arriba, en el anillo:
       mezclarlo aquí haría ver una caída que en realidad es un mes a medias. */
    var meses = [];
    var mMes = mesAnterior(state.ym);
    for (var i = 0; i < 6; i++) { meses.unshift(mMes); mMes = mesAnterior(mMes); }

    var gastos = meses.map(function (x) { return resumen(x).gas; });
    var maxG = Math.max.apply(null, gastos) || 1;
    var minG = Math.min.apply(null, gastos.filter(function (v) { return v > 0; })) || 0;
    var piso = minG * 0.8;
    var rango = Math.max(1, maxG - piso);
    var promedio = gastos.reduce(function (a, b) { return a + b; }, 0) / gastos.length;

    var barras = gastos.map(function (val, idx) {
      var h = Math.max(8, ((val - piso) / rango) * 100);
      var ultimo = idx === gastos.length - 1;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px">' +
        '<div style="width:100%;height:74px;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:' + h.toFixed(1) + "%;border-radius:7px 7px 4px 4px;background:" +
            (ultimo ? "linear-gradient(180deg,#5eead4,#22c1a2)" : "rgba(255,255,255,.10)") + "\"></div>" +
        "</div>" +
        '<span style="font-size:9.5px;font-weight:600;letter-spacing:.04em;color:' + (ultimo ? "#f4f6f9" : "#6b7482") + '">' + mesCorto(meses[idx]) + "</span>" +
      "</div>";
    }).join("");

    var cats = Object.keys(state.topes).map(function (c) {
      var val = r.porCat[c] || 0;
      var lim = Number(state.topes[c]) || 0;
      return { cat: c, val: val, lim: lim, p: lim ? val / lim : 0 };
    }).sort(function (a, b) { return b.p - a.p; });

    var filas = cats.map(function (x) {
      var meta = catMeta(x.cat);
      var p100 = Math.min(100, x.p * 100);
      var col = x.p > 1 ? "#fb7185" : x.p > 0.85 ? "#fbbf24" : meta.color;
      return '<div class="bud" data-tope="' + esc(x.cat) + '">' +
        '<span class="ico" style="--c:' + meta.color + ';--tint:' + meta.color + '22">' + ic(meta.icon) + "</span>" +
        '<div style="min-width:0">' +
          '<div class="bud-top">' +
            '<span class="bud-name">' + esc(meta.label) + "</span>" +
            '<span class="bud-num"><b>' + cop(x.val) + "</b> / " + cop(x.lim) + "</span>" +
          "</div>" +
          '<div class="bud-track' + (x.p > 1 ? " over" : "") + '"><i style="width:' + p100.toFixed(1) + "%;background:" + col + '"></i></div>' +
          '<div class="bud-foot"><span>' + pct(x.p) + " usado</span><span>" +
            (x.p > 1 ? "Excede " + cop(x.val - x.lim) : "Quedan " + cop(x.lim - x.val)) + "</span></div>" +
        "</div>" +
      "</div>";
    }).join("");

    return topbar("Presupuestos") +
      monthBar(state.ym) +
      '<section class="budget-hero" style="margin-top:6px">' +
        '<div class="ring">' +
          '<svg width="104" height="104" viewBox="0 0 104 104">' +
            '<circle class="rt" cx="52" cy="52" r="46"/>' +
            '<circle class="rv" cx="52" cy="52" r="46" stroke="' + color + '" stroke-dasharray="' + dash + " " + C.toFixed(1) + '"/>' +
          "</svg>" +
          '<div class="ring-mid">' + Math.round(usado * 100) + "%</div>" +
        "</div>" +
        '<div class="bg-info">' +
          '<div class="k">Presupuesto del mes</div>' +
          '<div class="v">' + (sobra >= 0 ? cop(sobra) + " libres" : cop(-sobra) + " excedidos") + "</div>" +
          '<div class="s">' + cop(r.gas) + " gastados de " + cop(tope) + "</div>" +
        "</div>" +
      "</section>" +

      '<section class="block">' +
        '<div class="block-head">' +
          '<h2 class="block-title">Gasto mensual</h2>' +
          '<span class="block-sub">6 meses cerrados</span>' +
        "</div>" +
        '<div class="card" style="padding:16px 14px 12px">' +
          '<div style="display:flex;gap:8px">' + barras + "</div>" +
          '<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--text-3)">' +
            "<span>Promedio</span>" +
            '<span style="color:#dfe5ee;font-weight:600;font-variant-numeric:tabular-nums">' + cop(promedio) + "</span>" +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="block">' +
        '<div class="block-head">' +
          "<h2 class=\"block-title\">Topes por categoría</h2>" +
          '<span class="block-sub">toca para editar</span>' +
        "</div>" +
        '<div class="card">' + filas + "</div>" +
      "</section>";
  }

  /* ------------------------------------------------------------- AJUSTES --- */
  function vistaAjustes() {
    var live = state.cfg.live;
    return topbar("Ajustes") +
      '<section class="block" style="margin-top:8px">' +
        '<div class="block-head"><h2 class="block-title">Conexión con la hoja</h2>' +
          '<span class="block-sub">' + (live ? "en vivo" : "demostración") + "</span></div>" +
        '<div class="set-card">' +
          '<div class="set-row">' +
            '<span class="ico" style="--c:#34d399;--tint:#34d39922">' + ic("link") + "</span>" +
            '<div class="set-txt"><div class="set-t">Usar la hoja real</div>' +
              '<div class="set-s">' + (live ? "La app lee y escribe en Registro Financiero" : "Estás viendo datos de ejemplo") + "</div></div>" +
            '<button class="switch' + (live ? " on" : "") + '" data-act="toggle-live" aria-label="Cambiar modo"></button>' +
          "</div>" +
          '<div class="field"><label>URL del Web App (Apps Script)</label>' +
            '<input class="input" id="cfg-url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(state.cfg.endpoint) + '">' +
          "</div>" +
          '<div class="field"><label>Token secreto</label>' +
            '<input class="input" id="cfg-token" type="password" placeholder="el mismo de TOKEN en la hoja" value="' + esc(state.cfg.token) + '">' +
          "</div>" +
          '<div class="actions" style="margin-top:16px">' +
            '<button class="btn btn-primary btn-block" data-act="guardar-cfg">' + ic("check") + "Guardar y probar</button>" +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="block">' +
        '<div class="block-head"><h2 class="block-title">Instalar en el teléfono</h2></div>' +
        '<div class="set-card">' +
          '<div class="set-t" style="margin-bottom:2px">Android · Chrome</div>' +
          '<ol class="steps">' +
            "<li>Abre esta dirección en <b>Chrome</b>.</li>" +
            "<li>Toca el menú <b>⋮</b> arriba a la derecha.</li>" +
            "<li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li>" +
            "<li>Confirma: el ícono de Norte queda como una app más.</li>" +
          "</ol>" +
          '<hr class="hr">' +
          '<div class="set-t" style="margin:18px 0 2px">iPhone · Safari</div>' +
          '<ol class="steps">' +
            "<li>Abre esta dirección en <b>Safari</b> (no en Chrome ni en Instagram).</li>" +
            "<li>Toca el botón <b>Compartir</b> (el cuadro con la flecha).</li>" +
            "<li>Baja y elige <b>Añadir a pantalla de inicio</b>.</li>" +
            "<li>Toca <b>Añadir</b>. Se abre a pantalla completa, sin barra del navegador.</li>" +
          "</ol>" +
          '<div class="note">' + ic("info") +
            "<span>Para que iPhone la instale, la dirección debe ser <b>https</b>. Un archivo abierto desde el computador no sirve: hay que publicarla.</span>" +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="block">' +
        '<div class="block-head"><h2 class="block-title">Datos</h2></div>' +
        '<div class="set-card">' +
          '<div class="set-row">' +
            '<span class="ico" style="--c:#fb7185;--tint:#fb718522">' + ic("trash") + "</span>" +
            '<div class="set-txt"><div class="set-t">Restablecer ejemplo</div>' +
              '<div class="set-s">Descarta los cambios hechos en el teléfono y vuelve a los datos de demostración.</div></div>' +
            '<button class="btn btn-ghost" style="height:36px;font-size:12px" data-act="reset">Restablecer</button>' +
          "</div>" +
        "</div>" +
        '<div class="note warn" style="margin-top:14px">' + ic("info") +
          "<span>En modo demostración, los cambios se guardan solo en este teléfono. Al conectar la hoja real, se escriben en <b>Registro Financiero</b>.</span>" +
        "</div>" +
      "</section>" +

      '<div class="ver">Norte · versión 1.0 · hecho para el registro financiero de la familia</div>';
  }

  /* ------------------------------------------------------------- RENDER --- */
  function render() {
    var v = document.getElementById("view");
    var html = "";
    if (state.view === "inicio") html = vistaInicio();
    else if (state.view === "movs") html = vistaMovs();
    else if (state.view === "presupuestos") html = vistaPresupuestos();
    else html = vistaAjustes();

    v.innerHTML = html;
    v.style.animation = "none";
    void v.offsetWidth;
    v.style.animation = "";
    pintarTabs();
    window.scrollTo(0, 0);
  }

  function pintarTabs() {
    var tabs = [
      { id: "inicio", label: "Inicio", icon: "home" },
      { id: "movs", label: "Movimientos", icon: "swap" },
      { id: "presupuestos", label: "Presupuestos", icon: "target" },
      { id: "ajustes", label: "Ajustes", icon: "sliders" }
    ];
    document.getElementById("tabbar").innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (state.view === t.id ? " on" : "") + '" data-tab="' + t.id + '">' +
        ic(t.icon) + "<span>" + t.label + "</span></button>";
    }).join("");
  }

  function ir(view) {
    state.view = view;
    try { history.replaceState(null, "", "#" + view); } catch (e) {}
    render();
  }

  /* -------------------------------------------------------------- SHEETS --- */
  var sheetAbierta = null;

  function cerrarSheet() {
    if (!sheetAbierta) return;
    var wrap = sheetAbierta;
    sheetAbierta = null;
    wrap.querySelector(".sheet").classList.remove("show");
    wrap.querySelector(".backdrop").classList.remove("show");
    setTimeout(function () { wrap.remove(); }, 320);
  }

  function abrirSheet(html) {
    cerrarSheet();
    var wrap = document.createElement("div");
    wrap.innerHTML = '<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="grip"></div>' + html + "</div>";
    document.getElementById("sheet-root").appendChild(wrap);
    sheetAbierta = wrap;

    var bd = wrap.querySelector(".backdrop");
    bd.addEventListener("click", cerrarSheet);
    wrap.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", cerrarSheet);
    });

    requestAnimationFrame(function () {
      wrap.querySelector(".backdrop").classList.add("show");
      wrap.querySelector(".sheet").classList.add("show");
    });

    var first = wrap.querySelector("input,select");
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 420);
  }

  /* ------------------------------------------------------- hoja: movimiento */
  function opcionesCategoria(tipo, actual) {
    var kind = tipo === "Ingreso" ? "in" : tipo === "Traslado" ? "move" : "out";
    var lista = Object.keys(CATS).filter(function (c) { return CATS[c].kind === kind; });
    if (lista.indexOf(actual) === -1) actual = lista[0];
    return {
      html: lista.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === actual ? " selected" : "") + ">" + esc(CATS[c].label) + "</option>";
      }).join(""),
      valor: actual
    };
  }

  function abrirMovimiento(id) {
    var m = state.movs.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var tipos = ["Gasto", "Ingreso", "Traslado"];
    var inicial = opcionesCategoria(m.tipo, m.categoria);

    var html =
      '<div class="sheet-head">' +
        "<div>" +
          '<h2 class="sheet-title">Movimiento</h2>' +
          '<div class="sheet-sub">' + esc(diaLargo(m.fecha)) + " · " + esc(m.propietario || "") + "</div>" +
        "</div>" +
        '<button class="xbtn" data-close aria-label="Cerrar">' + ic("x") + "</button>" +
      "</div>" +

      '<div class="detail-amount' + (m.tipo === "Ingreso" ? " in" : m.tipo === "Traslado" ? " tr" : "") + '">' +
        (m.tipo === "Ingreso" ? "+" : "") + cop(m.valor) + "</div>" +
      '<div class="detail-when">' + esc(m.concepto) + "</div>" +

      '<div class="field"><label>Tipo</label>' +
        '<div class="seg" data-seg>' + tipos.map(function (t) {
          return '<button data-tipo="' + t + '" class="' + (t === m.tipo ? "on" : "") + '">' + t + "</button>";
        }).join("") + "</div>" +
      "</div>" +

      '<div class="field"><label>Valor</label>' +
        '<input class="input" id="f-valor" type="text" inputmode="numeric" value="' + num(m.valor) + '">' +
      "</div>" +

      '<div class="field"><label>Categoría</label>' +
        '<select class="select" id="f-cat">' + inicial.html + "</select>" +
      "</div>" +

      '<div class="field"><label>Concepto</label>' +
        '<input class="input" id="f-concepto" type="text" value="' + esc(m.concepto) + '">' +
      "</div>" +

      '<div class="field"><label>Contraparte</label>' +
        '<input class="input" id="f-contra" type="text" value="' + esc(m.contraparte || "") + '" placeholder="Quién recibe o de dónde sale">' +
      "</div>" +

      '<div class="actions">' +
        '<button class="btn btn-danger" data-act="borrar" aria-label="Eliminar">' + ic("trash") + "</button>" +
        '<button class="btn btn-primary" data-act="guardar">' + ic("check") + "Guardar</button>" +
      "</div>";

    abrirSheet(html);

    var sheet = sheetAbierta;
    var tipoSel = m.tipo;

    sheet.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        tipoSel = b.dataset.tipo;
        sheet.querySelectorAll(".seg button").forEach(function (x) { x.classList.toggle("on", x === b); });
        var sel = sheet.querySelector("#f-cat");
        sel.innerHTML = opcionesCategoria(tipoSel, sel.value).html;
      });
    });

    sheet.querySelector('[data-act="guardar"]').addEventListener("click", function () {
      var valor = parseInt(String(sheet.querySelector("#f-valor").value).replace(/[^\d]/g, ""), 10) || 0;
      var concepto = sheet.querySelector("#f-concepto").value.trim();
      if (!concepto) { toast("El concepto no puede quedar vacío"); return; }

      var nuevo = Object.assign({}, m, {
        tipo: tipoSel,
        valor: valor,
        categoria: sheet.querySelector("#f-cat").value,
        concepto: concepto,
        contraparte: sheet.querySelector("#f-contra").value.trim()
      });

      actualizar(m.id, nuevo);
      cerrarSheet();
      toast("Movimiento actualizado");
      render();
    });

    sheet.querySelector('[data-act="borrar"]').addEventListener("click", function () {
      eliminar(m.id);
      cerrarSheet();
      toast("Movimiento eliminado", { undo: true, id: m.id, mov: m });
      render();
    });
  }

  /* ------------------------------------------------------- hoja: categoría */
  function abrirCategoria(cat) {
    var r = resumen(state.ym);
    var meta = catMeta(cat);
    var filas = r.rows.filter(function (m) { return m.categoria === cat && m.tipo === "Gasto"; });
    var total = filas.reduce(function (a, b) { return a + b.valor; }, 0);
    var tope = Number(state.topes[cat]) || 0;
    var p = tope ? total / tope : 0;

    var html =
      '<div class="sheet-head">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span class="ico" style="--c:' + meta.color + ';--tint:' + meta.color + '22;width:44px;height:44px">' + ic(meta.icon) + "</span>" +
          "<div>" +
            '<h2 class="sheet-title">' + esc(meta.label) + "</h2>" +
            '<div class="sheet-sub">' + filas.length + " movimientos en " + mesLargo(state.ym) + "</div>" +
          "</div>" +
        "</div>" +
        '<button class="xbtn" data-close aria-label="Cerrar">' + ic("x") + "</button>" +
      "</div>" +

      '<div class="detail-amount">' + cop(total) + "</div>" +
      '<div class="detail-when">' + (tope ? pct(p) + " del tope de " + cop(tope) : "Sin tope definido") + "</div>" +

      '<div class="field"><label>Tope mensual</label>' +
        '<input class="input" id="f-tope" type="text" inputmode="numeric" value="' + (tope ? num(tope) : "") + '">' +
      "</div>" +

      '<div class="actions" style="margin-top:16px">' +
        '<button class="btn btn-primary btn-block" data-act="guardar-tope">' + ic("check") + "Guardar tope</button>" +
      "</div>" +

      '<hr class="hr">' +
      '<div class="block-head" style="margin-top:18px"><h2 class="block-title">Movimientos</h2></div>' +
      '<div class="card" style="margin-bottom:6px">' +
        (filas.length ? filas.map(function (m, i) { return txRow(m, i); }).join("") : vacio("Nada registrado")) +
      "</div>";

    abrirSheet(html);

    var sheet = sheetAbierta;
    sheet.querySelector('[data-act="guardar-tope"]').addEventListener("click", function () {
      var v = parseInt(String(sheet.querySelector("#f-tope").value).replace(/[^\d]/g, ""), 10) || 0;
      state.topes[cat] = v;
      save(LS.topes, state.topes);
      cerrarSheet();
      toast("Tope de " + meta.label + " actualizado");
      render();
      if (state.cfg.live && state.cfg.endpoint) {
        Api.escribir("tope", { categoria: cat, tope: v }).then(function (j) {
          if (j.topes) {
            state.topes = j.topes;
            save(LS.topes, state.topes);
            render();
          }
        }).catch(function (e) { toast("No se pudo guardar el tope: " + e.message); });
      }
    });

    sheet.querySelectorAll(".tx").forEach(function (row) {
      row.addEventListener("click", function () {
        cerrarSheet();
        setTimeout(function () { abrirMovimiento(row.dataset.id); }, 340);
      });
    });
  }

  /* --------------------------------------------------------- operaciones --- */
  function actualizar(id, nuevo) {
    state.movs = state.movs.map(function (m) { return m.id === id ? nuevo : m; });
    ordenar();
    save(LS.movs, state.movs);
    if (state.cfg.live && state.cfg.endpoint) {
      Api.escribir("update", { fila: nuevo.fila, movimiento: nuevo })
        .then(adoptarRemoto)
        .catch(function (e) { toast("No se pudo escribir en la hoja: " + e.message); });
    }
  }

  function eliminar(id) {
    var victima = state.movs.filter(function (m) { return m.id === id; })[0];
    state.movs = state.movs.filter(function (m) { return m.id !== id; });
    save(LS.movs, state.movs);
    if (state.cfg.live && state.cfg.endpoint && victima) {
      Api.escribir("delete", { fila: victima.fila })
        .then(adoptarRemoto)
        .catch(function (e) { toast("No se pudo borrar en la hoja: " + e.message); });
    }
  }

  /* La hoja devuelve la lista completa tras cada escritura: las filas se
     renumeran al borrar, así que se adopta tal cual para no quedar desfasados. */
  function adoptarRemoto(j) {
    if (j && j.movimientos) {
      state.movs = j.movimientos;
      ordenar();
      save(LS.movs, state.movs);
      render();
    }
  }

  /* ---------------------------------------------------------------- API --- */
  var Api = {
    url: function (params) {
      var u = state.cfg.endpoint;
      var q = "?token=" + encodeURIComponent(state.cfg.token);
      Object.keys(params || {}).forEach(function (k) {
        q += "&" + k + "=" + encodeURIComponent(params[k]);
      });
      return u + q;
    },
    leer: function (params) {
      return fetch(Api.url(params), { method: "GET", cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (j) {
          if (!j || j.ok !== true) throw new Error((j && j.error) || "respuesta inválida");
          return j;
        });
    },
    escribir: function (accion, datos) {
      var body = Object.assign({ action: accion, token: state.cfg.token }, datos || {});
      return fetch(state.cfg.endpoint, {
        method: "POST",
        // text/plain evita el preflight de CORS; Apps Script lo recibe igual.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.ok !== true) throw new Error((j && j.error) || "no se pudo guardar");
        return j;
      });
    }
  };

  function conectar() {
    var url = document.getElementById("cfg-url").value.trim();
    var token = document.getElementById("cfg-token").value.trim();
    if (!url || !token) { toast("Faltan la URL y el token"); return; }

    state.cfg.endpoint = url;
    state.cfg.token = token;

    toast("Probando conexión…");
    Api.leer({ accion: "movimientos", mes: state.ym }).then(function (j) {
      state.cfg.live = true;
      save(LS.cfg, state.cfg);
      if (j.movimientos && j.movimientos.length) {
        state.movs = j.movimientos;
        ordenar();
        save(LS.movs, state.movs);
      }
      toast("Conectado: " + state.movs.length + " movimientos");
      render();
    }).catch(function (e) {
      state.cfg.live = false;
      save(LS.cfg, state.cfg);
      toast("No se pudo conectar: " + e.message);
      render();
    });
  }

  /* -------------------------------------------------------------- toast --- */
  function toast(msg, opts) {
    opts = opts || {};
    var root = document.getElementById("toast-root");
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = ic("check");

    var msgEl = document.createElement("span");
    msgEl.textContent = msg;
    el.appendChild(msgEl);

    if (opts.undo) {
      var b = document.createElement("button");
      b.textContent = "Deshacer";
      b.addEventListener("click", function () {
        if (opts.mov) {
          state.movs.push(opts.mov);
          ordenar();
          save(LS.movs, state.movs);
          render();
        }
        el.remove();
      });
      el.appendChild(b);
    }

    root.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 260);
    }, opts.undo ? 5200 : 2800);
  }

  /* ------------------------------------------------------------- eventos --- */
  document.addEventListener("click", function (ev) {
    var t = ev.target;

    var tab = t.closest("[data-tab]");
    if (tab) { ir(tab.dataset.tab); return; }

    var act = t.closest("[data-act]");
    if (act) {
      var a = act.dataset.act;
      if (a === "prev") { state.ym = mesAnterior(state.ym); render(); return; }
      if (a === "next") { state.ym = mesSiguiente(state.ym); render(); return; }
      if (a === "ir-presupuestos") { ir("presupuestos"); return; }
      if (a === "ir-movs") { ir("movs"); return; }
      if (a === "toggle-live") {
        state.cfg.live = !state.cfg.live;
        save(LS.cfg, state.cfg);
        render();
        return;
      }
      if (a === "guardar-cfg") { conectar(); return; }
      if (a === "reset") {
        state.movs = D.movimientos.slice();
        state.topes = Object.assign({}, D.topes);
        state.cfg = { endpoint: "", token: "", live: false };
        try { localStorage.removeItem(LS.movs); localStorage.removeItem(LS.topes); localStorage.removeItem(LS.cfg); } catch (e) {}
        ordenar();
        render();
        toast("Datos de ejemplo restablecidos");
        return;
      }
    }

    var chip = t.closest("[data-filtro]");
    if (chip) {
      state.filtro = chip.dataset.filtro;
      document.querySelectorAll("#chips .chip").forEach(function (c) {
        c.classList.toggle("on", c === chip);
      });
      document.getElementById("lista-movs").innerHTML = listaMovs();
      return;
    }

    var cat = t.closest("[data-cat]");
    if (cat) { abrirCategoria(cat.dataset.cat); return; }

    var tope = t.closest("[data-tope]");
    if (tope) { abrirCategoria(tope.dataset.tope); return; }

    var tx = t.closest(".tx");
    if (tx && tx.dataset.id) { abrirMovimiento(tx.dataset.id); return; }
  });

  document.addEventListener("input", function (ev) {
    if (ev.target.id === "q") {
      state.q = ev.target.value;
      var lista = document.getElementById("lista-movs");
      if (lista) lista.innerHTML = listaMovs();
      return;
    }
    if (ev.target.id === "f-valor") {
      var v = ev.target.value.replace(/[^\d]/g, "");
      ev.target.value = v ? Number(v).toLocaleString("es-CO") : "";
      return;
    }
    if (ev.target.id === "f-tope") {
      var w = ev.target.value.replace(/[^\d]/g, "");
      ev.target.value = w ? Number(w).toLocaleString("es-CO") : "";
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") cerrarSheet();
  });

  /* --------------------------------------------------------------- arranque */
  function arrancar() {
    hidratar();

    var hash = (location.hash || "").replace("#", "");
    if (["inicio", "movs", "presupuestos", "ajustes"].indexOf(hash) !== -1) state.view = hash;

    render();

    if (state.cfg.live && state.cfg.endpoint) {
      Api.leer({ accion: "movimientos", mes: state.ym }).then(function (j) {
        if (j.movimientos) {
          state.movs = j.movimientos;
          ordenar();
          save(LS.movs, state.movs);
          render();
        }
      }).catch(function () {
        toast("Sin conexión con la hoja: se muestran los últimos datos");
      });
    }

    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
