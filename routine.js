/* routine.js — ROU-002: distinguere una routine da un task che si ripete.

   Finora erano la stessa cosa: «meditare dieci minuti» e «controllare la posta
   del cliente» venivano trattate identicamente. Ma non lo sono, e la differenza
   che conta è **cosa succede quando salti un giorno**.

     TASK RICORRENTE  Va fatto. Se lo salti resta indietro, e finisce fra le cose
                      da riprogrammare. Saltare la fattura di marzo non la
                      cancella: la sposta.

     ROUTINE          È un'abitudine. Se la salti, il giorno è passato e non
                      torna. Non diventa un arretrato, non si accumula, non
                      genera un debito. Si misura sulla costanza, non sul
                      recupero.

   Questa è la ragione per cui la distinzione esiste. Un pannello che trasforma
   «meditare» in un arretrato dopo una settimana di ferie produce sensi di colpa
   e basta: settanta meditazioni da recuperare non le fa nessuno, e l'unica
   reazione possibile è cancellarle tutte.

   Il valore predefinito è «ricorrente», che è il comportamento di prima: i dati
   esistenti non cambiano senso da soli. */

var TIPI_RIPETIZIONE = [
  { id:"ricorrente", nome:"Task ricorrente",
    breve:"Va fatto: se lo salti resta indietro",
    lungo:"Torna fra le cose da riprogrammare finché non lo completi o decidi che non serve." },
  { id:"routine", nome:"Routine",
    breve:"È un'abitudine: se la salti, il giorno è passato",
    lungo:"Non diventa un arretrato e non si accumula. Conta la costanza nel tempo." }
];

function tipoRipetizione(i){
  if (!i || i.freq === "once") return null;
  return i.tipo === "routine" ? "routine" : "ricorrente";
}
function eRoutine(i){ return tipoRipetizione(i) === "routine"; }

/* Una routine saltata non è un arretrato: è un giorno passato.
   Tutto il resto sì, comprese le voci con una data sola — che sono il caso
   più ovvio di cosa rimasta indietro. La prima versione le escludeva insieme
   alle routine, e gli appuntamenti scaduti sparivano dalla sezione. */
function generaArretrato(i){
  return !!i && !eRoutine(i);
}

/* ---------- costanza ----------
   Non «quante volte l'hai fatta», ma **su quante possibili**. Contare i giorni
   consecutivi soltanto premia chi non si ferma mai e non dice niente a chi si
   ferma: la costanza reale è una percentuale su una finestra. */

function giorniDovuti(i, quanti){
  var out = [], d = new Date();
  for (var n = 0; n < quanti; n++) {
    var g = new Date(d.getTime() - n * 86400000);
    if (dueOn(g).some(function(x){ return x.id === i.id; })) out.push(dayKey(g));
  }
  return out;
}

function costanza(i, finestra){
  finestra = finestra || 28;
  if (!eRoutine(i)) return null;
  var dovuti = giorniDovuti(i, finestra);
  /* `giudizio` c'è anche qui: chi legge il risultato non deve scoprire che il
     campo manca solo in questo caso */
  if (!dovuti.length) return { dovuti:0, fatti:0, percentuale:null,
                               testo:"non ancora in programma",
                               giudizio:"troppo presto per dire qualcosa" };
  var fatti = dovuti.filter(function(g){ return fattoIl(i, g); }).length;
  var pc = Math.round(fatti * 100 / dovuti.length);
  return {
    dovuti: dovuti.length, fatti: fatti, percentuale: pc,
    testo: fatti + " volte su " + dovuti.length + (dovuti.length === 1 ? " giorno" : " giorni"),
    giudizio: giudizioCostanza(pc, dovuti.length)
  };
}

/* Il commento sulla costanza. Non deve rimproverare: una routine saltata non è
   un fallimento, e dirlo con un numero rosso non aiuta nessuno. */
function giudizioCostanza(pc, quanti){
  if (quanti < 5) return "troppo presto per dire qualcosa";
  if (pc >= 80) return "sta diventando un'abitudine";
  if (pc >= 50) return "la fai spesso, non sempre";
  if (pc >= 20) return "capita, ma non è ancora un'abitudine";
  return "forse non era il momento giusto per questa";
}

/* Fatto in un dato giorno: legge il registro senza modificarlo. */
function fattoIl(i, giorno){
  if (!i || !giorno) return false;
  var d = S.data.doneAt && S.data.doneAt[i.id];
  if (d === giorno) return true;
  return (S.data.completamenti || []).some(function(c){
    return c && c.id === i.id && c.data === giorno;
  });
}

/* Quante routine e quanti task ricorrenti ci sono: serve a spiegare la
   differenza con i numeri dell'utente, non con un esempio inventato. */
function contaRipetizioni(){
  var r = 0, t = 0;
  (S.data.items || []).forEach(function(i){
    if (!i || i.freq === "once") return;
    if (eRoutine(i)) r++; else t++;
  });
  return { routine: r, ricorrenti: t };
}
