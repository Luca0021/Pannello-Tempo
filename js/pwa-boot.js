/* pwa-boot.js — registrazione del service worker e invito all'installazione.
   Estratto dallo script inline di index.html perché la Content Security
   Policy possa vietare gli script inline (SEC-003). */

/* DIFETTO CORRETTO — la nuova versione non arrivava mai all'utente.

   Il meccanismo era spezzato in tre punti che si annullavano a vicenda:

     1. sw.js non fa `skipWaiting` da solo — scelta giusta: chi sta scrivendo
        non deve vedersi ricaricare la pagina sotto le mani — e aspetta il
        messaggio 'aggiorna-ora' dalla pagina;
     2. nessun modulo mandava quel messaggio;
     3. `mostraAggiornamento()` era chiamata qui dentro ma non era definita in
        nessuno dei 58 moduli, e la chiamata era protetta da `typeof`: quindi
        non dava errore, non faceva niente, e non se ne accorgeva nessuno.

   Risultato: il worker nuovo si installava, entrava in stato «waiting» e ci
   restava per sempre. Il pannello continuava a servire la build vecchia, e
   l'unico modo per uscirne era Ctrl+Shift+R — che è esattamente il consiglio
   finito in COME-CARICARE.md come se fosse normale.

   Mancava anche il caso più frequente: il worker che è finito in attesa
   durante una visita precedente. All'apertura successiva `updatefound` non
   scatta più — era già scattato — e `reg.waiting` è già lì. Senza guardarlo,
   quell'aggiornamento non si applica mai. */

/* Segnala l'aggiornamento all'interfaccia. La striscia vive in js/render.js e
   il comando in js/events.js: qui si tiene solo il riferimento al worker in
   attesa, che è l'unico a saper applicare il cambio. */
var _regInAttesa = null;

function mostraAggiornamento(reg){
  if (!reg || !reg.waiting) return;
  _regInAttesa = reg;
  if (typeof S === "undefined") return;
  S.aggiornamento = { pronto: true };
  if (typeof render === "function") render();
}

/* Applica l'aggiornamento su richiesta esplicita. Prima salva: ricaricare
   senza salvare perderebbe l'ultima modifica, ed è il motivo per cui sw.js
   non si aggiorna da solo. */
function applicaAggiornamento(){
  var reg = _regInAttesa;
  if (typeof save === "function") { try { save(); } catch (e) {} }
  if (!reg || !reg.waiting) { location.reload(); return; }
  /* la pagina resta controllata dal worker vecchio finché il nuovo non prende
     il posto: si ricarica quando il cambio è confermato, non prima */
  var ricaricato = false;
  navigator.serviceWorker.addEventListener("controllerchange", function(){
    if (ricaricato) return;
    ricaricato = true;
    location.reload();
  });
  reg.waiting.postMessage("aggiorna-ora");
  /* se il cambio non arriva — worker bloccato, evento perso — si ricarica
     comunque: restare fermi sulla versione vecchia è il difetto di partenza */
  setTimeout(function(){ if (!ricaricato) { ricaricato = true; location.reload(); } }, 4000);
}

/* registrazione del service worker: solo su http/https, mai da file://, e mai
   dentro una cornice — là il pannello non si è avviato (vedi js/boot.js), non
   c'è nessuno stato da aggiornare e `render()` non avrebbe dati da disegnare */
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0 &&
    !(typeof dentroUnaCornice === "function" && dentroUnaCornice())) {
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").then(function(reg){
      /* già in attesa da una visita precedente: `updatefound` non tornerà */
      if (reg.waiting && navigator.serviceWorker.controller) mostraAggiornamento(reg);
      reg.addEventListener("updatefound", function(){
        var nuovo = reg.installing;
        if (!nuovo) return;
        nuovo.addEventListener("statechange", function(){
          if (nuovo.state === "installed" && navigator.serviceWorker.controller) {
            /* non ricarico da solo: l'utente potrebbe stare scrivendo */
            mostraAggiornamento(reg);
          }
        });
      });
    }).catch(function(){ /* senza service worker il pannello funziona lo stesso */ });
  });
}
window.addEventListener("beforeinstallprompt", function(e){
  e.preventDefault();
  if (typeof Platform !== "undefined") {
    Platform.installa.invito = e;
    Platform.capacita.installabile = true;
  }
});
