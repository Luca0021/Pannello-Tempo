/* promessa.js — PRD-001: la promessa centrale del prodotto, in un punto solo.

   «Pannello Tempo aiuta a scegliere ciò che conta, organizzare una giornata
    sostenibile e mantenere in equilibrio lavoro e vita.»

   Tenerla qui serve a due cose. La prima: cambiarla una volta la cambia
   ovunque, invece di lasciarne sei versioni che divergono. La seconda, più
   importante: rende evidente **dove** compare, e quindi permette di verificare
   che non compaia dappertutto.

   La promessa va detta a chi non conosce ancora il prodotto — la landing, la
   prima schermata dell'ingresso, la scheda che descrive l'app — e NON va
   ripetuta a chi lo sta già usando. Uno slogan su ogni schermata è rumore, e
   il rumore è esattamente ciò che questo pannello dovrebbe togliere. */

var PROMESSA = "Pannello Tempo aiuta a scegliere ciò che conta, organizzare una "+
               "giornata sostenibile e mantenere in equilibrio lavoro e vita.";

/* I tre verbi, usati dove serve dire la stessa cosa più corta. */
var PROMESSA_PARTI = [
  { verbo: "Scegliere ciò che conta",
    come:  "Fino a tre priorità al giorno, non una lista infinita." },
  { verbo: "Organizzare una giornata sostenibile",
    come:  "Blocchi orari dentro la tua fascia attiva, e il carico dichiarato prima di viverla." },
  { verbo: "Tenere in equilibrio lavoro e vita",
    come:  "Ogni cosa appartiene a un'area, e a fine settimana sai dove sono andate le ore." }
];

/* I luoghi in cui la promessa è ammessa. Un elenco esplicito è ciò che rende
   verificabile la regola «coerente ma non invasiva». */
var LUOGHI_PROMESSA = ["landing", "onboarding-1", "informazioni", "modalita", "piani"];

function promessaBreve(){
  return "Scegliere ciò che conta, una giornata sostenibile, lavoro e vita in equilibrio.";
}
