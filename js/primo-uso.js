/* primo-uso.js — UI-008: che cosa ha già visto chi sta usando il pannello.
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server.

   ───────────────────────────────────────────────────────────────────────────
   PERCHÉ QUESTO MODULO ESISTE, E PERCHÉ NON SCRIVE NEI DATI
   ───────────────────────────────────────────────────────────────────────────

   Un'osservazione misurata del primo accesso: la home di un utente appena
   arrivato mostra 595 parole e 119 comandi su desktop, 140 su telefono, di
   cui soltanto 30 sopra la piega. Nove schede, tutte legittime, tutte
   senza una riga che dica a cosa servono. Chi salta l'ingresso guidato non
   trova più, in nessun punto della home, una frase che dica che cosa fa il
   prodotto.

   Le spiegazioni di questo modulo NON sono documentazione: sono la seconda
   riga di una sezione, mostrata **una volta sola**, e solo per la sezione
   che stai guardando adesso.

   ── Una per volta, non nove ──
   Nove fumetti aperti insieme sarebbero peggio di nessuno: la schermata
   diventerebbe un modulo da compilare. Ne compare **uno**: il primo non
   ancora visto, nell'ordine in cui la pagina si legge.

   ── Dove vengono ricordate: sul dispositivo, non nei dati ──
   `P` è il posto delle preferenze locali (`pannello-tempo:prefs`), non
   `S.data.settings`. La differenza è sostanziale e il repository l'ha già
   pagata una volta: tema, densità e sezioni chiuse viaggiavano coi dati, e
   un dispositivo imponeva le sue scelte all'altro (vedi `migratePrefs` in
   sync.js). «Questa spiegazione l'ho già letta» è un fatto di questo
   schermo, non del proprio archivio: sul telefono nuovo va rivista.

   Conseguenza voluta: nessun campo nuovo nel documento sincronizzato,
   nessuna migrazione di schema, nessun dato dell'utente toccato. */

/* ─────────────────────────────────────────────────────────────────────────
   1. LE SPIEGAZIONI DI SEZIONE
   ─────────────────────────────────────────────────────────────────────────

   Due righe al massimo, ed è un vincolo, non un consiglio: `scopo` risponde
   a «a che serve», `esempio` a «quando la uso». Se una voce ha bisogno di
   più spazio, il posto è la guida — non un fumetto sopra la sezione.

   L'ordine di questo elenco è l'ordine in cui le spiegazioni compaiono, ed
   è l'ordine in cui la home si legge dall'alto. */
var SPIEGAZIONI = [
  { sez:"focus", titolo:"Priorità di oggi",
    scopo:"Le poche cose che vuoi aver fatto entro stasera: al massimo tre.",
    esempio:"Scrivile qui la mattina, oppure tocca ★ su un task che hai già." },

  { sez:"agenda", titolo:"Agenda",
    scopo:"Dove le cose hanno un'ora, così vedi se ci stanno davvero nella giornata.",
    esempio:"Tocca una fascia libera per creare qualcosa a quell'ora." },

  { sez:"today", titolo:"Da fare oggi",
    scopo:"Tutto ciò che riguarda oggi, con o senza orario.",
    esempio:"Spunta la casella quando è fatto: si azzera da sola domani." },

  { sez:"routine", titolo:"Routine",
    scopo:"Le cose che tornano: ogni settimana, ogni mese, ogni anno.",
    esempio:"Se salti una routine non diventa un arretrato: il giorno è passato." },

  { sez:"ripensare", titolo:"Da riprogrammare",
    scopo:"Ciò che è rimasto indietro, con cinque modi per deciderne la sorte.",
    esempio:"«Non serve più» archivia senza cancellare: la ritrovi cercando." },

  { sez:"note", titolo:"Posta in arrivo",
    scopo:"Un posto dove buttare un pensiero adesso e smistarlo dopo.",
    esempio:"«Chiedere a Marco il numero del gommista» — poi diventa un task." },

  { sez:"rituale", titolo:"Chiusura di giornata",
    scopo:"Tre minuti la sera per chiudere oggi e preparare domani.",
    esempio:"Compare dal pomeriggio in poi: è il momento in cui il pannello ti restituisce qualcosa." },

  { sez:"attivazione", titolo:"Come prendere la mano",
    scopo:"Sei traguardi che si spuntano da soli mentre usi il pannello.",
    esempio:"Non è un compito: quando è completa sparisce e non torna." }
];

