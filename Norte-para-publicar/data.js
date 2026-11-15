/* ============================================================================
   NORTE · datos
   Modo demostración: 6 meses de movimientos con el catálogo real de la hoja
   (Alimentacion, Servicios Publicos, Transporte, Familia, Deudas, ...).
   En modo conectado, app.js reemplaza esto con lo que devuelve la hoja.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------ catálogo de categorías */
  var CATS = {
    "Alimentacion":      { label: "Alimentación",        color: "#4ade80", icon: "cart",     kind: "out" },
    "Hogar":             { label: "Hogar",               color: "#a78bfa", icon: "home",     kind: "out" },
    "Transporte":        { label: "Transporte",          color: "#fbbf24", icon: "car",      kind: "out" },
    "Servicios Publicos":{ label: "Servicios públicos",  color: "#38bdf8", icon: "bolt",     kind: "out" },
    "Educacion":         { label: "Educación",           color: "#818cf8", icon: "book",     kind: "out" },
    "Salud":             { label: "Salud",               color: "#fb7185", icon: "heart",    kind: "out" },
    "Deudas":            { label: "Deudas",              color: "#f87171", icon: "card",     kind: "out" },
    "Familia":           { label: "Familia",             color: "#f472b6", icon: "users",    kind: "out" },
    "Ocio":              { label: "Ocio",                color: "#2dd4bf", icon: "spark",    kind: "out" },
    "Compras":           { label: "Compras",             color: "#fb923c", icon: "bag",      kind: "out" },
    "Suscripciones":     { label: "Suscripciones",       color: "#e879f9", icon: "play",     kind: "out" },
    "Gimnasio":          { label: "Gimnasio",            color: "#a3e635", icon: "dumbbell", kind: "out" },
    "Retiros":           { label: "Retiros",             color: "#94a3b8", icon: "cash",     kind: "out" },
    "Mascotas":          { label: "Mascotas",            color: "#fcd34d", icon: "heart",    kind: "out" },
    "Otros":             { label: "Otros",               color: "#7b8494", icon: "sliders",  kind: "out" },
    "Ingreso laboral":   { label: "Ingreso laboral",     color: "#34d399", icon: "wallet",   kind: "in"  },
    "Negocio":           { label: "Negocio",             color: "#2dd4bf", icon: "trend",    kind: "in"  },
    "Rendimientos":      { label: "Rendimientos",        color: "#a3e635", icon: "spark",    kind: "in"  },
    "Ahorro":            { label: "Ahorro e inversión",  color: "#a78bfa", icon: "swap",     kind: "move" }
  };

  /* -------------------------------------------------------------- utilidades */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  function ym(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function ymd(d) { return ym(d) + "-" + String(d.getDate()).padStart(2, "0"); }
  function round(n, to) { return Math.round(n / to) * to; }

  var HOY = new Date();
  HOY.setHours(12, 0, 0, 0);

  /* ---------------------------------------------------------- gastos fijos */
  var FIJOS = [
    { d: 2,  cat: "Hogar",              concepto: "Arriendo apartamento",     contraparte: "Arrendador",   valor: 1850000, owner: "Yesid" },
    { d: 3,  cat: "Hogar",              concepto: "Administración",           contraparte: "Conjunto",     valor: 320000,  owner: "Yesid" },
    { d: 4,  cat: "Educacion",          concepto: "Pensión colegio",          contraparte: "Comfenalco",   valor: 780000,  owner: "Laura" },
    { d: 5,  cat: "Suscripciones",      concepto: "Netflix",                  contraparte: "Netflix",      valor: 47900,   owner: "Laura" },
    { d: 5,  cat: "Suscripciones",      concepto: "Spotify familiar",         contraparte: "Spotify",      valor: 23900,   owner: "Yesid" },
    { d: 6,  cat: "Servicios Publicos", concepto: "Energía y gas",            contraparte: "Afinia",       valor: 245000,  owner: "Yesid" },
    { d: 6,  cat: "Servicios Publicos", concepto: "Agua y alcantarillado",    contraparte: "Caribemar",    valor: 98000,   owner: "Yesid" },
    { d: 7,  cat: "Salud",              concepto: "Plan complementario",      contraparte: "Salud Total",  valor: 262000,  owner: "Laura" },
    { d: 8,  cat: "Servicios Publicos", concepto: "Internet fibra",           contraparte: "Movistar",     valor: 185000,  owner: "Yesid" },
    { d: 9,  cat: "Servicios Publicos", concepto: "Celulares",                contraparte: "Claro",        valor: 159000,  owner: "Yesid" },
    { d: 10, cat: "Hogar",              concepto: "Seguro de vida",           contraparte: "Seguros Bolívar", valor: 190000, owner: "Yesid" },
    { d: 11, cat: "Deudas",             concepto: "Cuota tarjeta de crédito", contraparte: "Bancolombia",  valor: 620000,  owner: "Yesid" },
    { d: 12, cat: "Deudas",             concepto: "Cuota crédito Nu",         contraparte: "Nu",           valor: 280000,  owner: "Yesid" },
    { d: 3,  cat: "Gimnasio",           concepto: "Bodytech",                 contraparte: "Bodytech",     valor: 139000,  owner: "Yesid" }
  ];

  /* ------------------------------------------------------- gastos variables */
  var MERCADOS = ["Éxito", "Ara", "D1", "Carulla", "Olímpica", "Makro"];
  var COMIDAS = ["Rappi", "Frisby", "Restaurante", "iFood", "Panadería", "McDonald's"];
  var TAXIS   = ["Uber", "InDrive", "Taxi", "Bus", "Moto"];

  function generar() {
    var rand = mulberry32(20261114);
    var out = [];
    var n = 0;

    for (var back = 6; back >= 0; back--) {
      var base = new Date(HOY.getFullYear(), HOY.getMonth() - back, 1, 12);
      var y = base.getFullYear(), m = base.getMonth();
      var diasEnMes = new Date(y, m + 1, 0).getDate();
      var esMesActual = (back === 0);
      var ultimoDia = esMesActual ? HOY.getDate() : diasEnMes;
      var escala = 0.94 + rand() * 0.12; // variación mes a mes

      function empujar(dia, tipo, valor, cat, concepto, owner, contra) {
        if (dia > ultimoDia) return;
        var d = new Date(y, m, dia, 12);
        out.push({
          id: "m" + (++n),
          fecha: ymd(d),
          tipo: tipo,
          valor: Math.round(valor),
          categoria: cat,
          concepto: concepto,
          propietario: owner || (rand() > 0.45 ? "Yesid" : "Laura"),
          contraparte: contra || ""
        });
      }

      /* fijos */
      FIJOS.forEach(function (f) {
        empujar(f.d, "Gasto", f.valor * (f.cat === "Hogar" ? 1 : escala), f.cat, f.concepto, f.owner, f.contraparte);
      });

      /* ingresos */
      empujar(1,  "Ingreso", 6500000,           "Ingreso laboral", "Salario Yesid",            "Yesid", "Empresa");
      empujar(3,  "Ingreso", 4200000,           "Ingreso laboral", "Salario Laura",            "Laura", "Empresa");
      empujar(10, "Ingreso", round(1500000 + rand() * 900000, 10000), "Negocio", "Utilidad del negocio", "Yesid", "Negocio");
      empujar(12, "Ingreso", round(120000 + rand() * 180000, 1000),   "Rendimientos", "Rendimientos CDT y trii", "Yesid", "trii");

      /* En el mes en curso solo ha pasado una parte: se generan menos movimientos
         variables, proporcionales a los días transcurridos. */
      var factor = ultimoDia / diasEnMes;
      function cuantos(n) {
        return esMesActual ? Math.max(1, Math.round(n * factor)) : n;
      }

      /* mercado */
      var nMer = cuantos(4 + Math.floor(rand() * 2));
      for (var i = 0; i < nMer; i++) {
        empujar(2 + Math.floor(rand() * (ultimoDia - 2)), "Gasto",
          round(85000 + rand() * 230000, 500), "Alimentacion",
          "Mercado " + MERCADOS[Math.floor(rand() * MERCADOS.length)],
          rand() > 0.5 ? "Laura" : "Yesid",
          MERCADOS[Math.floor(rand() * MERCADOS.length)]);
      }

      /* restaurantes */
      var nRes = cuantos(5 + Math.floor(rand() * 4));
      for (var j = 0; j < nRes; j++) {
        var c = COMIDAS[Math.floor(rand() * COMIDAS.length)];
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(28000 + rand() * 62000, 500), "Alimentacion", c, null, c);
      }

      /* transporte */
      var nTr = cuantos(9 + Math.floor(rand() * 7));
      for (var k = 0; k < nTr; k++) {
        var t = TAXIS[Math.floor(rand() * TAXIS.length)];
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(4500 + rand() * 15000, 100), "Transporte", "Viaje " + t, null, t);
      }
      for (var k2 = 0; k2 < cuantos(2 + Math.floor(rand() * 3)); k2++) {
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(22000 + rand() * 38000, 500), "Transporte", "Transporte y varios", "Laura", "Llave *3043936498");
      }

      /* ocio, compras, salud, mascotas, familia, retiros */
      for (var o = 0; o < cuantos(2 + Math.floor(rand() * 3)); o++) {
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(35000 + rand() * 130000, 500), "Ocio", "Salida en familia", null, "Cine / Parque");
      }
      for (var c2 = 0; c2 < cuantos(1 + Math.floor(rand() * 2)); c2++) {
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(60000 + rand() * 320000, 1000), "Compras",
          ["Ropa", "Calzado", "Hogar", "Tecnología"][Math.floor(rand() * 4)], null,
          ["Falabella", "Alkosto", "Mercado Libre", "Zara"][Math.floor(rand() * 4)]);
      }
      for (var s = 0; s < cuantos(1 + Math.floor(rand() * 2)); s++) {
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(24000 + rand() * 68000, 500), "Salud", "Farmacia", null, "Cruz Verde");
      }
      empujar(14 + Math.floor(rand() * 10), "Gasto", round(45000 + rand() * 45000, 500),
        "Mascotas", "Concentrado y veterinario", "Laura", "Pet Shop");
      empujar(6 + Math.floor(rand() * 18), "Gasto", round(250000 + rand() * 150000, 10000),
        "Familia", "Transferencia a Esilda", "Yesid", "Esilda");
      for (var r = 0; r < cuantos(2 + Math.floor(rand() * 2)); r++) {
        empujar(1 + Math.floor(rand() * ultimoDia), "Gasto",
          round(100000 + rand() * 200000, 10000), "Retiros", "Retiro en efectivo", null, "Cajero");
      }
      empujar(16 + Math.floor(rand() * 8), "Gasto", round(60000 + rand() * 120000, 5000),
        "Otros", "Imprevisto", null, "Varios");

      /* el día de hoy siempre trae algo, para que la app no abra vacía */
      if (esMesActual) {
        empujar(ultimoDia, "Gasto", round(8500 + rand() * 9000, 100), "Transporte", "Viaje Uber", "Laura", "Uber");
        empujar(ultimoDia, "Gasto", round(16000 + rand() * 22000, 500), "Alimentacion", "Almuerzo", "Yesid", "Restaurante");
      }

      /* traslados a ahorro / inversión */
      empujar(5,  "Traslado", 800000,  "Ahorro", "Aporte al fondo de emergencia", "Yesid", "Lulo Bank");
      empujar(18, "Traslado", 350000,  "Ahorro", "Aporte CDT", "Yesid", "trii");
    }

    return out;
  }

  /* --------------------------------------------------------------- topes */
  var TOPES = {
    "Hogar": 2850000,
    "Alimentacion": 1200000,
    "Deudas": 1100000,
    "Educacion": 950000,
    "Servicios Publicos": 850000,
    "Transporte": 500000,
    "Salud": 400000,
    "Familia": 400000,
    "Ocio": 250000,
    "Compras": 160000,
    "Suscripciones": 180000,
    "Gimnasio": 175000,
    "Retiros": 400000,
    "Mascotas": 120000,
    "Otros": 250000
  };

  window.NORTE_DATA = {
    categorias: CATS,
    movimientos: generar(),
    topes: TOPES,
    meses: MESES,
    dias: DIAS,
    hoy: ymd(HOY),
    demo: true
  };
})();
