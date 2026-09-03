/* config-firebase.js — configurazione PUBBLICA del progetto Firebase di
   Pannello Tempo. Generata dalla build a partire dalle variabili d'ambiente:
   vedi FIREBASE-SETUP.md.

   ─────────────────────────────────────────────────────────────────────────
   QUESTO FILE NON CONTIENE SEGRETI, E NON DEVE CONTENERNE.
   ─────────────────────────────────────────────────────────────────────────

   `apiKey` non è una credenziale: identifica il progetto, non autorizza
   nulla. Google la pubblica nei propri esempi. Ciò che protegge i dati sono
   Firebase Authentication e le Security Rules (firebase/firestore.rules),
   più App Check contro l'abuso.

   NON mettere mai qui, e non farli mai arrivare nel repository:
     - service account o private key;
     - segreti lato server;
     - token personali (GitHub, Google o altri);
     - chiavi amministrative;
     - debug token di App Check destinati alla produzione.

   Perché la configurazione sta in un file generato e non nelle impostazioni
   dell'utente: un prodotto consumer non può chiedere a chi lo usa di creare
   un progetto Firebase, incollare una chiave e pubblicare regole di
   sicurezza. Quella era l'architettura precedente ed è la ragione per cui la
   sincronizzazione non era utilizzabile da nessuno senza competenze tecniche.
   La decisione è motivata in SYNC-DECISION.md. */

var FIREBASE_CONFIG = {
  /* "produzione" | "staging" | "sviluppo" | "emulatore" | "non-configurato" */
  ambiente: "non-configurato",

  apiKey:     "",
  authDomain: "",
  projectId:  "",
  appId:      "",

  /* App Check — chiave pubblica del sito reCAPTCHA Enterprise/v3.
     Vuota significa App Check non attivo: la sincronizzazione resta
     possibile, ma senza protezione dall'abuso. Dichiarato, non nascosto. */
  appCheckSiteKey: "",

  /* Usato SOLO quando ambiente === "emulatore". Mai in produzione. */
  emulatore: {
    auth:      "http://127.0.0.1:9099",
    firestore: "http://127.0.0.1:8080"
  }
};

/* ---------- interrogazioni ---------- */

function firebaseConfigurato(){
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
function ambienteFirebase(){
  return FIREBASE_CONFIG.ambiente || "non-configurato";
}
function inProduzione(){
  return ambienteFirebase() === "produzione";
}
function usaEmulatore(){
  return ambienteFirebase() === "emulatore" &&
         !!(FIREBASE_CONFIG.emulatore && FIREBASE_CONFIG.emulatore.firestore);
}

/* Gli endpoint cambiano solo con l'emulatore. Tenere la scelta in un punto
   solo evita che un modulo dimentichi di rispettarla e parli col progetto
   vero durante un collaudo. */
function endpointIdentity(){
  return usaEmulatore()
    ? FIREBASE_CONFIG.emulatore.auth + "/identitytoolkit.googleapis.com/v1"
    : "https://identitytoolkit.googleapis.com/v1";
}
function endpointSecureToken(){
  return usaEmulatore()
    ? FIREBASE_CONFIG.emulatore.auth + "/securetoken.googleapis.com/v1"
    : "https://securetoken.googleapis.com/v1";
}
function endpointFirestore(){
  return usaEmulatore()
    ? FIREBASE_CONFIG.emulatore.firestore + "/v1"
    : "https://firestore.googleapis.com/v1";
}

/* ---------- protezione del progetto di produzione ----------
   Requisito di Fase 2: la build deve impedire di usare per sbaglio il
   progetto di produzione durante i collaudi automatici. Il controllo vive
   qui perché è l'unico posto che conosce l'ambiente, e viene chiamato dai
   test: se passa, il test sta parlando con l'emulatore. */
function vietaProduzioneNeiTest(){
  var inTest = (typeof globalThis !== "undefined" && globalThis.__PT_TEST__ === true);
  if (inTest && inProduzione())
    throw new Error(
      "Collaudo interrotto: FIREBASE_CONFIG.ambiente è «produzione». " +
      "I test non devono toccare il progetto reale. Usa l'ambiente «emulatore».");
  return true;
}

/* Riepilogo leggibile per la schermata Informazioni, senza gergo e senza
   mostrare la configurazione. */
function statoFirebaseLeggibile(){
  if (!firebaseConfigurato())
    return { pronto:false, testo:"Account non disponibile in questa installazione",
             nota:"Questa copia del pannello non è collegata a nessun servizio di account: "+
                  "i dati restano su questo dispositivo." };
  if (usaEmulatore())
    return { pronto:true, testo:"Ambiente di sviluppo",
             nota:"Stai usando un servizio locale di prova, non il servizio reale." };
  return { pronto:true, testo:"Account disponibile",
           nota:"Puoi creare un account per ritrovare i tuoi dati su un altro dispositivo." };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FIREBASE_CONFIG: FIREBASE_CONFIG, firebaseConfigurato: firebaseConfigurato,
    ambienteFirebase: ambienteFirebase, inProduzione: inProduzione, usaEmulatore: usaEmulatore,
    endpointIdentity: endpointIdentity, endpointSecureToken: endpointSecureToken,
    endpointFirestore: endpointFirestore, vietaProduzioneNeiTest: vietaProduzioneNeiTest };
}
