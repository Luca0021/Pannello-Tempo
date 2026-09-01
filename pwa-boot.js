/* pwa-boot.js — registrazione del service worker e invito all'installazione.
   Estratto dallo script inline di index.html perché la Content Security
   Policy possa vietare gli script inline (SEC-003). */
/* registrazione del service worker: solo su http/https, mai da file:// */
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").then(function(reg){
      reg.addEventListener("updatefound", function(){
        var nuovo = reg.installing;
        if (!nuovo) return;
        nuovo.addEventListener("statechange", function(){
          if (nuovo.state === "installed" && navigator.serviceWorker.controller) {
            /* non ricarico da solo: l'utente potrebbe stare scrivendo */
            if (typeof mostraAggiornamento === "function") mostraAggiornamento(reg);
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
