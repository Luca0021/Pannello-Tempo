/* sharing.js — modello dati e adattatore della condivisione.
   La funzione richiede un backend multiutente che non esiste: qui c'è solo la
   struttura, spenta da un interruttore. Non viene simulata alcuna condivisione
   reale, e nulla viene condiviso automaticamente. */

/* Uno spazio condiviso: chi partecipa, cosa è stato messo dentro, chi può fare cosa. */
function nuovoSpazio(nome){
  return {
    id: uid(), nome: nome || "Spazio condiviso",
    creatoIl: new Date().toISOString(),
    membri: [],            /* { id, nome, ruolo: "proprietario"|"scrive"|"legge" } */
    elementi: [],          /* { tipo:"task"|"routine", id, condivisoIl } */
    registro: []           /* audit: { quando, chi, azione, elemento } */
  };
}
var RUOLI = ["proprietario", "scrive", "legge"];

var Condivisione = {
  attiva: function(){ return FLAG.condivisione; },
  /* Regole non negoziabili, scritte qui perché valgano anche in futuro:
     le statistiche personali e l'area Lavoro non escono mai da sole. */
  puoiCondividere: function(elemento){
    if (!FLAG.condivisione) return { ok:false, motivo:"La condivisione non è disponibile in questa versione." };
    if (!elemento) return { ok:false, motivo:"Elemento inesistente." };
    if (elemento.area === "lavoro")
      return { ok:false, motivo:"Le voci di lavoro non vengono condivise senza una scelta esplicita per ciascuna." };
    return { ok:true };
  },
  statisticheCondivisibili: function(){ return false; },   /* mai senza consenso esplicito */
  crea: function(){ return { esito:"non-disponibile",
    motivo:"Serve un servizio account che questa installazione non ha." }; },
  revoca: function(){ return { esito:"non-disponibile",
    motivo:"Serve un servizio account che questa installazione non ha." }; }
};
