/* riprogrammare-ui.js — Le righe di «Da riprogrammare» e il menù di ripianificazione.
   Estratto da components.js (ARC-001): questo modulo contiene solo il
   disegno di questa area. Dipende da: utils.js (esc, fmt, dur2s),
   state.js (S, P), config.js (AREAS, SECTIONS), tasks.js (itemById,
   isOn, isSkipped). Non conosce le altre aree. */

/* ---------------------------------------------------------------------------
   REC-002 / TSK-001 — riga di «Da riprogrammare».
   Le tre liste (appuntamenti scaduti, blocchi in ritardo, voci senza orario)
   usavano azioni diverse e abbreviate. Ora tutte e tre passano di qui e
   offrono le stesse cinque decisioni, con le stesse parole.
   Interazione uniforme come nel resto del pannello: la casella completa,
   il titolo apre i dettagli. Prima qui il titolo completava, ed era l'unico
   posto in cui lo faceva.
--------------------------------------------------------------------------- */
function rigaRitardo(i, motivo, conScelta){
  var apri = S.ripianifica === i.id;
  var scelta = conScelta
    ? '<button class="scegli" type="button" data-act="arr-scegli" data-id="'+esc(i.id)+'" '+
      'aria-pressed="'+selezionato(i.id)+'" data-on="'+(selezionato(i.id)?1:0)+'" '+
      'aria-label="Scegli '+esc(i.label)+' per un\'azione di gruppo"></button>'
    : '';
  return '<li data-id="'+esc(i.id)+'" data-area="'+esc(i.area)+'">'+ scelta +
    '<button class="box" data-act="toggle" data-id="'+i.id+'" role="checkbox" '+
      'aria-checked="false" aria-label="Completa '+esc(i.label)+'"></button>'+
    '<span class="txt" role="button" tabindex="0" data-act="open" data-id="'+i.id+'" '+
      'data-ctx="ritardo">'+esc(i.label)+
      '<span class="sub">'+esc(motivo)+'</span></span>'+
    '<span class="acts">'+
      '<button class="tiny" data-act="ripianifica" data-id="'+i.id+'" '+
        'aria-expanded="'+apri+'">Ripianifica</button>'+
      '<button class="tiny" data-act="wait" data-id="'+i.id+'">Metti in attesa</button>'+
      /* per una routine saltare l'occorrenza di oggi non è archiviare la serie:
         sono due decisioni diverse e devono restare due pulsanti diversi */
      (i.freq !== "once"
        ? '<button class="tiny" data-act="skip" data-id="'+i.id+'">Salta oggi</button>' : '')+
      '<button class="tiny" data-act="nonserve" data-id="'+i.id+'">Non serve più</button>'+
      '<button class="tiny" data-act="open" data-id="'+i.id+'" data-ctx="ritardo">Dettagli</button>'+
    '</span>'+
    (apri ? menuRipianifica(i) : '')+
    '</li>';
}

/* Le quattro destinazioni richieste, con la data e l'ora scelte dall'utente. */
function menuRipianifica(i){
  return '<div class="ripian" role="group" aria-label="Ripianifica '+esc(i.label)+'">'+
    '<button class="tiny pos" data-act="rip-oggi" data-id="'+i.id+'">Oggi</button>'+
    '<button class="tiny pos" data-act="rip-domani" data-id="'+i.id+'">Domani</button>'+
    '<label class="lbl" for="ripd-'+i.id+'">Data</label>'+
    '<input type="date" id="ripd-'+i.id+'" data-keep="ripd-'+i.id+'" min="'+dk()+'">'+
    '<label class="lbl" for="ripo-'+i.id+'">Ora</label>'+
    '<input type="time" id="ripo-'+i.id+'" data-keep="ripo-'+i.id+'" step="900">'+
    '<button class="tiny" data-act="rip-data" data-id="'+i.id+'">Sposta</button>'+
    '<button class="tiny" data-act="rip-chiudi">annulla</button>'+
    '<p class="hint" style="margin:6px 0 0;flex-basis:100%">L\'ora è facoltativa: senza, '+
    'la voce resta nel giorno scelto senza occupare un blocco.</p></div>';
}


/* ---------------------------------------------------------------------------
   REC-003 — quando gli arretrati sono tanti, decidere una volta su molte voci.
--------------------------------------------------------------------------- */

/* La barra che compare quando hai scelto qualcosa. */
/* L'elenco raggruppato per età. Sotto la soglia resta l'elenco semplice. */
function elencoArretrati(voci, motivoDi){
  var h = "";
  var r = riassuntoArretrati(voci);
  var tanti = voci.length > SOGLIA_ELENCO;

  if (tanti) {
    h += '<p class="hint riassunto">Sono <b>'+voci.length+'</b>: '+esc(r.testo)+'. '+
         'Puoi sceglierne più di una e decidere in un colpo solo.</p>';
    h += '<div class="row"><button class="tiny" data-act="mass-tutte">Scegli tutte</button>'+
         '<button class="tiny" data-act="mass-vecchie">Scegli solo quelle oltre un mese</button>'+
         '</div>';
  }
  h += barraMassiva();

  r.gruppi.ordine.forEach(function(f){
    var gruppo = r.gruppi.gruppi[f];
    if (!gruppo.length) return;
    if (tanti) {
      h += '<p class="grp fascia">'+esc(NOMI_FASCIA[f].nome)+
           ' <span class="cnt">'+gruppo.length+'</span>'+
           '<span class="sub">'+esc(NOMI_FASCIA[f].nota)+'</span>'+
           '<button class="tiny" data-act="mass-fascia" data-v="'+f+'">Scegli queste</button></p>';
    }
    var visibili = (tanti && !S.mostraTuttiArretrati) ? gruppo.slice(0, 5) : gruppo;
    h += '<ul>';
    visibili.forEach(function(i){ h += rigaRitardo(i, motivoDi(i), tanti); });
    h += '</ul>';
    if (visibili.length < gruppo.length)
      h += '<p class="hint">e altre '+(gruppo.length - visibili.length)+' in questa fascia.</p>';
  });

  if (tanti && !S.mostraTuttiArretrati)
    h += '<div class="row"><button class="tiny" data-act="arr-tutti">Mostra tutte</button></div>';
  return h;
}
