/* lavoro.js — PER-001: operazioni lunghe senza bloccare l'interfaccia.

   Misure fatte in questo ambiente (Node v22, dataset di prova):

     normalizeData, 400 attività ................  15 ms
     disegno completo, 400 attività .............. 248 ms a freddo, 43 a caldo
     esportazione JSON, 400 attività .............   4 ms
     esportazione CSV, 400 attività ..............  11 ms
     lettura backup, 400 voci ....................  10 ms
     lettura backup, 4000 voci (256 KB) ..........  42 ms
     lettura ICS, 500 eventi .....................  24 ms

   Conseguenza onesta: sotto queste dimensioni **spezzettare non serve**, e
   farlo aggiungerebbe complessità senza guadagno. Le soglie qui sotto nascono
   da quei numeri, non da un'intuizione. Sopra le soglie il lavoro viene diviso
   in pezzi, con avanzamento e possibilità di annullare.

   Perché non un Web Worker: il pannello deve funzionare anche da `file://`,
   dove i browser rifiutano di creare worker. Il taglio cooperativo con
   setTimeout funziona ovunque e non richiede di duplicare il codice. */

var SOGLIE = {
  vociBackup: 800,      /* oltre, la lettura supera i ~10 ms percepibili */
  eventiIcs:  200,
  righeCsv:   1500
};
/* Come si cede il controllo fra un pezzo e l'altro. È sostituibile perché il
   banco di prova neutralizza setTimeout: senza questo aggancio il runner
   sembrava funzionare e non girava affatto. */
var pianificaGiro = function(f){
  if (typeof setTimeout === "function") setTimeout(f, 0);
  else f();
};

var PEZZO = 200;        /* elementi per giro: tenuto basso perché ogni giro
                           lascia respirare l'interfaccia */

function lavoroVuoto(){
  return { attivo:false, titolo:"", fatti:0, totali:0, misurabile:false,
           annullabile:false, annullato:false, esito:null };
}

function iniziaLavoro(titolo, totali, annullabile){
  S.lavoro = { attivo:true, titolo:titolo, fatti:0,
               totali: totali || 0, misurabile: !!totali,
               annullabile: !!annullabile, annullato:false, esito:null };
  render();
}
function avanzaLavoro(n){
  if (!S.lavoro || !S.lavoro.attivo) return;
  S.lavoro.fatti = n;
  render();
}
function finisciLavoro(esito){
  if (!S.lavoro) return;
  S.lavoro.attivo = false;
  S.lavoro.esito = esito || null;
  render();
}
function annullaLavoro(){
  if (S.lavoro && S.lavoro.attivo && S.lavoro.annullabile) S.lavoro.annullato = true;
}

/* Esegue `passo` su ogni elemento, a pezzi, restituendo una promessa.
   Se l'elenco è sotto la soglia, gira tutto d'un fiato: nessuna promessa di
   asincronia che non serve. */
function eseguiAPezzi(elenco, passo, opzioni){
  opzioni = opzioni || {};
  var soglia = opzioni.soglia === undefined ? PEZZO : opzioni.soglia;
  var risultati = [];
  if (!elenco || elenco.length <= soglia) {
    for (var i = 0; i < elenco.length; i++) risultati.push(passo(elenco[i], i));
    return Promise.resolve({ risultati: risultati, annullato: false });
  }
  iniziaLavoro(opzioni.titolo || "Operazione in corso", elenco.length, opzioni.annullabile !== false);
  return new Promise(function(risolvi){
    var i = 0;
    function giro(){
      if (S.lavoro && S.lavoro.annullato) {
        finisciLavoro({ annullato:true });
        risolvi({ risultati: risultati, annullato: true });
        return;
      }
      var fine = Math.min(i + PEZZO, elenco.length);
      for (; i < fine; i++) risultati.push(passo(elenco[i], i));
      avanzaLavoro(i);
      if (i < elenco.length) pianificaGiro(giro);   /* lascia respirare la pagina */
      else { finisciLavoro({ fatti: i }); risolvi({ risultati: risultati, annullato: false }); }
    }
    pianificaGiro(giro);
  });
}

/* Operazione non misurabile: si dichiara che è in corso, senza inventare una
   percentuale che non esiste. */
function conAttesa(titolo, funzione){
  iniziaLavoro(titolo, 0, false);
  return new Promise(function(risolvi, rifiuta){
    pianificaGiro(function(){
      try { var r = funzione(); finisciLavoro({ ok:true }); risolvi(r); }
      catch (e) {
        /* l'errore non deve lasciare l'interfaccia bloccata né perdere dati */
        finisciLavoro({ ok:false, errore: String(e && e.message || e) });
        rifiuta(e);
      }
    }, 0);
  });
}

function percentualeLavoro(){
  if (!S.lavoro || !S.lavoro.misurabile || !S.lavoro.totali) return null;
  return Math.min(100, Math.round(S.lavoro.fatti * 100 / S.lavoro.totali));
}
