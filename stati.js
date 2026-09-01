/* stati.js — SET-003: stati leggibili al posto di parole ambigue.

   Il pannello mostrava stati come «ok», «errore», «collegata», «conflitto».
   Nessuno di questi dice due cose che servono a chi legge:
     1. che cosa è successo davvero;
     2. se deve fare qualcosa, e cosa.

   «ok» in particolare è la parola meno informativa possibile: ok cosa? Il
   salvataggio locale? L'invio al cloud? Entrambi?

   Qui ogni stato è una voce con quattro campi. L'identificativo interno resta
   quello di prima, per non rompere i confronti già scritti nel codice. */

var STATI = {
  "": { breve:"", cosa:"", azione:"", livello:"info" },

  "sincronizzato": {
    breve: "Salvato ovunque",
    cosa:  "Le modifiche sono su questo dispositivo e sul servizio collegato.",
    azione:"", livello:"info" },

  "collegata": {
    breve: "Collegato",
    cosa:  "Il servizio è raggiungibile. Le modifiche partiranno da sole.",
    azione:"", livello:"info" },

  "salvataggio…": {
    breve: "Sto salvando",
    cosa:  "Invio delle modifiche in corso.",
    azione:"", livello:"info" },

  "lettura…": {
    breve: "Sto leggendo",
    cosa:  "Recupero delle modifiche fatte altrove.",
    azione:"", livello:"info" },

  "accesso…": {
    breve: "Sto entrando",
    cosa:  "Verifica delle credenziali in corso.",
    azione:"", livello:"info" },

  "collegamento…": {
    breve: "Mi sto collegando",
    cosa:  "Primo contatto con il servizio.",
    azione:"", livello:"info" },

  "aggiornato dal cloud": {
    breve: "Aggiornato da un altro dispositivo",
    cosa:  "Ho preso modifiche fatte altrove. Qui non c'era niente di più recente.",
    azione:"", livello:"info" },

  "presa la versione remota": {
    breve: "Ho tenuto la versione del cloud",
    cosa:  "Le modifiche locali erano più vecchie e sono state sostituite.",
    azione:"Se non era quello che volevi, annulla.", livello:"attenzione" },

  "unito senza conflitti": {
    breve: "Unito senza perdere niente",
    cosa:  "Le modifiche fatte qui e altrove riguardavano voci diverse.",
    azione:"", livello:"info" },

  "conflitti risolti": {
    breve: "Hai deciso, ora invio",
    cosa:  "Le versioni scelte vengono mandate al servizio.",
    azione:"", livello:"info" },

  "conflitto": {
    breve: "Serve una tua decisione",
    cosa:  "La stessa voce è cambiata qui e su un altro dispositivo.",
    azione:"Scegli quale versione tenere: finché non decidi non viene sovrascritto niente.",
    livello:"attenzione" },

  "in coda": {
    breve: "In attesa di rete",
    cosa:  "Le modifiche sono al sicuro qui e partiranno appena torni in linea.",
    azione:"", livello:"info" },

  "errore": {
    breve: "Non sono riuscito a sincronizzare",
    cosa:  "I tuoi dati sono comunque salvati su questo dispositivo.",
    azione:"Guarda il dettaglio dell'errore qui sotto.", livello:"errore" },

  "dati remoti di una versione più recente: aggiorna il file": {
    breve: "Il cloud ha uno schema più nuovo",
    cosa:  "Un altro dispositivo usa una versione del pannello più recente di questa, "+
           "e i suoi dati non sono leggibili da qui.",
    azione:"Aggiorna il pannello su questo dispositivo, poi riprova: finché non lo fai "+
           "non scarico niente, per non rovinare i dati.",
    livello:"attenzione" },

  "ok": {
    breve: "Salvato su questo dispositivo",
    cosa:  "Nessun servizio collegato: i dati non escono da qui.",
    azione:"", livello:"info" }
};

/* Lo stato leggibile, con una riserva onesta per quelli non ancora tradotti. */
function statoLeggibile(id){
  var s = STATI[id];
  if (s) return s;
  /* Uno stato senza voce non deve sparire: viene mostrato com'è, e il collaudo
     lo segnala perché venga tradotto. */
  return { breve: String(id || ""), cosa: "", azione: "", livello: "info", tradotto: false };
}
function statiNonTradotti(elenco){
  return (elenco || []).filter(function(id){ return !STATI[id]; });
}

/* Il testo che compare nella riga di stato: breve, ma non ambiguo. */
function testoStato(id){
  var s = statoLeggibile(id);
  return s.breve;
}
/* Il testo esteso, per la scheda della sincronizzazione. */
function dettaglioStato(id){
  var s = statoLeggibile(id);
  return [s.cosa, s.azione].filter(Boolean).join(" ");
}
