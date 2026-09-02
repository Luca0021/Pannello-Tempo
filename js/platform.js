/* platform.js — adattatore di piattaforma.
   Una sola base di codice per web, e domani per un involucro nativo.
   Qui ci sono solo ripieghi web reali: nessuna API nativa simulata. */
var Platform = {
  capacita: {
    serviceWorker: (typeof navigator !== "undefined" && "serviceWorker" in navigator),
    notifiche: (typeof Notification !== "undefined"),
    installabile: false,          /* diventa vero se arriva beforeinstallprompt */
    standalone: (function(){
      try {
        return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
               window.navigator.standalone === true;
      } catch (e) { return false; }
    })(),
    condivisione: (typeof navigator !== "undefined" && !!navigator.share),
    appunti: (typeof navigator !== "undefined" && !!(navigator.clipboard && navigator.clipboard.writeText)),
    file: (typeof FileReader !== "undefined"),
    rete: (typeof navigator !== "undefined" && "onLine" in navigator)
  },
  archivio: {
    leggi: function(chiave){ try { return localStorage.getItem(chiave); } catch (e) { return null; } },
    scrivi: function(chiave, valore){
      try { localStorage.setItem(chiave, valore); return true; } catch (e) { return false; }
    },
    elimina: function(chiave){
      try { localStorage.removeItem(chiave); return localStorage.getItem(chiave) === null; }
      catch (e) { return false; }
    }
  },
  file: {
    scarica: function(nome, testo, tipo){
      try {
        var b = new Blob([testo], { type: tipo || "text/plain;charset=utf-8" });
        var u = URL.createObjectURL(b);
        var a = document.createElement("a");
        a.href = u; a.download = nome; a.click();
        setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
        return true;
      } catch (e) { return false; }
    }
  },
  condivisione: {
    invia: function(titolo, testo){
      if (navigator.share) { try { navigator.share({ title: titolo, text: testo }); return true; } catch (e) {} }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try { navigator.clipboard.writeText(testo); return "appunti"; } catch (e) {}
      }
      return false;
    }
  },
  notifiche: {
    /* Le notifiche affidabili a pannello chiuso richiedono un server con push.
       Non le promettiamo: il ripiego dichiarato è il calendario del dispositivo. */
    disponibili: function(){
      return Platform.capacita.notifiche && Notification.permission === "granted";
    },
    chiediPermesso: function(poi){
      if (!Platform.capacita.notifiche) { if (poi) poi(false); return; }
      try {
        Notification.requestPermission().then(function(r){ if (poi) poi(r === "granted"); });
      } catch (e) { if (poi) poi(false); }
    },
    mostra: function(titolo, corpo){
      if (!Platform.notifiche.disponibili()) return false;
      try { new Notification(titolo, { body: corpo, icon: "icons/icona-192.png" }); return true; }
      catch (e) { return false; }
    },
    ripiego: "calendario"
  },
  rete: {
    online: function(){ return Platform.capacita.rete ? navigator.onLine : true; }
  },
  installa: {
    invito: null,      /* l'evento intercettato, se il browser lo fornisce */
    possibile: function(){ return !!Platform.installa.invito && !Platform.capacita.standalone; },
    chiedi: function(){
      var ev = Platform.installa.invito;
      if (!ev) return false;
      Platform.installa.invito = null;
      try { ev.prompt(); } catch (e) { return false; }
      return true;
    },
    /* istruzioni per i browser che non espongono l'invito automatico */
    istruzioni: function(){
      var ua = (navigator.userAgent || "").toLowerCase();
      if (/iphone|ipad|ipod/.test(ua))
        return "Safari: tocca Condividi, poi «Aggiungi a Home».";
      if (/firefox/.test(ua))
        return "Firefox: menù ⋮, poi «Installa» o «Aggiungi a schermata Home».";
      return "Dal menù del browser scegli «Installa applicazione».";
    }
  },
  ciclo: {
    /* eventi utili a un futuro involucro nativo: qui li mappiamo su quelli del browser */
    allaRipresa: function(f){
      document.addEventListener("visibilitychange", function(){
        if (!document.hidden) f();
      });
    },
    allUscita: function(f){ window.addEventListener("pagehide", f); }
  }
};
