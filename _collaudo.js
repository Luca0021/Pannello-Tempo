/* _collaudo.js — strumenti di misura per il collaudo manuale in browser.
   NON fa parte della release: è escluso dall'impronta della build in
   strumenti/build.mjs (FUORI) e in _pt_build.ps1, e non è caricato da
   index.html. Si carica a mano dalla console, o iniettando
   <script src="/_collaudo.js"></script>.

   Contiene quattro misure, e la ragione per cui ognuna è scritta così sta
   nei commenti: ogni riga di questi auditor è nata da un falso allarme.  */

(function () {
  "use strict";

  /* ---------- colore ---------- */

  function P(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    var p = m[1].split(",").map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: (p.length > 3 ? p[3] : 1) };
  }
  function S(f, b) {   /* f sopra b */
    var a = f.a;
    return { r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a), a: 1 };
  }
  function L(c) {
    function f(v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function R(a, b) {
    var x = L(a), y = L(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  var BIANCO = { r: 255, g: 255, b: 255, a: 1 };

  /* Divide la lista dei livelli di background-image alle virgole di primo
     livello: quelle dentro rgb(…) e dentro linear-gradient(…) non separano
     niente, e dividere alla cieca produceva livelli inventati. */
  function livelli(img) {
    var out = [], prof = 0, corr = "";
    for (var i = 0; i < img.length; i++) {
      var ch = img[i];
      if (ch === "(") prof++;
      else if (ch === ")") prof--;
      if (ch === "," && prof === 0) { out.push(corr.trim()); corr = ""; continue; }
      corr += ch;
    }
    if (corr.trim()) out.push(corr.trim());
    return out;
  }
  function tappe(l) {
    var o = [], rx = /rgba?\([^)]+\)/g, m;
    while ((m = rx.exec(l))) { var p = P(m[0]); if (p) o.push(p); }
    return o;
  }

  /* FONDI POSSIBILI dietro un elemento.
     Quattro regole, tutte imparate da un falso allarme:
       1. il bianco è il punto di PARTENZA dell'accumulo, non un candidato.
          Metterlo fra i candidati faceva risultare «bianco su bianco» ogni
          testo chiaro: 17 falsi allarmi in un colpo;
       2. le tappe del gradiente di un antenato non valgono se un
          discendente le copre con un fondo opaco;
       3. «opaco» comprende un gradiente le cui tappe sono tutte opache: il
          riquadro Focus dipinge così, e senza questo il suo testo chiaro
          risultava su chiaro;
       4. i livelli di `background-image` si dipingono dal basso, quindi
          l'ULTIMO della lista è il più in basso. Comporli in ordine diretto
          era il difetto peggiore: in tema scuro il fondo della pagina è
          l'ultimo livello, e prendendo il primo — una griglia chiara al
          3,5% — ogni testo del pannello risultava su chiaro. */
  function fondi(el) {
    var cat = [], n = el;
    while (n && n.nodeType === 1) { cat.push(n); n = n.parentElement; }
    var v = [BIANCO];
    for (var i = cat.length - 1; i >= 0; i--) {
      var cs = getComputedStyle(cat[i]);
      var bg = P(cs.backgroundColor);
      if (bg && bg.a > 0)
        v = bg.a >= 0.999 ? [S(bg, BIANCO)] : v.map(function (x) { return S(bg, x); });
      var img = cs.backgroundImage;
      if (img && img !== "none") {
        livelli(img).reverse().forEach(function (l) {
          var t = tappe(l);
          if (!t.length) return;                       /* url(), none: nessun colore noto */
          var opaco = t.every(function (s) { return s.a >= 0.999; });
          var nuove = [];
          if (opaco) {
            t.forEach(function (s) { nuove.push(S(s, BIANCO)); });
          } else {
            v.forEach(function (x) {
              nuove.push(x);                            /* dove il livello è trasparente */
              t.forEach(function (s) { if (s.a > 0) nuove.push(S(s, x)); });
            });
          }
          /* tetto: senza limite le combinazioni esplodono e la misura si ferma */
          v = nuove.slice(0, 12);
        });
      }
    }
    return v;
  }

  /* VISIBILITÀ. Anche questa è fatta di correzioni:
       - un sottoalbero `display:none` dava riquadri 0×0 e quindi contrasti
         assurdi;
       - un antenato con `overflow:hidden` e altezza zero — una scheda
         richiusa — conteneva testo che nessuno vede. */
  function visibile(el) {
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return false;
    if (el.offsetParent === null && cs.position !== "fixed") return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var n = el.parentElement;
    while (n && n.nodeType === 1) {
      var c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden" || parseFloat(c.opacity) === 0) return false;
      if (c.overflow === "hidden" || c.overflowY === "hidden") {
        var q = n.getBoundingClientRect();
        if (q.height < 2 || q.width < 2) return false;
      }
      n = n.parentElement;
    }
    return true;
  }

  /* TRANSIZIONI CONGELATE — la misura più insidiosa di tutte.

     Con il pannello del browser nascosto (`document.visibilityState` a
     "hidden") il renderer sospende le animazioni, e una transizione CSS
     resta ferma sul valore di PARTENZA. Un pulsante che passa da variante
     primaria a secondaria ha `transition:background .15s`: a pannello
     nascosto il suo fondo resta quello vecchio per sempre, e
     `getComputedStyle` riporta testo quasi bianco su fondo trasparente,
     cioè 1,00:1. Ho passato mezz'ora a cercare un difetto che non c'era:
     bastava togliere la transizione e il valore saltava a quello giusto.

     Quindi: prima di misurare si azzerano transizioni e animazioni. La
     regola si inserisce con CSSOM perché la Content Security Policy del
     pannello vieta gli elementi <style> iniettati ma consente
     `insertRule` su un foglio già caricato. */
  var _regolaCongelata = null;
  function congela() {
    if (_regolaCongelata) return true;
    for (var i = 0; i < document.styleSheets.length; i++) {
      var ss = document.styleSheets[i];
      try {
        var n = ss.cssRules.length;
        ss.insertRule(".pt *, .pt *::before, .pt *::after { transition: none !important; animation: none !important; }", n);
        _regolaCongelata = { foglio: ss, indice: n };
        /* forza un ricalcolo, altrimenti i valori restano quelli vecchi */
        void document.body.offsetHeight;
        return true;
      } catch (e) { /* foglio di altra origine o non modificabile: provo il prossimo */ }
    }
    return false;
  }
  function scongela() {
    if (!_regolaCongelata) return;
    try { _regolaCongelata.foglio.deleteRule(_regolaCongelata.indice); } catch (e) {}
    _regolaCongelata = null;
  }

  /* ---------- 1. contrasto del testo (WCAG 1.4.3) ---------- */

  function contrasto(quanti) {
    congela();
    var bad = [], n = 0;
    document.querySelectorAll("#app *").forEach(function (el) {
      var tx = "";
      for (var i = 0; i < el.childNodes.length; i++)
        if (el.childNodes[i].nodeType === 3) tx += el.childNodes[i].nodeValue;
      tx = tx.replace(/\s+/g, " ").trim();
      if (!tx || !visibile(el)) return;
      var cs = getComputedStyle(el), fg = P(cs.color);
      if (!fg) return;
      n++;
      var px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
      var soglia = (px >= 24 || (px >= 18.66 && peso >= 700)) ? 3 : 4.5;
      var peggio = 99, base = null;
      fondi(el).forEach(function (b) {
        var f = fg.a < 1 ? S(fg, b) : fg;
        var r = R(f, b);
        if (r < peggio) { peggio = r; base = b; }
      });
      if (peggio < soglia - 0.01)
        bad.push({
          t: tx.slice(0, 34),
          el: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""),
          r: Math.round(peggio * 100) / 100, soglia: soglia, col: cs.color,
          bg: base ? "rgb(" + Math.round(base.r) + "," + Math.round(base.g) + "," + Math.round(base.b) + ")" : "?"
        });
    });
    return { testi: n, falliti: bad.length, elenco: bad.slice(0, quanti || 8) };
  }

  /* ---------- 2. contrasto dei comandi (WCAG 1.4.11) ---------- */

  /* Conta l'informazione che serve a IDENTIFICARE il comando: il bordo, o
     il riempimento se si distingue da solo. Prendere il MINIMO fra bordo e
     riempimento — come facevo all'inizio — segnala come difetto ogni campo
     bianco su scheda bianca anche quando ha un bordo perfettamente
     visibile. Serve il massimo dei due, non il minimo.
     I comandi disegnati dal browser sono esenti: una casella nativa senza
     stile nostro non è nostra da correggere. */
  var SELETTORI_COMANDI = "#app input, #app select, #app textarea, #app button.tiny, " +
    "#app button.ghost, #app .slot, #app .lk, #app .chiudi, #app .dayb, " +
    "#app .areapunto, #app .scegli, #app .star";

  function grafica() {
    congela();
    var out = [], esenti = 0;
    document.querySelectorAll(SELETTORI_COMANDI).forEach(function (el) {
      if (!visibile(el) || el.type === "hidden") return;
      var cs = getComputedStyle(el);
      if (el.tagName === "INPUT" && cs.appearance !== "none" && parseFloat(cs.borderTopWidth) === 0) { esenti++; return; }
      var bordo = P(cs.borderTopColor), largh = parseFloat(cs.borderTopWidth) || 0, fill = P(cs.backgroundColor);
      var bs = fondi(el.parentElement || el);
      function migliore(c) {
        if (!c || c.a === 0) return 0;
        var b = 0;
        bs.forEach(function (x) { var f = c.a < 1 ? S(c, x) : c; var r = R(f, x); if (r > b) b = r; });
        return b;
      }
      var v = Math.max(largh > 0 ? migliore(bordo) : 0, migliore(fill));
      out.push({
        el: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""),
        cl: String(el.className) || el.tagName.toLowerCase(),
        r: Math.round(v * 100) / 100, ok: v >= 3
      });
    });
    var sotto = out.filter(function (x) { return !x.ok; });
    return {
      esaminati: out.length, esentiNativi: esenti, sotto3: sotto.length,
      elenco: sotto.slice(0, 8),
      min: out.length ? Math.min.apply(null, out.map(function (x) { return x.r; })) : null
    };
  }

  /* ---------- 3. nomi accessibili, bersagli, struttura ---------- */

  var SEL = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"]';

  /* Per input/select/textarea il CONTENUTO non è un nome: per un `select`
     il testo delle opzioni non dice di che campo si tratta. Trattarlo come
     nome nascondeva sette campi senza etichetta. Il `placeholder` è
     l'ultima risorsa e viene segnalato a parte: sparisce appena si scrive. */
  function nome(e) {
    var n = (e.getAttribute("aria-label") || "").trim();
    if (n) return { n: n, d: "aria-label" };
    var lb = e.getAttribute("aria-labelledby");
    if (lb) {
      var t = "";
      lb.split(/\s+/).forEach(function (i) { var x = document.getElementById(i); if (x) t += " " + x.textContent; });
      if (t.trim()) return { n: t.trim(), d: "aria-labelledby" };
    }
    var g = e.tagName;
    if (g === "INPUT" || g === "SELECT" || g === "TEXTAREA") {
      if (e.labels && e.labels.length) { var l = e.labels[0].textContent.trim(); if (l) return { n: l, d: "label" }; }
      var ti = (e.getAttribute("title") || "").trim(); if (ti) return { n: ti, d: "title" };
      if (g === "INPUT" && (e.type === "button" || e.type === "submit") && (e.value || "").trim())
        return { n: e.value.trim(), d: "value" };
      var ph = (e.getAttribute("placeholder") || "").trim(); if (ph) return { n: ph, d: "placeholder" };
      return { n: "", d: "-" };
    }
    if ((e.textContent || "").trim()) return { n: e.textContent.trim(), d: "contenuto" };
    var t2 = (e.getAttribute("title") || "").trim(); if (t2) return { n: t2, d: "title" };
    return { n: "", d: "-" };
  }

  /* WCAG 2.2 §2.5.8: 24×24, con l'eccezione della SPAZIATURA — un bersaglio
     più piccolo passa se un cerchio di 24px centrato su di lui non incrocia
     un altro bersaglio né il cerchio di un altro bersaglio sottomisura.
     Senza questa eccezione il pannello risulterebbe pieno di difetti che
     non sono difetti: dieci comandi alti 19-23px, tutti isolati. */
  function struttura() {
    congela();
    var ber = [], senzaNome = [], soloPh = [];
    document.querySelectorAll(SEL).forEach(function (e) {
      if (!visibile(e)) return;
      var r = e.getBoundingClientRect();
      ber.push({ e: e, r: r, p: (r.width < 24 || r.height < 24) });
      var v = nome(e);
      var et = e.tagName.toLowerCase() + (e.type ? "[" + e.type + "]" : "") + " " +
               (e.getAttribute("data-chg") || e.getAttribute("data-act") || e.id || "?");
      if (!v.n) senzaNome.push(et);
      else if (v.d === "placeholder") soloPh.push(et);
    });
    function cerchio(r) {
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { left: x - 12, top: y - 12, right: x + 12, bottom: y + 12 };
    }
    function incrocia(a, b) {
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
    var perSpaziatura = 0, falliti = [];
    ber.forEach(function (t) {
      if (!t.p) return;
      var c = cerchio(t.r), scontri = [];
      ber.forEach(function (o) {
        if (o.e === t.e) return;
        if (incrocia(c, { left: o.r.left, top: o.r.top, right: o.r.right, bottom: o.r.bottom })) {
          scontri.push(nome(o.e).n.slice(0, 14)); return;
        }
        if (o.p && incrocia(c, cerchio(o.r))) scontri.push(nome(o.e).n.slice(0, 14));
      });
      if (!scontri.length) perSpaziatura++;
      else falliti.push({
        el: t.e.tagName.toLowerCase() + "." + String(t.e.className).split(" ")[0],
        n: nome(t.e).n.slice(0, 22), m: Math.round(t.r.width) + "x" + Math.round(t.r.height),
        contro: scontri.slice(0, 2)
      });
    });
    var conta = {}, dup = [];
    document.querySelectorAll("[id]").forEach(function (e) { conta[e.id] = (conta[e.id] || 0) + 1; });
    Object.keys(conta).forEach(function (k) { if (conta[k] > 1) dup.push(k + " x" + conta[k]); });
    var rotti = [];
    ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns"].forEach(function (a) {
      document.querySelectorAll("[" + a + "]").forEach(function (e) {
        e.getAttribute(a).split(/\s+/).filter(Boolean).forEach(function (i) {
          if (!document.getElementById(i)) rotti.push(a + "=" + i);
        });
      });
    });
    var liv = [], salti = [];
    document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(function (h) { if (visibile(h)) liv.push(Number(h.tagName[1])); });
    for (var i = 1; i < liv.length; i++) if (liv[i] - liv[i - 1] > 1) salti.push(liv[i - 1] + "->" + liv[i]);
    return {
      bersagli: ber.length, senzaNome: senzaNome, soloPlaceholder: soloPh,
      sottomisura: perSpaziatura + falliti.length, perSpaziatura: perSpaziatura, falliti: falliti,
      idDup: dup, ariaRotti: rotti, h1: document.querySelectorAll("h1").length, salti: salti,
      scorrimento: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }

  /* ---------- 4. tutto insieme, in forma leggibile ---------- */

  function tutto() {
    var c = contrasto(4), g = grafica(), a = struttura();
    return {
      larghezza: window.innerWidth,
      tema: document.querySelector(".pt") ? document.querySelector(".pt").getAttribute("data-theme") : "?",
      testo: c.falliti + "/" + c.testi,
      testoDettaglio: c.elenco.map(function (x) { return x.el + " " + x.r + ":1 su " + x.bg + " «" + x.t + "»"; }),
      grafica: g.sotto3 + "/" + g.esaminati, graficaMin: g.min, esentiNativi: g.esentiNativi,
      graficaDettaglio: g.elenco.map(function (x) { return x.cl + " " + x.r + ":1"; }),
      bersagli: a.falliti.length + "/" + a.bersagli, perSpaziatura: a.perSpaziatura,
      bersagliDettaglio: a.falliti.map(function (x) { return x.el + " " + x.m + " contro " + x.contro.join(", "); }),
      senzaNome: a.senzaNome, soloPlaceholder: a.soloPlaceholder,
      idDup: a.idDup, ariaRotti: a.ariaRotti, h1: a.h1, salti: a.salti, scorrimento: a.scorrimento
    };
  }

  /* CONTROPROVA. Un auditor che non trova niente può essere giusto oppure
     rotto, e senza sporcare di proposito i due casi non si distinguono.
     Sporca tre testi, misura, ripristina. */
  function controprova() {
    var bersagli = [
      [document.querySelector("#app h1"), "#dddddd"],
      [document.querySelector("#app p"), "rgba(0,0,0,0.18)"],
      [document.querySelector("#app button.add"), "#333333"]
    ].filter(function (x) { return !!x[0]; });
    var prima = contrasto().falliti;
    var salva = bersagli.map(function (x) { var v = x[0].style.color; x[0].style.color = x[1]; return [x[0], v]; });
    var dopo = contrasto(6);
    salva.forEach(function (s) { s[0].style.color = s[1]; });
    return { prima: prima, sporcati: bersagli.length, trovati: dopo.falliti,
             quali: dopo.elenco.map(function (x) { return x.el + " " + x.r + ":1"; }),
             dopoRipristino: contrasto().falliti };
  }

  /* Percorre le viste principali e misura ognuna. Cambia lo stato del
     pannello: si usa su dati di prova, non sui propri. */
  async function viste() {
    function pausa(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    var out = {};
    function sintesi() {
      var t = tutto();
      return {
        riassunto: t.testo + " testo · " + t.grafica + " comandi · " + t.bersagli + " bersagli · " +
                   t.senzaNome.length + " senza nome · " + t.idDup.length + " id doppi · " +
                   t.salti.length + " salti · scorrimento " + t.scorrimento,
        testoDettaglio: t.testoDettaglio, graficaDettaglio: t.graficaDettaglio,
        bersagliDettaglio: t.bersagliDettaglio, senzaNome: t.senzaNome, h1: t.h1
      };
    }
    S_ = window.S;
    S_.data.settings.modo = "semplice"; S_.addMore = false; S_.filtri = false;
    S_.searchOpen = false; S_.query = ""; S_.stepsOpen = null;
    if (typeof forzaProssimoCompleto === "function") forzaProssimoCompleto();
    render(); await pausa(320);
    out.home = sintesi();

    S_.data.settings.modo = "avanzata"; S_.addMore = true; S_.filtri = true;
    S_.ui = S_.ui || {}; S_.ui.freq = "weekly"; S_.ui.start = "9";
    forzaProssimoCompleto(); render(); await pausa(320);
    out.aggiunta = sintesi();

    var b = document.querySelector('#app button.del[data-act="open"]');
    if (b) b.click();
    await pausa(260);
    var m = [].slice.call(document.querySelectorAll("#app button")).filter(function (e) { return /altri campi/.test(e.textContent || ""); })[0];
    if (m) m.click();
    await pausa(320);
    out.dettaglioTask = sintesi();

    var imp = [].slice.call(document.querySelectorAll("#app button.foldbtn")).filter(function (e) { return /Impostazioni/.test(e.textContent || ""); })[0];
    if (imp) imp.click();
    await pausa(260);
    [].slice.call(document.querySelectorAll("#app button")).forEach(function (e) { if (/▸/.test(e.textContent || "")) e.click(); });
    await pausa(480);
    out.impostazioni = sintesi();

    window.P.dense = true; if (typeof savePrefs === "function") savePrefs();
    forzaProssimoCompleto(); render(); await pausa(360);
    out.compatta = sintesi();
    window.P.dense = false; if (typeof savePrefs === "function") savePrefs();
    forzaProssimoCompleto(); render(); await pausa(260);
    return out;
  }
  var S_;

  window.PTCollaudo = {
    fondi: fondi, visibile: visibile, contrasto: contrasto, grafica: grafica,
    congela: congela, scongela: scongela, visibilita: function(){ return document.visibilityState; },
    struttura: struttura, tutto: tutto, controprova: controprova, viste: viste,
    rapporto: R
  };
  if (typeof console !== "undefined" && console.log)
    console.log("_collaudo.js pronto: PTCollaudo.tutto(), .controprova(), await PTCollaudo.viste()");
})();
