/* tour.js — cinque tappe sopra il pannello vero, con il riflettore.
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server.

   ───────────────────────────────────────────────────────────────────────────
   PERCHÉ SERVIVA, DATO CHE UN INGRESSO GUIDATO C'ERA GIÀ
   ───────────────────────────────────────────────────────────────────────────

   `onboarding.js` fa cinque domande su cinque schermate proprie: sceglie il
   profilo, la fascia oraria, la prima priorità. Funziona, ed è misurato —
   fra 34 e 55 parole per passo. Ma ha un limite strutturale: **si svolge
   altrove**. Quando finisce, il pannello appare per la prima volta con nove
   schede e centodiciannove comandi, e nessuna di quelle domande ha detto
   dove stanno le cose.

   Questo tour è l'altra metà: non chiede niente, non salva niente, e sta
   **sopra la pagina vera** illuminando l'elemento di cui parla. Cinque
   tappe, una per gesto quotidiano.

   ── Il riflettore, in una dichiarazione ──
   Il buio è un `box-shadow` con raggio enorme su un rettangolo trasparente:
   una sola regola oscura tutto ciò che sta fuori dal rettangolo, senza
   quattro pannelli da far combaciare e senza ritagli che si disallineano al
   primo ridisegno. Il rettangolo non intercetta i clic (`pointer-events`
   spento), quindi il pannello sotto resta leggibile per quello che è.

   ── Perché la geometria è in linea ──
   Le coordinate cambiano a ogni scorrimento e a ogni larghezza: non possono
   stare in un foglio di stile. La Content Security Policy di questo
   pannello ammette l'attributo `style` proprio per questo (`style-src-attr`,
   vedi la nota in index.html), come già fa l'agenda per i blocchi orari.

   ── Che cosa NON fa ──
   Non blocca il pannello: si chiude con Esc, con «Salta», o con il pulsante
   di chiusura. Non torna mai da solo dopo la prima volta. Non tocca i dati:
   l'unica traccia è `tour:fatto` fra le preferenze **locali**. */

/* Ogni tappa nomina un bersaglio con un selettore. `bersaglio` può elencarne
   più di uno separati da virgola: vale il primo VISIBILE, perché la stessa
   funzione vive in due posti diversi fra telefono e computer — la
   navigazione primaria è disegnata due volte e una delle due è sempre
   nascosta (NAV-001).

   Una tappa senza bersaglio visibile non viene saltata in silenzio: resta,
   centrata, senza riflettore. Saltarla significherebbe che il tour cambia
   numero di passi in base ai dati, e «2 di 5» diventerebbe una bugia. */
var TOUR_PASSI = [
  { id:"benvenuto",
    titolo:"Questo pannello sceglie, non elenca",
    testo:"Ti aiuta a decidere le poche cose che contano oggi e a vedere se ci stanno nella giornata. "+
          "I dati restano sul tuo dispositivo, e funziona anche senza rete.",
    bersaglio:null },

  { id:"priorita",
    titolo:"Le tre cose che contano",
    testo:"Al massimo tre, scelte da te: è il gesto centrale del pannello. "+
          "Se non sai da dove cominciare, qui sotto trovi delle proposte con il perché.",
    bersaglio:'[data-sez="focus"]' },

  { id:"agenda",
    titolo:"L'agenda dice se ci stanno",
    testo:"Le cose con un'ora finiscono qui, e lo spazio libero si vede a occhio. "+
          "Tocca una fascia vuota per creare qualcosa a quell'ora, trascina un blocco per spostarlo.",
    bersaglio:'[data-sez="agenda"]' },

  { id:"nuovo",
    titolo:"Aggiungere qualcosa, in un tocco",
    testo:"Da qui nascono un task, una nota da smistare dopo, o una routine che si ripete. "+
          "Se hai un pensiero e non sai dove metterlo, mettilo in Posta in arrivo.",
    bersaglio:'.fab,.navprim.basso [data-sezione="nuovo"],.navprim.alto [data-sezione="nuovo"]' },

  { id:"personalizza",
    titolo:"Quanto vuoi vedere",
    testo:"Nelle impostazioni scegli il profilo e le parti da mostrare: il pannello può restare minimo o aprirsi tutto. "+
          "Lì trovi anche la guida, e il comando per rivedere questa presentazione.",
    bersaglio:'.setcard,[data-zona="settings"]' }
];

