/* notifiche.js — avvisi mentre il pannello è aperto.
   
   Distinzione che va fatta con precisione, perché è la fonte di metà dei
   malintesi sulle notifiche web:

   1. Pannello APERTO (anche in una scheda in sottofondo): il browser può
      mostrare un avviso di sistema. Non serve nulla: nessun server, nessuna
      chiave. È quello che facciamo qui.

   2. Pannello CHIUSO: serve una notifica push, cioè qualcuno che la spedisca a
      un'ora stabilita. Il browser non può programmarsi un avviso da solo, e
      Firebase Cloud Messaging non spedisce dal client: l'invio richiede una
      credenziale di servizio che non può stare in una pagina web, più qualcosa
      che giri all'ora giusta. Da qui il ripiego del calendario, che gli avvisi
      li sa dare anche a telefono bloccato.

   Il punto 1 copre chi tiene il pannello aperto durante la giornata; il punto 2
   resta bloccato da una dipendenza esterna, e continuiamo a dirlo. */

var GIA_AVVISATO = {};

function notificheAttive(){
  return pref("notificheAperto") === true && Platform.notifiche.disponibili();
}
function chiediNotifiche(poi){
  Platform.notifiche.chiediPermesso(function(ok){
    setImp("notificheAperto", !!ok);
    if (poi) poi(ok);
  });
}

/* Controlla se qualcosa comincia entro i minuti scelti e avvisa una volta sola. */
function controllaAvvisi(){
  if (!notificheAttive() || !isToday()) return;
  var anticipo = (pref("notificheAnticipo") || 10) / 60;
  var ora = nowH();
  dueOn(S.now).forEach(function(i){
    if (typeof i.start !== "number" || isOn(i) || isSkipped(i)) return;
    if (inPausa(i.area)) return;
    var chiave = dk()+":"+i.id+":"+i.start;
    if (GIA_AVVISATO[chiave]) return;
    var mancano = i.start - ora;
    if (mancano <= anticipo && mancano > -0.02) {
      GIA_AVVISATO[chiave] = true;
      Platform.notifiche.mostra(i.label,
        fmt(i.start)+" · "+AREAS[i.area].label+" · "+dur2s(i.dur || 0.5));
    }
  });
}

/* Perché le notifiche potrebbero non essere disponibili: lo diciamo invece di
   lasciare un interruttore che non fa niente. */
function statoNotifiche(){
  if (!Platform.capacita.notifiche)
    return { ok:false, perche:"Questo browser non sa mostrare avvisi di sistema." };
  if (typeof Notification !== "undefined" && Notification.permission === "denied")
    return { ok:false, perche:"Hai negato il permesso: va riattivato dalle impostazioni del browser." };
  if (!pref("notificheAperto"))
    return { ok:false, perche:"" };
  return { ok:true, perche:"" };
}
