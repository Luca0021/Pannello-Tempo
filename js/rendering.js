/* rendering.js — ARC-003: aggiornamento per zone invece che dell'intera pagina.

   Il pannello produceva l'HTML completo e lo assegnava a #app.innerHTML a ogni
   modifica. Conseguenza principale: uno screen reader riceveva l'intera pagina
   come aggiornamento anche per una spunta.

   Qui la stringa prodotta viene divisa in ZONE lungo marcatori inseriti dal
   codice di disegno, e solo le zone il cui contenuto è cambiato vengono
   riscritte. I nodi delle zone invariate restano gli stessi oggetti DOM.

   Passo 3: dentro una zona cambiata, se l'unica differenza sono le righe di un
   elenco, si sostituiscono le sole righe diverse riconosciute per data-id. */

var ZONE = ["nav","hero","priorita","riprogrammare","rituale","agenda","today",
            "routine","altro","settings","modali"];

/* Impronta di una stringa: serve solo a dire «uguale o diverso». */
function improntaZona(t){
  var h = 0x811c9dc5;
  for (var i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h.toString(16) + ":" + t.length;
}

var _improntePrec = {};
var _zoneMontate = false;
var STAT_ZONE = { montaggi:0, aggiornate:0, saltate:0, righe:0, ultimo:[], toccate:{} };
function azzeraStatZone(){
  STAT_ZONE.montaggi = 0; STAT_ZONE.aggiornate = 0; STAT_ZONE.saltate = 0;
  STAT_ZONE.righe = 0; STAT_ZONE.ultimo = []; STAT_ZONE.toccate = {};
}

/* Divide l'HTML completo nelle zone, seguendo i marcatori <!--Z:nome-->.
   Ciò che precede il primo marcatore appartiene alla zona «nav». */
function dividiZone(html){
  var out = {}, ordine = [];
  var pezzi = html.split(/<!--Z:([a-z]+)-->/);
  var testa = pezzi[0];
  if (testa && testa.trim()) { out.nav = testa; ordine.push("nav"); }
  for (var i = 1; i < pezzi.length; i += 2) {
    var nome = pezzi[i], corpo = pezzi[i+1] || "";
    if (out[nome] === undefined) { out[nome] = corpo; ordine.push(nome); }
    else out[nome] += corpo;      /* una zona può comparire più volte */
  }
  return { zone: out, ordine: ordine };
}

/* Primo disegno: costruisce i contenitori stabili, uno per zona. */
function montaZone(root, diviso, attrWrap){
  /* Si montano TUTTE le zone conosciute, anche quelle senza contenuto adesso.
     Prima si creavano solo quelle presenti al primo disegno: una zona che
     compariva più tardi — l'agenda quando si cambia filtro — non aveva un
     contenitore in cui finire, e il suo contenuto non veniva mostrato fino al
     disegno completo successivo.
     I contenitori vuoti sono innocui: `[data-zona]:empty` li nasconde. */
  var elenco = ZONE.slice();
  diviso.ordine.forEach(function(n){ if (elenco.indexOf(n) < 0) elenco.push(n); });
  var h = '<div class="wrap"'+(attrWrap||'')+'>';
  elenco.forEach(function(n){
    h += '<div data-zona="'+n+'">'+(diviso.zone[n] || "")+'</div>';
  });
  h += '<p class="sr" role="status" aria-live="polite" id="annunci"></p></div>';
  root.innerHTML = h;
  _zoneMontate = true;
  STAT_ZONE.montaggi++;
  elenco.forEach(function(n){ _improntePrec[n] = improntaZona(diviso.zone[n] || ""); });
}

/* Aggiornamenti successivi: tocca solo ciò che è cambiato. */
function aggiornaZone(root, diviso){
  var toccate = [], saltate = 0;
  diviso.ordine.forEach(function(n){
    var imp = improntaZona(diviso.zone[n]);
    if (_improntePrec[n] === imp) { saltate++; return; }
    var cont = root.querySelector ? root.querySelector('[data-zona="'+n+'"]') : null;
    if (!cont) { _improntePrec[n] = null; return; }   /* zona nuova: serve un montaggio */
    aggiornaContenuto(cont, diviso.zone[n]);
    _improntePrec[n] = imp;
    toccate.push(n);
  });
  /* una zona sparita va svuotata, non lasciata con contenuto vecchio */
  Object.keys(_improntePrec).forEach(function(n){
    if (diviso.zone[n] === undefined && _improntePrec[n] !== null) {
      var c = root.querySelector ? root.querySelector('[data-zona="'+n+'"]') : null;
      if (c) c.innerHTML = "";
      _improntePrec[n] = null;
      toccate.push(n);
    }
  });
  STAT_ZONE.aggiornate += toccate.length;
  STAT_ZONE.saltate += saltate;
  STAT_ZONE.ultimo = toccate;
  toccate.forEach(function(n){ STAT_ZONE.toccate[n] = (STAT_ZONE.toccate[n]||0) + 1; });
  return toccate;
}

/* Passo 3 — confronto ricorsivo nodo per nodo.

   Rifare l'innerHTML di una zona ricostruisce tutte le sue righe anche quando
   ne è cambiata una sola. Qui il vecchio albero e il nuovo vengono confrontati
   in profondità e si sostituisce **solo ciò che differisce**: un contatore che
   passa da 0/3 a 1/3 cambia il suo nodo di testo, le righe accanto restano gli
   stessi oggetti DOM.

   Quando la struttura cambia troppo (numero di figli diverso e nessuna chiave
   utile) si ricade sulla riscrittura del ramo: è una resa dichiarata, non un
   errore. */
function sincronizza(vecchio, nuovo, soloFigli){
  /* testo e commenti: aggiorno il valore, non sostituisco il nodo */
  if (vecchio.nodeType === 3 || vecchio.nodeType === 8) {
    if (nuovo.nodeType !== vecchio.nodeType) return false;
    if (vecchio.nodeValue !== nuovo.nodeValue) vecchio.nodeValue = nuovo.nodeValue;
    return true;
  }
  if (vecchio.nodeType !== 1 || nuovo.nodeType !== 1) return false;
  if (vecchio.tagName !== nuovo.tagName) return false;

  /* Al primo livello NON si copiano gli attributi: il nuovo albero vive in un
     contenitore temporaneo che non ha `data-zona`, e copiarne gli attributi
     cancellava l'identificativo della zona facendola sparire. */
  if (!soloFigli) sincronizzaAttributi(vecchio, nuovo);

  var vf = vecchio.childNodes, nf = nuovo.childNodes;
  /* stessa forma: confronto in parallelo */
  if (vf.length === nf.length) {
    var tutti = true;
    for (var i = 0; i < vf.length; i++) {
      if (!sincronizza(vf[i], nf[i])) {
        vecchio.replaceChild(clona(nf[i]), vf[i]);
        STAT_ZONE.righe++;
      }
    }
    return tutti;
  }
  /* forma diversa: provo con le chiavi data-id, altrimenti mi arrendo */
  return sincronizzaPerChiave(vecchio, nuovo);
}

function sincronizzaAttributi(vecchio, nuovo){
  var vn = nomiAttributi(vecchio), nn = nomiAttributi(nuovo);
  nn.forEach(function(a){
    if (vecchio.getAttribute(a) !== nuovo.getAttribute(a))
      vecchio.setAttribute(a, nuovo.getAttribute(a));
  });
  vn.forEach(function(a){
    if (nuovo.getAttribute(a) === null && vecchio.removeAttribute) vecchio.removeAttribute(a);
  });
}
function nomiAttributi(n){
  if (n.attributi) return Object.keys(n.attributi);          /* DOM di prova */
  if (n.attributes) {                                         /* DOM del browser */
    var out = [];
    for (var i = 0; i < n.attributes.length; i++) out.push(n.attributes[i].name);
    return out;
  }
  return [];
}
function clona(n){
  if (n.cloneNode) return n.cloneNode(true);
  var t = document.createElement("div");
  t.innerHTML = n.outerHTML !== undefined ? n.outerHTML : String(n.nodeValue || "");
  return t.childNodes[0];
}

/* Figli identificati da data-id: riuso quelli che esistono già. */
function sincronizzaPerChiave(vecchio, nuovo){
  var vf = vecchio.childNodes, nf = nuovo.childNodes;
  var chiaviNuove = [], ok = true;
  for (var i = 0; i < nf.length; i++) {
    var c = nf[i].getAttribute ? nf[i].getAttribute("data-id") : null;
    if (!c) { ok = false; break; }
    chiaviNuove.push(c);
  }
  if (!ok) return false;
  var perChiave = {};
  for (var j = 0; j < vf.length; j++) {
    var k = vf[j].getAttribute ? vf[j].getAttribute("data-id") : null;
    if (k) perChiave[k] = vf[j];
  }
  /* ricostruisco l'ordine riusando i nodi esistenti */
  var finali = [];
  for (var n2 = 0; n2 < nf.length; n2++) {
    var esistente = perChiave[chiaviNuove[n2]];
    if (esistente && sincronizza(esistente, nf[n2])) finali.push(esistente);
    else { finali.push(clona(nf[n2])); STAT_ZONE.righe++; }
  }
  /* applico l'ordine finale */
  while (vecchio.childNodes.length) vecchio.removeChild(vecchio.childNodes[0]);
  finali.forEach(function(f){ vecchio.appendChild(f); });
  return true;
}

/* Aggiorna una zona confrontando gli alberi invece di riscriverli. */
function aggiornaContenuto(cont, nuovoHtml){
  if (typeof document === "undefined" || !document.createElement) { cont.innerHTML = nuovoHtml; return; }
  var tmp;
  try { tmp = document.createElement("div"); tmp.innerHTML = nuovoHtml; }
  catch (e) { cont.innerHTML = nuovoHtml; return; }
  if (!sincronizza(cont, tmp, true)) cont.innerHTML = nuovoHtml;
}

/* Punto di ingresso: decide fra montaggio e aggiornamento. */
function applicaZone(root, html, attrWrap, forzaCompleto){
  var diviso = dividiZone(html);
  if (!_zoneMontate || forzaCompleto || !root.querySelector ||
      !root.querySelector('[data-zona="hero"]')) {
    montaZone(root, diviso, attrWrap);
    return { completo: true, toccate: diviso.ordine };
  }
  /* l'attributo del contenitore può cambiare senza toccare le zone */
  var wrap = root.querySelector('.wrap');
  if (wrap && wrap.setAttribute) {
    if (attrWrap) wrap.setAttribute("data-notes", "1");
    else if (wrap.removeAttribute) wrap.removeAttribute("data-notes");
  }
  return { completo: false, toccate: aggiornaZone(root, diviso) };
}

/* Il disegno completo resta legittimo in tre casi soli, dichiarati qui. */
function serveDisegnoCompleto(motivo){
  return ["primo-caricamento", "cambio-profilo", "dataset-sostituito"].indexOf(motivo) >= 0;
}
function forzaProssimoCompleto(){ _zoneMontate = false; }

/* Passo 4 — annunci mirati in una regione piccola e separata. */
function annunciaMirato(testo){
  if (typeof document === "undefined" || !document.getElementById) return;
  var z = document.getElementById("annunci");
  if (!z) return;
  z.textContent = "";
  setTimeout(function(){ z.textContent = testo; }, 30);
}
