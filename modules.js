/* modules.js — registro dei moduli.
   Il pannello è fatto di parti attivabili. Alcune non si spengono perché senza
   di loro non esiste un pannello; le altre si accendono quando servono davvero.
   Spegnere un modulo nasconde l'interfaccia: NON cancella i dati. */

var MODULI = [
  /* --- fondamentali: non si disattivano --- */
  { id:"oggi",     nome:"Oggi",           core:true,
    cosa:"Le priorità, le attività di oggi, ciò che è rimasto indietro." },
  { id:"agenda",   nome:"Agenda",         core:true,
    cosa:"I blocchi orari e il carico della giornata." },
  { id:"rituale",  nome:"Chiusura e revisione", core:true,
    cosa:"Il momento della sera e il quadro della settimana." },

  /* --- opzionali: si accendono quando servono --- */
  { id:"routine",  nome:"Routine",        core:false, predefinito:true,
    cosa:"Le cose che tornano ogni settimana, mese o anno." },
  { id:"note",     nome:"Posta in arrivo",   core:false, predefinito:true,
    cosa:"Scrivi ora, decidi dopo." },
  { id:"bloccati", nome:"In attesa di qualcuno", core:false, predefinito:true,
    cosa:"Ciò che dipende da una risposta e esce dalla giornata." },
  { id:"etichette",nome:"Etichette",      core:false, predefinito:"avanzato",
    cosa:"Raggruppare per progetto o contesto, oltre a lavoro e vita." },
  { id:"energia",  nome:"Energia e attenzione", core:false, predefinito:false,
    cosa:"Quanta testa richiede una cosa, per abbinarla al momento giusto.",
    dipende:["agenda"] },
  { id:"obiettivi",nome:"Obiettivi",      core:false, predefinito:false,
    cosa:"Collegare le attività a qualcosa di più grande." },
  { id:"modelli",  nome:"Modelli di giornata", core:false, predefinito:"avanzato",
    cosa:"Salvare la forma di una giornata tipo e riapplicarla." },
  { id:"importi",  nome:"Importi",        core:false, predefinito:"avanzato",
    cosa:"Quanto costa una voce e la previsione del mese." },
  { id:"sync",     nome:"Sincronizzazione", core:false, predefinito:"avanzato",
    cosa:"Gli stessi dati su più dispositivi, sul tuo servizio." },
  { id:"calendario",nome:"Calendario",    core:false, predefinito:"avanzato",
    cosa:"Esportare i blocchi e importare eventi da un file .ics." },
  { id:"coach",    nome:"Analisi personali",   core:false, predefinito:true,
    cosa:"Quello che i tuoi dati dicono di te, quando dicono qualcosa.",
    dipende:["rituale"] }
];

function modulo(id){
  return MODULI.filter(function(m2){ return m2.id === id; })[0] || null;
}
/* Il predefinito di un modulo dipende dal profilo scelto all'ingresso; una
   scelta esplicita dell'utente vince sempre sul profilo. */
function moduloAttivo(id){
  var m2 = modulo(id);
  if (!m2) return true;                 /* id sconosciuto: non nascondo nulla */
  if (m2.core) return true;
  var scelte = (pref("moduli") || {});
  if (scelte[id] !== undefined) return !!scelte[id];
  var prof = PROFILI[pref("profilo")] ;
  if (prof && prof.moduli.indexOf(id) >= 0) return true;
  if (prof) return false;
  /* «avanzato» significa: acceso quando l'utente ha chiesto di vedere tutto.
     È il comportamento che il pannello aveva prima dei moduli. */
  if (m2.predefinito === "avanzato") return modoAvanzato();
  return !!m2.predefinito;
}
function dipendenzeMancanti(id){
  var m2 = modulo(id);
  if (!m2 || !m2.dipende) return [];
  return m2.dipende.filter(function(d){ return !moduloAttivo(d); });
}
function attivaModulo(id, acceso){
  var m2 = modulo(id);
  if (!m2 || m2.core) return false;
  var scelte = Object.assign({}, pref("moduli") || {});
  if (acceso) {
    /* accendendo un modulo accendo anche ciò da cui dipende */
    (m2.dipende || []).forEach(function(d){ if (!moduloAttivo(d)) scelte[d] = true; });
    scelte[id] = true;
  } else {
    scelte[id] = false;
    /* spegnendone uno, spengo ciò che senza di lui non funzionerebbe */
    MODULI.forEach(function(x){
      if (!x.core && (x.dipende || []).indexOf(id) >= 0) scelte[x.id] = false;
    });
  }
  setImp("moduli", scelte);
  return true;
}
function moduliAttivi(){
  return MODULI.filter(function(m2){ return moduloAttivo(m2.id); }).map(function(m2){ return m2.id; });
}