/* QUANDO COMPARE, E PERCHÉ NON AL CARICAMENTO.

   Compare una volta sola, subito dopo aver PORTATO A TERMINE l'ingresso
   guidato. Non al caricamento della pagina, e la differenza non è un
   dettaglio:

   - chi ha SALTATO l'ingresso ha detto «fammi entrare»: aprirgli un secondo
     percorso guidato è non aver ascoltato;
   - chi usa il pannello DA MESI non deve trovarsi un tour addosso perché è
     arrivata una versione nuova. Se dipendesse solo da «non l'ho mai visto»,
     ogni installazione esistente se lo vedrebbe comparire una volta.

   Fuori da questo momento si apre soltanto quando lo si chiede, dalle
   impostazioni. `tourDaMostrare()` resta il guardiano di tutte e due le
   strade. */
function tourDaMostrare(){
  if (S.tour) return false;
  if (S.onboarding || S.chiusura || S.revisione) return false;
  if (typeof guidaVisibile === "function" && guidaVisibile()) return false;
  return !giaVisto("tour:fatto");
}
function tourVisibile(){ return !!S.tour; }

function apriTour(passo){
  S.tour = { passo: Math.max(1, Math.min(TOUR_PASSI.length, passo || 1)) };
  S.tourPosizionato = false;
  render();
}
function tourAvanti(){
  if (!S.tour) return;
  if (S.tour.passo >= TOUR_PASSI.length) { chiudiTour(true); return; }
  S.tour.passo++;
  S.tourPosizionato = false;
  render();
}
function tourIndietro(){
  if (!S.tour) return;
  S.tour.passo = Math.max(1, S.tour.passo - 1);
  S.tourPosizionato = false;
  render();
}
/* `completato` distingue «l'ho visto tutto» da «l'ho chiuso subito», ma il
   segno che lascia è lo stesso: in entrambi i casi non deve ricomparire da
   solo. Chi lo salta ha comunicato una preferenza, non un errore. */
function chiudiTour(completato){
  S.tour = null;
  segnaVisto("tour:fatto");
  if (!completato) toast("Puoi rivederla dalle impostazioni", "info");
  render();
}

function tourPassoCorrente(){
  if (!S.tour) return null;
  return TOUR_PASSI[S.tour.passo - 1] || null;
}

/* Il primo bersaglio VISIBILE fra quelli elencati. */
function tourBersaglio(p){
  if (!p || !p.bersaglio) return null;
  var cont = document.getElementById("app");
  if (!cont || !cont.querySelectorAll) return null;
  var nodi = cont.querySelectorAll(p.bersaglio);
  for (var i = 0; i < nodi.length; i++) {
    var r = nodi[i].getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) return nodi[i];
  }
  return null;
}

function tourHtml(){
  if (!S.tour) return "";
  var p = tourPassoCorrente();
  if (!p) return "";
  var n = S.tour.passo, tot = TOUR_PASSI.length;
  var h = '<div class="tour" data-passo="'+n+'">';
  /* il riflettore: senza bersaglio resta fuori schermo e non oscura niente
     di preciso — ci pensa il velo pieno della tappa di benvenuto */
  h += '<div class="tourvelo'+(p.bersaglio ? "" : " pieno")+'" id="tourvelo" aria-hidden="true"></div>';
  /* DIFETTO CORRETTO — qui c'era `aria-modal="true"`, e contraddiceva il
     comportamento vero. Misurato: col tour aperto, tre Tab portano il fuoco
     fuori dal riquadro, sui collegamenti della pagina. Un riquadro che si
     dichiara modale e non trattiene il fuoco mente a chi lo ascolta.

     La contraddizione si poteva sciogliere in due modi, e uno dei due
     rompeva il tour: trattenere il fuoco. `aria-modal="true"` nasconde alle
     tecnologie assistive TUTTO il resto della pagina — cioè esattamente la
     parte che il riflettore sta illuminando. Un tour che dice «guarda qui»
     e poi rende irraggiungibile il «qui» non serve a niente.

     Quindi resta un dialogo NON modale, e ora lo dichiara: il pannello sotto
     è leggibile col dito, col mouse, col fuoco e con un lettore di schermo.
     La via d'uscita è tripla e documentata: Esc, «Salta», la ×. */
  h += '<div class="tourcard" role="dialog" aria-labelledby="tourtit" id="tourcard">'+
    '<p class="tourconta">'+n+' di '+tot+'</p>'+
    '<h2 id="tourtit">'+esc(p.titolo)+'</h2>'+
    '<p class="tourtx">'+esc(p.testo)+'</p>'+
    '<div class="tourbarra" aria-hidden="true">'+
    TOUR_PASSI.map(function(x, i){
      return '<i'+(i < n ? ' class="fatto"' : '')+'></i>';
    }).join("")+'</div>'+
    '<div class="tourazioni">'+
    (n > 1 ? '<button class="tiny" data-act="tour-indietro">Indietro</button>' : '')+
    '<button class="add" data-act="tour-avanti">'+(n === tot ? "Ho finito" : "Avanti")+'</button>'+
    '<button class="link" data-act="tour-salta">Salta la presentazione</button>'+
    '</div>'+
    '<button class="chiudi" data-act="tour-salta" title="Chiudi la presentazione" '+
    'aria-label="Chiudi la presentazione"></button>'+
    '</div>';
  h += '</div>';
  return h;
}