function spiegazioneDi(sez){
  for (var i = 0; i < SPIEGAZIONI.length; i++)
    if (SPIEGAZIONI[i].sez === sez) return SPIEGAZIONI[i];
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   2. CHE COSA È GIÀ STATO VISTO
   ───────────────────────────────────────────────────────────────────────── */

/* `P.visti` è una mappa chiave → 1. Le chiavi delle spiegazioni sono
   prefissate, così lo stesso registro può servire anche al tour e alla
   modalità scoperta senza che i nomi si pestino i piedi. */
function registroVisti(){
  if (!P.visti || typeof P.visti !== "object") P.visti = {};
  return P.visti;
}
function giaVisto(chiave){ return !!registroVisti()[chiave]; }
function segnaVisto(chiave){
  registroVisti()[chiave] = 1;
  savePrefs();
}
function dimenticaVisti(prefisso){
  var r = registroVisti();
  Object.keys(r).forEach(function(k){
    if (!prefisso || k.indexOf(prefisso) === 0) delete r[k];
  });
  savePrefs();
}

/* L'interruttore generale. Predefinito ACCESO, e si spegne con un gesto dal
   fumetto stesso: chi non le vuole non deve cercarle nelle impostazioni. */
function spiegazioniAttive(){ return P.spiegazioni !== false; }
function spegniSpiegazioni(){
  P.spiegazioni = false;
  savePrefs();
}
function accendiSpiegazioni(){
  P.spiegazioni = true;
  dimenticaVisti("spieg:");
  savePrefs();
}

/* Quante ne restano da vedere: serve alle impostazioni per dire lo stato
   con un numero invece che con un'etichetta vaga. */
function spiegazioniDaVedere(){
  return SPIEGAZIONI.filter(function(s){ return !giaVisto("spieg:" + s.sez); }).length;
}

/* ─────────────────────────────────────────────────────────────────────────
   3. QUALE SPIEGAZIONE MOSTRARE ADESSO
   ─────────────────────────────────────────────────────────────────────────

   Una sola, e solo se la sua sezione è davvero disegnata in questo momento:
   una spiegazione su una sezione che l'utente non ha davanti non spiega
   niente e brucia l'unica volta in cui poteva servire.

   Non compare mai sopra una schermata che copre il pannello — ingresso,
   chiusura di giornata, revisione, guida, tour — perché là il contesto è un
   altro e il fumetto sarebbe fuori posto. */
function spiegazioneCorrente(sezioniPresenti){
  if (!spiegazioniAttive()) return null;
  if (S.onboarding || S.chiusura || S.revisione) return null;
  if (typeof guidaVisibile === "function" && guidaVisibile()) return null;
  if (typeof tourVisibile === "function" && tourVisibile()) return null;
  if (S.digest || S.searchOpen) return null;
  var presenti = sezioniPresenti || {};
  for (var i = 0; i < SPIEGAZIONI.length; i++) {
    var s = SPIEGAZIONI[i];
    if (!presenti[s.sez]) continue;
    if (giaVisto("spieg:" + s.sez)) continue;
    return s;
  }
  return null;
}

/* Il fumetto. Sta DENTRO la scheda che spiega, subito sotto il titolo:
   un elemento fluttuante posizionato in pixel andrebbe fuori posto a ogni
   ridisegno, e su telefono finirebbe fuori schermo. Qui invece segue il
   flusso, quindi funziona identico a 320px e con lo zoom al 200%. */
function spiegazioneHtml(s){
  if (!s) return "";
  return '<div class="spiegazione" role="note" aria-label="Come funziona: '+esc(s.titolo)+'">'+
    '<p class="spiegtx"><b>'+esc(s.scopo)+'</b><span>'+esc(s.esempio)+'</span></p>'+
    '<div class="spiegazioni-azioni">'+
    '<button class="tiny pos" data-act="spieg-ok" data-v="'+esc(s.sez)+'">Ho capito</button>'+
    '<button class="link" data-act="spieg-mai">Non mostrarmele più</button>'+
    '</div></div>';
}

/* ─────────────────────────────────────────────────────────────────────────
   3-bis. LE VOCI CHE NON HAI SCRITTO TU
   ─────────────────────────────────────────────────────────────────────────

   DIFETTO CORRETTO, misurato al primo accesso: il pannello parte con
   DICIASSETTE voci — «Finestra email», «Blocco focus», «Chiudi la giornata:
   prepara domani» — e la prima schermata dice «0/9 da fare» e «giornata
   piena · 5h 45». Nove cose da fare che l'utente non ha scritto, con nomi
   che non ha scelto, e nessuna riga che dica da dove vengono.

   Le voci restano: sono una proposta ragionata, e cancellarle d'ufficio
   toglierebbe al pannello il suo scheletro (`seed()` in seed.js). Ciò che
   mancava era dirlo. Una riga, una volta, dentro la sezione dove quelle
   voci si vedono — e il conto esatto, perché «alcune voci» non è una
   misura.

   Sparisce da sola quando non ne resta nessuna: chi le ha cambiate tutte
   non ha bisogno che gliene si parli. */
/* `elenco` sono le voci della sezione che ospita l'avviso. Conta QUELLE, non
   tutte: dentro «Da fare oggi», che ne mostra nove, un avviso che dice
   diciassette è esso stesso una cosa da spiegare. */
function avvisoVociIniziali(elenco){
  if (!spiegazioniAttive()) return "";
  if (giaVisto("iniziali:viste")) return "";
  if (typeof vociIniziali !== "function") return "";
  var mappa = vociIniziali();
  var qui = (elenco || S.data.items || []).filter(function(i){ return i && mappa[i.id]; }).length;
  if (!qui) return "";
  var tutte = (S.data.items || []).filter(function(i){ return i && mappa[i.id]; }).length;
  return '<p class="hint avviso iniziali">'+
    '<b>'+(qui === 1 ? 'Una di queste voci non l\'hai scritta tu' : qui + ' di queste voci non le hai scritte tu')+'.</b> '+
    'Il pannello parte con una proposta di giornata'+
    (tutte > qui ? ' — ' + tutte + ' voci in tutto, fra oggi e le routine' : '')+
    ': cambiale, spostale o cancellale come vuoi. Non ne aggiungerà altre. '+
    '<button class="link" data-act="iniziali-ok">Ho capito</button></p>';
}

/* ─────────────────────────────────────────────────────────────────────────
   4. IL MONTAGGIO, DOPO IL DISEGNO
   ─────────────────────────────────────────────────────────────────────────

   Perché dopo e non dentro: le schede della home nascono in una dozzina di
   punti diversi — render.js, task-list-ui.js, priorita-ui.js, config.js —
   e infilare una riga in ognuno avrebbe significato dodici modifiche a
   codice che funziona, per una cosa che riguarda solo le prime volte.

   Qui invece si guarda il DOM appena disegnato, che è anche il modo più
   onesto di sapere quali sezioni l'utente ha DAVANTI: non le dedurrei dai
   dati senza rifare i filtri, i profili e le parti spente.

   L'operazione è idempotente: prima toglie ciò che aveva messo, poi lo
   rimette. Il disegno per zone riscrive solo le zone cambiate, quindi il
   fumetto sopravvive alle spunte e ricompare identico se la sua zona viene
   rifatta. */
function montaPrimoUso(){
  var app = document.getElementById("app");
  if (!app || !app.querySelector) return;

  /* DIFETTO CORRETTO — il fuoco andava perduto premendo «Ho capito».
     Misurato: `document.activeElement` diventava BODY, quindi chi usa la
     tastiera tornava in cima all'ordine di tabulazione proprio mentre
     compariva il fumetto successivo.
     La causa è la natura di questo montaggio: il fumetto non sta nell'HTML
     disegnato, quindi il ripristino del fuoco di render() — che cerca il
     comando per `data-act` nel nuovo HTML — non lo trova. Va rimesso qui,
     dopo l'inserimento, e SOLO se il fuoco era davvero dentro un fumetto:
     rubarlo a chi stava altrove sarebbe un difetto peggiore. */
  var attivo = document.activeElement;
  var fuocoEraNelFumetto = !!(attivo && attivo.closest && attivo.closest(".spiegazione"));

  /* --- via il vecchio --- */
  var vecchi = app.querySelectorAll(".spiegazione,.badge-nuovo");
  for (var i = 0; i < vecchi.length; i++)
    if (vecchi[i].parentNode) vecchi[i].parentNode.removeChild(vecchi[i]);

  /* --- quali sezioni sono davvero a schermo --- */
  var presenti = {};
  var sezioni = app.querySelectorAll("[data-sez]");
  for (var j = 0; j < sezioni.length; j++) {
    var el = sezioni[j];
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width:1, height:1 };
    if (r.width >= 1 && r.height >= 1) presenti[el.getAttribute("data-sez")] = el;
  }

  /* --- una spiegazione, quella giusta --- */
  var s = spiegazioneCorrente(presenti);
  if (s && presenti[s.sez]) {
    var scheda = presenti[s.sez];
    var tit = scheda.querySelector ? scheda.querySelector("h2") : null;
    var nodo = document.createElement("div");
    nodo.innerHTML = spiegazioneHtml(s);
    var bolla = nodo.firstChild;
    if (bolla) {
      if (tit && tit.nextSibling) scheda.insertBefore(bolla, tit.nextSibling);
      else if (tit) scheda.appendChild(bolla);
      else scheda.insertBefore(bolla, scheda.firstChild);
      /* il fuoco torna dove era: sul comando del fumetto nuovo */
      if (fuocoEraNelFumetto) {
        var b = bolla.querySelector ? bolla.querySelector('[data-act="spieg-ok"]') : null;
        if (b && b.focus) { try { b.focus({ preventScroll:true }); } catch (e3) { b.focus(); } }
      }
    }
  }

  /* --- chi arriva da una domanda rapida va portato dove aveva letto --- */
  if (S.mirinoSez !== undefined && S.mirinoSez !== null) {
    var mira = document.getElementById("setsez-" + S.mirinoSez) ||
               app.querySelector(".setcard");
    S.mirinoSez = null;
    if (mira && mira.scrollIntoView) {
      try { mira.scrollIntoView({ block:"start", inline:"nearest" }); }
      catch (e2) { mira.scrollIntoView(); }
    }
  }

  /* --- i badge della modalità scoperta --- */
  if (typeof scopertaAttiva === "function" && scopertaAttiva()) {
    Object.keys(presenti).forEach(function(sez){
      var marchio = badgeScoperta(sez);
      if (!marchio) return;
      var t = presenti[sez].querySelector ? presenti[sez].querySelector("h2") : null;
      if (!t) return;
      var d = document.createElement("div");
      d.innerHTML = marchio;
      if (d.firstChild) t.appendChild(d.firstChild);
    });
  }
}