/* Profili: tre, non cinque. Ogni profilo in più è una configurazione in più da
   disegnare, provare e mantenere, e nessuno di questi tre è ancora stato
   validato con persone vere. */
var PROFILI = {
  essenziale: {
    nome:"Essenziale",
    per:"Voglio sapere cosa fare oggi, niente di più.",
    moduli:["note"]
  },
  pianificatore: {
    nome:"Pianificatore",
    per:"Organizzo la settimana e ho cose che si ripetono.",
    moduli:["routine","note","bloccati","modelli","coach"]
  },
  completo: {
    nome:"Completo",
    per:"Voglio tutto: etichette, obiettivi, energia, sincronizzazione.",
    moduli:["routine","note","bloccati","etichette","energia","obiettivi",
            "modelli","importi","sync","calendario","coach"]
  }
};
function applicaProfilo(id){
  if (!PROFILI[id]) return false;
  setImp("profilo", id);
  setImp("moduli", {});          /* il profilo torna a decidere */
  /* la modalità avanzata resta un modo rapido di dire «accendi tutto» */
  setImp("modo", id === "completo" ? "avanzata" : "semplice");
  return true;
}

/* ---------------------------------------------------------------------------
   SET-002 — distinguere modalità, profili e moduli.

   I tre concetti si sovrapponevano e nessuno spiegava la differenza:

     PROFILO   il punto di partenza. Accende un insieme di moduli in un colpo
               solo. Serve a non dover scegliere quattordici interruttori al
               primo avvio.
     MODULI    il controllo fine. Ogni parte del pannello si accende e si spegne
               da sola, e la scelta esplicita vince sul profilo.
     MODALITÀ  quanto dettaglio mostrare DENTRO i moduli attivi. Non decide
               quali parti esistono, decide quanto ne vedi.

   La regola che li tiene distinti: il profilo tocca i moduli, la modalità no.
--------------------------------------------------------------------------- */

/* Che cosa cambierebbe applicando un profilo: si vede prima, non dopo. */
function anteprimaProfilo(id){
  var p = PROFILI[id];
  if (!p) return null;
  var attivi = {};
  moduliAttivi().forEach(function(x){ attivi[x] = true; });
  var accesi = [], spenti = [], invariati = [];
  MODULI.forEach(function(mo){
    if (mo.core) return;
    var dopo = p.moduli.indexOf(mo.id) >= 0;
    var prima = !!attivi[mo.id];
    if (dopo && !prima) accesi.push(mo);
    else if (!dopo && prima) spenti.push(mo);
    else invariati.push(mo);
  });
  return {
    profilo: p, id: id,
    accesi: accesi, spenti: spenti, invariati: invariati,
    /* le scelte esplicite che verrebbero dimenticate */
    scelteAzzerate: Object.keys(pref("moduli") || {}).length,
    attualeUguale: (pref("profilo") === id) && !Object.keys(pref("moduli") || {}).length
  };
}

/* Che cosa comporta spegnere un modulo, in numeri veri. */
function conseguenzeSpegnimento(id){
  var mo = modulo(id);
  if (!mo || mo.core) return null;
  var dipendenti = MODULI.filter(function(x){
    return !x.core && (x.dipende || []).indexOf(id) >= 0 && moduloAttivo(x.id);
  });
  var voci = 0;
  if (id === "routine")
    voci = (S.data.items || []).filter(function(i){ return i && i.freq && i.freq !== "once"; }).length;
  else if (id === "note") voci = (S.data.capture || []).length;
  else if (id === "bloccati")
    voci = (S.data.items || []).filter(function(i){ return i && i.waiting; }).length;
  else if (id === "modelli") voci = (S.data.modelli || []).length;
  else if (id === "etichette")
    voci = (typeof etichette === "function") ? etichette().length : 0;
  return {
    modulo: mo, dipendenti: dipendenti, voci: voci,
    /* la frase che l'utente legge prima di decidere */
    testo: "Nasconde " + (voci ? voci + (voci === 1 ? " voce" : " voci") : "la sezione") +
           (dipendenti.length
             ? " e spegne anche: " + dipendenti.map(function(x){ return x.nome; }).join(", ")
             : "") +
           ". I dati restano dove sono e tornano riaccendendo la parte."
  };
}

/* Torna al preset del profilo, dimenticando le scelte fatte a mano. */
function ripristinaPreset(){
  var id = pref("profilo");
  if (!id || !PROFILI[id]) return { ok:false, motivo:"Nessun profilo scelto." };
  var quante = Object.keys(pref("moduli") || {}).length;
  setImp("moduli", {});
  return { ok:true, azzerate: quante,
           motivo: quante ? quante + (quante === 1 ? " scelta dimenticata" : " scelte dimenticate")
                          : "Non c'era nulla da ripristinare." };
}
function sceltePersonali(){ return Object.keys(pref("moduli") || {}).length; }
