/* boot.js — avvio, timer, eventi di finestra
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- avvio ---------- */

/* DIFETTO CORRETTO — la protezione da clickjacking non c'era.

   SECURITY-REPORT.md dichiara: «`frame-ancestors 'none'` copre la protezione
   da clickjacking». Non la copre, perché `frame-ancestors` è una delle
   direttive che il browser **ignora** quando la CSP arriva da un `<meta>`:
   funziona solo come intestazione HTTP. Il browser lo dice anche a voce:

     The Content Security Policy directive 'frame-ancestors' is ignored
     when delivered via a <meta> element.

   Verificato mettendo il pannello in un iframe della propria pagina: si
   carica senza ostacoli. `X-Frame-Options` avrebbe lo stesso problema —
   serve un'intestazione, e GitHub Pages non permette di configurarle: è
   scritto nel report stesso.

   Senza un server, l'unico controllo possibile sta qui. Non tenta di uscire
   dalla cornice — `top.location` è vietato fra origini diverse e un tentativo
   fallito lascerebbe la pagina a metà — ma si rifiuta di partire e dice
   perché, con un collegamento per aprire il pannello dove deve stare.

   Il `frame-ancestors` resta nella CSP: costa nulla e diventa attivo il
   giorno in cui il pannello venisse servito da qualcosa che sa mandare
   intestazioni. */
function dentroUnaCornice(){
  /* il confronto fra finestre è permesso anche fra origini diverse: non
     serve leggere niente di `top`, e quindi non può fallire */
  try { return window.top !== window.self; } catch (e) { return true; }
}
function rifiutaLaCornice(){
  document.title = "Pannello Tempo — apertura non consentita";
  var app = document.getElementById("app");
  if (!app) return;
  app.textContent = "";
  var p = document.createElement("p");
  p.className = "warn";
  p.textContent = "Il pannello non si apre dentro la pagina di qualcun altro: "+
    "quello che vedresti potrebbe non essere quello che stai toccando. "+
    "Aprilo in una scheda sua.";
  var a = document.createElement("a");
  a.href = location.href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Apri Pannello Tempo";
  app.appendChild(p);
  app.appendChild(a);
}

if (dentroUnaCornice()) rifiutaLaCornice();
else avvia();

/* L'avvio vero. Sta in una funzione per una ragione sola: poterlo non
   chiamare. Prima era una sequenza di istruzioni al primo livello del file, e
   al primo livello non si può uscire prima della fine. */
function avvia(){

load();
loadSync();
/* Al primo avvio il pannello si presenta invece di lasciarti davanti a una
   parete di schede: è il momento in cui si decide se il prodotto viene adottato. */
/* SEC-001: le credenziali lasciate da versioni precedenti vengono rimosse
   prima di qualunque altra cosa */
(function(){
  var p = pulisciCredenzialiLegacy();
  /* SEC-001: toglie i token di rinnovo salvati dalle versioni precedenti.
     Gira a ogni avvio: un token rimasto lì da mesi è proprio il caso da
     eliminare, e la funzione è idempotente. */
  var tp = ripulisciTokenPersistenti();
  if (tp.quanti) registraOperazione("sicurezza", "rimossi token persistenti: " + tp.tolti.join(", "));
  if (!p.gia && p.rimosse.length) {
    registraOperazione("sicurezza", "rimosse credenziali di versioni precedenti: "+p.rimosse.length);
    save();
  }
})();
if (onboardingDaMostrare()) apriOnboarding(1);
render();
if (syncReady()) pullNow();
setInterval(function(){
  if (syncReady() && !sync.busy && !sync.conflict) pullNow();
}, 120000);
window.addEventListener("storage", function(e){
  /* un'altra scheda dello stesso browser ha salvato: ricarico invece di sovrascrivere */
  if (e.key !== KEY) return;
  if (S.editId || S.dragging || S.linkEdit) return;
  var a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  load(); render();
});
window.addEventListener("focus", function(){
  if (syncReady() && !sync.busy && !sync.conflict) pullNow();
});
window.addEventListener("beforeunload", function(){
  if (syncReady() && sync.auto && sync.dirty && navigator.sendBeacon) {
    /* ultimo tentativo: se non riesce, resta in sospeso e riparte alla prossima apertura */
  }
});
setInterval(function(){
  if (S.dragging) return;
  var a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  var before = dk();
  S.now = new Date();
  if (dk() !== before) { S.scrolled = false; rollover(); render(); return; }
  /* ridisegna solo se c'è qualcosa che dipende dal minuto */
  controllaAvvisi();
  if (isToday() || S.view !== "giorno") render();
}, 60000);

}   /* fine di avvia() */
