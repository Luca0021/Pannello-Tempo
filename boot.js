/* boot.js — avvio, timer, eventi di finestra
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- avvio ---------- */
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
