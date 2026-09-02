/* config.js — costanti, aree, frequenze, versioni dello schema
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* Pannello Tempo — nessuna dipendenza esterna.
   I moduli condividono lo scope globale: è la scelta che permette di aprire il
   pannello anche da file://. Nel file unico prodotto da build.py tutto viene
   racchiuso in una funzione, così la pagina ospite non vede questi nomi. */
"use strict";

var KEY = "pannello-tempo:v1";
/* Lo schema dei dati ha UNA sola definizione: SCHEMA_ATTUALE in migrations.js.
   Qui c'era un secondo numero scritto a mano, ed è rimasto indietro quando lo
   schema è passato a 4: un backup migrato veniva subito riportato alla
   versione precedente da normalizeData(). Ora è un alias, non una copia. */
var LINKS_V = 4;   /* aumentando questo numero i nuovi predefiniti raggiungono chi ha già dei dati */
var HPX = 38, HPW = 22;

var AREAS = { lavoro: { label: "Lavoro", color: "var(--pen)" },
              vita:   { label: "Vita",   color: "var(--sage)" } };
var FREQS = [
  { id: "daily",   every: "Ogni giorno" },
  { id: "once",    every: "Una volta sola" },
  { id: "weekly",  every: "Ogni settimana" },
  { id: "monthly", every: "Ogni mese" },
  { id: "yearly",  every: "Ogni anno" }
];
/* Le sezioni raggruppano per QUANDO, non per come si ripete il task. */
var SECTIONS = [
  { id: "today",   title: "Da fare oggi",           ico: "oggi" },
  { id: "once",    title: "Prossimi appuntamenti", ico: "prossimi" },
  { id: "waiting", title: "In attesa di qualcuno",             ico: "attesa" }
];
/* Settimanali, mensili e annuali stanno insieme: sono tutte «cose che tornano».
   Tenerle in tre schede separate funziona con poche voci, non con trenta. */
var ROUTINE = [
  { id: "weekly",  title: "Ogni settimana" },
  { id: "monthly", title: "Ogni mese" },
  { id: "yearly",  title: "Ogni anno" }
];
function routineHtml(){
  if (!moduloAttivo("routine")) return "";
  var corpi = ROUTINE.map(function(r){ return sectionHtml(r.id, r.title, "ripeti", true); });
  if (!corpi.some(function(c){ return c; })) return "";
  var tot = 0, fatti = 0, oggi = 0;
  ROUTINE.forEach(function(r){
    var l = S.data.items.filter(function(i){ return i.freq === r.id && visible(i) && !i.waiting; });
    tot += l.length;
    fatti += l.filter(isOn).length;
    oggi += l.filter(function(i){ return !isOn(i) && onDay(i, S.now); }).length;
  });
  var fold = folded("routine");
  return '<div class="card" data-sez="routine"><h2 data-ico="ripeti" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="routine" '+
    'aria-expanded="'+(!fold)+'"><span>Routine</span>'+
    (oggi && fold ? '<span class="segnale ottone" title="'+oggi+
      (oggi===1?" voce cade oggi":" voci cadono oggi")+'"></span>' : '')+
    '<span class="cnt">'+fatti+'/'+tot+'</span>'+
    '<span class="caret">'+(fold ? '▸' : '▾')+'</span></button></h2>'+
    (fold
      ? (function(){
          /* chiusa, la scheda mostrava uno spazio vuoto: ora elenca le voci,
             scorrevoli, così chiuderla non significa perderle di vista */
          var voci = S.data.items.filter(function(i){
            return i.freq !== "once" && visible(i) && !i.waiting && !isOn(i);
          });
          if (!voci.length) return "";
          return '<div class="antewrap"><ul class="anteprima-chiusa">'+voci.map(function(i){
            return '<li class=\"antevoce\"><span class="pallino area-'+esc(i.area)+'" aria-hidden="true"></span>'+
                   '<span>'+esc(i.label)+'</span></li>';
          }).join("")+'</ul></div>';
        })()
      : '<p class="hint" style="margin-top:0">Le cose che tornano: qui le gestisci, '+
        'nelle liste di oggi compaiono solo quando tocca a loro.</p>'+corpi.join(""))+
    '</div>';
}
var DURS = [[0.25,"15 min"],[0.5,"30 min"],[0.75,"45 min"],[1,"1 ora"],[1.5,"1h 30"],
            [2,"2 ore"],[3,"3 ore"],[4,"4 ore"],[6,"6 ore"],[8,"8 ore"]];
var SLOTS = []; for (var q = 0; q < 96; q++) SLOTS.push(q * 0.25);
var DOW = ["D","L","M","M","G","V","S"];
var DOWS = ["dom","lun","mar","mer","gio","ven","sab"];
var MONTHS = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio",
              "agosto","settembre","ottobre","novembre","dicembre"];
var DAYNAMES = [[1,"Lunedì"],[2,"Martedì"],[3,"Mercoledì"],[4,"Giovedì"],
                [5,"Venerdì"],[6,"Sabato"],[0,"Domenica"]];
var ICSDAY = ["SU","MO","TU","WE","TH","FR","SA"];
var DOMS = [[0,"Ultimo giorno"]]; for (var dm = 1; dm <= 28; dm++) DOMS.push([dm, "Il "+dm]);
/* Nei mensili ci si ferma a 28 per non saltare febbraio; negli annuali il mese
   è fisso, quindi ha senso arrivare a 31. */
var DOMS_Y = [[0,"Ultimo giorno"]]; for (var dy = 1; dy <= 31; dy++) DOMS_Y.push([dy, "Il "+dy]);

