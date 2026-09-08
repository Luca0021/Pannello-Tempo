/* scoperta.js — «Scopri funzionalità»: una modalità, spenta di suo.
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server.

   ───────────────────────────────────────────────────────────────────────────
   DUE REGOLE CHE DECIDONO SE QUESTA COSA È UTILE O È RUMORE
   ───────────────────────────────────────────────────────────────────────────

   1. **Spenta, non aggiunge NIENTE.** Nessun badge, nessuna scheda, nessun
      attributo in più nel DOM. Non «un badge più discreto»: niente. Chi non
      la accende non deve poter accorgersi che esiste.

   2. **«Non ancora usata» si deduce dai dati, non da un contatore nuovo.**
      Il pannello non tiene un registro di quali funzioni hai toccato, e
      questo modulo non lo introduce: guarda i dati che ci sono già. Hai una
      voce con un'etichetta? Allora le etichette le hai usate. Hai chiuso una
      giornata? Il rituale l'hai visto.

      Il prezzo è dichiarato: **ciò che non lascia traccia nei dati non è
      osservabile.** La ricerca, i filtri, l'esportazione di un backup non
      compaiono in questo elenco, e non compaiono per una ragione — non per
      dimenticanza. Inventare un contatore «funzione X aperta» significa
      scrivere nei dati dell'utente per far funzionare un suggerimento, ed è
      un prezzo che questa funzione non vale. */

/* Ogni voce: che cos'è, dove sta, come si vede DAI DATI se è stata usata, e
   che cosa ha senso guardare dopo. `sez` è l'ancora `data-sez` della scheda
   che la ospita, così il badge sa dove comparire.

   `modulo` è la parte del pannello che la contiene, quando esiste: una
   funzione dentro una parte SPENTA non va proposta, perché l'utente ha
   scelto di non vederla e il pannello gli suggerirebbe di usare qualcosa
   che non trova. Prima questa regola era scritta a mano per due id — e
   lasciava fuori le etichette e i modelli, che si possono spegnere
   esattamente come le altre. */
var FUNZIONI_SCOPRIBILI = [
  { id:"priorita-collegata", nome:"Collegare una priorità a un task", sez:"focus",
    dove:"Tocca ★ su una voce dell'elenco: diventa una delle tre priorità.",
    perche:"Completare l'una completa l'altra: non le spunti due volte.",
    usata: function(){
      var L = (typeof top3 === "function") ? top3() : [];
      return L.some(function(e){ return e && e.id; });
    },
    correlate:["etichette"] },

  { id:"etichette", nome:"Etichette", sez:"today", modulo:"etichette",
    dove:"Apri una voce, campo «Etichette».",
    perche:"Servono a filtrare un progetto che attraversa più giorni.",
    usata: function(){
      /* Una sola forma: `i.tag`, stringa singola. `etichette()` in utils.js
         legge esattamente quella. Qui c'era anche un ramo su `i.tags`, un
         campo che in questo schema non esiste: dava l'impressione di
         coprire un caso in più e non copriva niente. */
      return (S.data.items || []).some(function(i){ return i && i.tag && String(i.tag).trim(); });
    },
    correlate:["passi"] },

  { id:"passi", nome:"Passi dentro una voce", sez:"today",
    dove:"Apri una voce e aggiungi i passi, come una lista della spesa.",
    perche:"Una cosa in dieci pezzi non è dieci cose da fare.",
    usata: function(){
      return (S.data.items || []).some(function(i){ return i && Array.isArray(i.steps) && i.steps.length; });
    },
    correlate:["etichette"] },

  { id:"attesa", nome:"In attesa di qualcuno", sez:"today", modulo:"bloccati",
    dove:"Apri una voce e indica da chi dipende.",
    perche:"Ciò che dipende da altri non deve restare fra le tue cose da fare.",
    usata: function(){
      return (S.data.items || []).some(function(i){ return i && i.waiting; });
    },
    correlate:["riprogrammare"] },

  { id:"routine", nome:"Routine", sez:"routine", modulo:"routine",
    dove:"Nuovo → Routine, oppure cambia la ripetizione di una voce.",
    perche:"Ciò che torna ogni settimana non va riscritto ogni settimana.",
    usata: function(){
      return (S.data.items || []).some(function(i){ return i && i.freq && i.freq !== "once"; });
    },
    correlate:["serie"] },

  { id:"note", nome:"Posta in arrivo", sez:"note", modulo:"note",
    dove:"Nuovo → Nota. Poi la smisti quando hai tempo.",
    perche:"Un pensiero va messo da parte subito, deciso dopo.",
    usata: function(){ return (S.data.capture || []).length > 0; },
    correlate:["etichette"] },

  { id:"chiusura", nome:"Chiusura di giornata", sez:"rituale", modulo:"rituale",
    dove:"Compare dal pomeriggio, oppure dalle impostazioni.",
    perche:"È il momento in cui il pannello restituisce qualcosa invece di chiedere.",
    usata: function(){ return (S.data.chiusure || []).length > 0; },
    correlate:["revisione"] },

  { id:"revisione", nome:"Revisione della settimana", sez:"rituale", modulo:"rituale",
    dove:"Compare a fine settimana quando hai qualche giornata chiusa.",
    perche:"Una settimana si giudica sulle sette giornate, non sull'ultima.",
    usata: function(){ return (S.data.revisioni || []).length > 0; },
    correlate:["chiusura"] },

  { id:"modelli", nome:"Modelli", sez:"today", modulo:"modelli",
    dove:"Salva una voce come modello e riusala quando torna.",
    perche:"La stessa trasferta, la stessa preparazione: si ricompone in un tocco.",
    usata: function(){ return (S.data.modelli || []).length > 0; },
    correlate:["routine"] }
];

