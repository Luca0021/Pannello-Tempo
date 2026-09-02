/* plans.js — piani e disponibilità delle funzioni.
   Nessun pagamento reale: non ci sono provider né credenziali. Qui c'è il
   servizio che decide cosa è disponibile, in un punto solo e verificabile.
   Finché non esiste un incasso, il piano attivo resta quello scelto localmente
   e nessuna funzione viene tolta a chi già la usa. */

/* PRD-001: i piani descrivono che cosa permettono di fare, non che cosa
   contengono. «Sincronizzazione» è una funzione; «ritrovare le tue giornate su
   più dispositivi» è ciò che l'utente compra. */
var PIANI = {
  gratuito: { nome:"Gratuito", prezzo:"0 €", periodo:"",
    promessa:"Scegliere ciò che conta e organizzare la giornata, su un dispositivo.",
    incluse:["tre-cose","task","agenda","routine","note","riepilogo","backup-manuale"] },
  premium:  { nome:"Premium", prezzo:"4 €", periodo:"al mese · 36 € all'anno",
    promessa:"Tutto il gratuito, più l'equilibrio misurato nel tempo e le stesse giornate ovunque.",
    incluse:["*"] },
  lifetime: { nome:"A vita", prezzo:"79 €", periodo:"una volta sola",
    promessa:"Come il Premium, senza rinnovi.",
    incluse:["*"] }
};

/* Funzioni riservate. La chiave è stabile: cambiare il nome visibile non
   cambia il diritto d'accesso. */
var FUNZIONI_PREMIUM = [
  "sincronizzazione", "chiusura-giornata", "revisione-settimanale",
  "statistiche-equilibrio", "etichette", "strumenti-avanzati",
  "importi", "esportazione-calendario", "temi", "modelli-giornata",
  "importazione-calendario"
];

/* Interruttori delle funzioni non ancora disponibili: restano spenti finché
   la dipendenza esterna non c'è. Non simulano nulla. */
var FLAG = {
  pagamenti: false,          /* nessun provider collegato */
  condivisione: false,       /* richiede un backend multiutente */
  sincronizzazioneAccount: false,  /* richiede un servizio account */
  notifichePush: false       /* richiede server push e chiavi VAPID */
};

function pianoAttivo(){
  var p = pref("piano");
  return PIANI[p] ? p : "gratuito";
}
/* Durante lo sviluppo e finché i pagamenti non esistono, nulla viene bloccato:
   sarebbe un muro senza porta. La funzione dice comunque il vero. */
function funzioneDisponibile(chiave){
  if (!FLAG.pagamenti) return true;
  var p = PIANI[pianoAttivo()];
  if (p.incluse.indexOf("*") >= 0) return true;
  if (FUNZIONI_PREMIUM.indexOf(chiave) < 0) return true;
  return p.incluse.indexOf(chiave) >= 0;
}
function funzioneRiservata(chiave){ return FUNZIONI_PREMIUM.indexOf(chiave) >= 0; }
function motivoNonDisponibile(chiave){
  if (funzioneDisponibile(chiave)) return "";
  return "Questa funzione fa parte del piano Premium.";
}
/* Interfaccia del futuro provider di pagamento: dichiarata, non simulata. */
var Pagamenti = {
  disponibile: function(){ return FLAG.pagamenti; },
  acquista: function(){
    return { esito:"non-disponibile",
             motivo:"Nessun provider di pagamento è collegato a questa installazione." };
  },
  ripristina: function(){
    return { esito:"non-disponibile",
             motivo:"Nessun provider di pagamento è collegato a questa installazione." };
  }
};
