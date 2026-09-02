/* navigazione.js — NAV-001: una sola definizione delle sezioni primarie.

   Prima esistevano due navigazioni diverse: sul telefono una barra con quattro
   voci, sul computer una fila di icone con comandi in parte diversi e in parte
   ripetuti — «Riepilogo» compariva in entrambe, «Oggi» e «Agenda» solo su
   telefono. Chi passava da un dispositivo all'altro doveva reimparare dove
   stanno le cose.

   Qui le sezioni sono definite una volta e disegnate uguali nei due posti:
   cambia la disposizione, non l'insieme né l'ordine.

   Distinzione che tiene in piedi la regola: una SEZIONE è un posto dove si va,
   uno STRUMENTO agisce su ciò che stai guardando. Filtri, ricerca e modifica
   dei collegamenti sono strumenti e restano fuori dalla navigazione primaria. */

var SEZIONI_PRIMARIE = [
  { id:"oggi",      azione:"vaioggi",    ico:"oggi",      nome:"Oggi",
    descrizione:"Le priorità e le attività di oggi" },
  { id:"agenda",    azione:"vaiagenda",  ico:"agenda",    nome:"Agenda",
    descrizione:"I blocchi orari della giornata" },
  { id:"nuovo",     azione:"menunuovo",  ico:"aggiungi",  nome:"Nuovo",
    descrizione:"Aggiungi un task, una nota o una routine" },
  { id:"riepilogo", azione:"digest",     ico:"riepilogo", nome:"Riepilogo",
    descrizione:"Come sta andando la giornata" }
];

var STRUMENTI = [
  { azione:"filtri",   ico:"imbuto", nome:"Filtri",       titolo:"Filtri e raggruppamento" },
  { azione:"search",   ico:"cerca",  nome:"Cerca",        titolo:"Cerca fra task, note e archivio" },
  { azione:"linkedit", ico:"matita", nome:"Collegamenti", titolo:"Modifica i collegamenti" }
];

/* Quale sezione è quella in cui ti trovi adesso. */
/* La sezione in cui ti trovi. Le prime tre condizioni sono schermate che
   coprono il pannello; sotto, la scelta esplicita dell'utente. Prima questa
   funzione deduceva la sezione dalla vista, che non cambiava mai premendo
   «Agenda»: la voce attiva restava su «Oggi» qualunque cosa si premesse. */
function sezioneCorrente(){
  if (S.digest) return "riepilogo";
  if (S.menuNuovo) return "nuovo";
  if (S.searchOpen) return null;          /* la ricerca è uno strumento, non una sezione */
  if (S.sezione === "agenda" || S.view === "settimana") return "agenda";
  return "oggi";
}

/* Un solo disegno per entrambe le posizioni: se ne esistessero due, prima o
   poi divergerebbero, che è com'erano nate. */
function navPrimaria(posizione){
  var corr = sezioneCorrente();
  return '<nav class="navprim '+esc(posizione)+'" aria-label="Sezioni principali">'+
    SEZIONI_PRIMARIE.map(function(s){
      var attiva = (s.id === corr);
      return '<button data-act="'+s.azione+'" data-ico="'+s.ico+'" '+
             'data-sezione="'+s.id+'" data-on="'+(attiva?1:0)+'" '+
             'aria-current="'+(attiva ? "page" : "false")+'" '+
             'title="'+esc(s.descrizione)+'">'+
             '<span>'+esc(s.nome)+'</span></button>';
    }).join("")+'</nav>';
}

function barraStrumenti(){
  return STRUMENTI.map(function(t){
    /* «acceso» non vuol dire «pannello aperto»: l'imbuto deve segnalare che un
       filtro è in vigore anche quando il pannello dei filtri è chiuso. */
    var attivo = (t.azione === "search"   && !!S.searchOpen) ||
                 (t.azione === "linkedit" && !!S.linkEdit) ||
                 (t.azione === "filtri"   && !!(S.filtri || S.tagF !== "tutti" ||
                                                (P.groupBy || "area") !== "area"));
    return '<button class="toolsedit" data-act="'+t.azione+'" data-ico="'+t.ico+'" '+
           'data-on="'+(attivo?1:0)+'" aria-pressed="'+attivo+'" '+
           'title="'+esc(t.titolo)+'" aria-label="'+esc(t.nome)+'"></button>';
  }).join("");
}