/* ─── l'interruttore ───────────────────────────────────────────────────── */

function scopertaAttiva(){ return P.scoperta === true; }
function accendiScoperta(){ P.scoperta = true; savePrefs(); }
function spegniScoperta(){ P.scoperta = false; savePrefs(); }

/* ─── che cosa non è ancora stato usato ────────────────────────────────── */

function funzioniDaScoprire(){
  return FUNZIONI_SCOPRIBILI.filter(function(f){
    var ok = false;
    try { ok = !!f.usata(); } catch (e) { ok = true; }   /* in dubbio: non insistere */
    if (ok) return false;
    if (scopertaNascosta(f.id)) return false;            /* «nascondi», su questo dispositivo */
    /* Una funzione dentro una parte spenta non va suggerita: il pannello
       proporrebbe di usare qualcosa che l'utente ha scelto di non vedere.
       Una regola sola, letta da `modulo`. Prima erano due `if` con gli id
       scritti a mano — routine e note — e lasciavano fuori etichette,
       modelli, «in attesa» e i due rituali, che si spengono allo stesso
       modo. Il difetto non era teorico: con le etichette spente il pannello
       proponeva di usare le etichette. */
    if (f.modulo && typeof moduloAttivo === "function" && !moduloAttivo(f.modulo)) return false;
    return true;
  });
}
function funzioneScopribile(id){
  for (var i = 0; i < FUNZIONI_SCOPRIBILI.length; i++)
    if (FUNZIONI_SCOPRIBILI[i].id === id) return FUNZIONI_SCOPRIBILI[i];
  return null;
}

/* Il badge accanto al titolo di una sezione che ospita qualcosa di non
   ancora usato. Spenta la modalità, restituisce stringa vuota: è QUI che si
   garantisce la regola 1, in un punto solo. */
function badgeScoperta(sez){
  if (!scopertaAttiva()) return "";
  var da = funzioniDaScoprire().filter(function(f){ return f.sez === sez; });
  if (!da.length) return "";
  var nomi = da.map(function(f){ return f.nome; }).join(", ");
  return '<span class="badge-nuovo" title="Da provare: '+esc(nomi)+'">Nuovo</span>';
}

/* La scheda della modalità. Tre voci per volta, con il «dove» e il
   «perché»: un elenco di nove funzioni sarebbe un menù, non una scoperta.
   E le correlate, che sono il motivo per cui questa modalità esiste: una
   funzione si capisce accanto a quella che le sta vicino. */
function scopertaHtml(){
  if (!scopertaAttiva()) return "";
  var da = funzioniDaScoprire();
  if (!da.length)
    return '<div class="card terziaria" data-sez="scoperta"><h2 data-ico="sereno">'+
      '<span>Scoperta</span></h2>'+
      '<p class="hint">Hai provato tutto quello che il pannello sa osservare dai tuoi dati. '+
      'Puoi spegnere la modalità dalle impostazioni.</p></div>';

  var tre = da.slice(0, 3);
  var h = '<div class="card terziaria" data-sez="scoperta"><h2 data-ico="sereno">'+
    '<span>Da provare</span><span class="cnt">'+da.length+'</span></h2>'+
    '<ul class="linklist scoperte">';
  tre.forEach(function(f){
    var corr = (f.correlate || []).map(funzioneScopribile).filter(Boolean)
      .filter(function(c){ return da.indexOf(c) >= 0; });
    h += '<li><span class="txt"><b>'+esc(f.nome)+'</b>'+
      '<span class="sub">'+esc(f.dove)+'</span>'+
      '<span class="sub">'+esc(f.perche)+'</span>'+
      (corr.length ? '<span class="sub correlata">Va con: '+
        esc(corr.map(function(c){ return c.nome; }).join(", "))+'</span>' : '')+
      '</span>'+
      '<span class="acts"><button class="tiny" data-act="scoperta-fatto" data-v="'+esc(f.id)+'" '+
      'title="Non propormela più">nascondi</button></span></li>';
  });
  h += '</ul><p class="hint">Le voci si spuntano da sole quando la funzione compare nei tuoi dati. '+
    'Ricerca, filtri ed esportazioni non sono in elenco: non lasciano traccia da osservare.</p>'+
    '<div class="row"><button class="link" data-act="scoperta-spegni">Spegni la modalità scoperta</button></div>'+
    '</div>';
  return h;
}

/* «Nascondi» non finge che la funzione sia stata usata: la mette fra le
   viste, che è un fatto diverso e sta fra le preferenze locali. */
function nascondiScoperta(id){
  if (!funzioneScopribile(id)) return;
  segnaVisto("scoperta:" + id);
}
function scopertaNascosta(id){ return giaVisto("scoperta:" + id); }