/* Posiziona riflettore e riquadro DOPO il disegno, quando i rettangoli
   esistono. Chiamata dalla coda di render(), come bindDrag().

   Il riquadro non copre mai il bersaglio: sceglie sotto se c'è spazio,
   sopra altrimenti. Sotto i 700px di altezza — telefono in orizzontale,
   zoom al 200% — si ancora in basso e basta: calcolare una posizione
   «furba» in 300px di altezza produce solo riquadri a metà fuori. */
function posizionaTour(){
  if (!S.tour) return;
  var velo = document.getElementById("tourvelo");
  var card = document.getElementById("tourcard");
  if (!velo || !card) return;
  var p = tourPassoCorrente();
  var el = tourBersaglio(p);

  if (!el) {
    velo.classList.add("pieno");
    velo.removeAttribute("style");
    card.setAttribute("data-ancora", "centro");
    card.removeAttribute("style");
    if (!S.tourPosizionato) { S.tourPosizionato = true; tourFuoco(card); }
    return;
  }

  /* il bersaglio va portato in vista prima di misurarlo: una tappa che
     illumina qualcosa fuori schermo illumina il buio */
  if (!S.tourPosizionato) {
    try { el.scrollIntoView({ block:"center", inline:"nearest" }); } catch (e) { }
  }
  var r = el.getBoundingClientRect();
  var margine = 6;
  velo.classList.remove("pieno");
  velo.setAttribute("style",
    "left:" + Math.max(0, Math.round(r.left - margine)) + "px;" +
    "top:" + Math.max(0, Math.round(r.top - margine)) + "px;" +
    "width:" + Math.round(r.width + margine * 2) + "px;" +
    "height:" + Math.round(r.height + margine * 2) + "px");

  var alto = window.innerHeight || 800;
  var largo = window.innerWidth || 1000;
  /* Sotto i 640px il foglio di stile ancora il riquadro in basso, sopra la
     barra di navigazione fissa. Se qui scrivessi comunque un `top` in linea
     vincerebbe sul foglio — l'attributo `style` batte qualunque regola — e
     il riquadro si troverebbe con `top` e `bottom` entrambi imposti: un
     elemento che si stira fra i due invece di avere la sua altezza.
     Quindi su schermo stretto, o basso, non si scrive geometria: si lascia
     decidere al CSS, che è l'unico posto dove quella scelta è dichiarata. */
  if (largo <= 640 || alto < 700) {
    card.setAttribute("data-ancora", "basso");
    card.removeAttribute("style");
  } else {
    var hc = card.getBoundingClientRect().height || 200;
    var sotto = alto - r.bottom - 18;
    var sopra = r.top - 18;
    if (sotto >= hc) {
      card.setAttribute("data-ancora", "sotto");
      card.setAttribute("style", "top:" + Math.round(r.bottom + 14) + "px");
    } else if (sopra >= hc) {
      card.setAttribute("data-ancora", "sopra");
      card.setAttribute("style", "top:" + Math.round(r.top - hc - 14) + "px");
    } else {
      card.setAttribute("data-ancora", "basso");
      card.removeAttribute("style");
    }
  }
  if (!S.tourPosizionato) { S.tourPosizionato = true; tourFuoco(card); }
}

/* Il fuoco entra nel riquadro: chi naviga da tastiera deve trovarsi dentro
   la cosa che è appena comparsa, non a leggere una pagina che non comanda
   più niente. */
function tourFuoco(card){
  var b = card.querySelector('[data-act="tour-avanti"]');
  if (b && b.focus) { try { b.focus({ preventScroll:true }); } catch (e) { b.focus(); } }
}
