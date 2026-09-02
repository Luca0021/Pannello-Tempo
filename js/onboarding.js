/* onboarding.js — quattro schermate per capire il pannello in meno di tre minuti.
   Nessun campo obbligatorio, si può saltare, si può riprendere, e i dati di
   esempio si riconoscono e si tolgono con un gesto solo. */

/* ONB-001 — sei passi, nell'ordine richiesto:
   1 promessa · 2 modalità · 3 fascia attiva · 4 prima priorità · 5 primo task · 6 home.
   Nessuna funzione avanzata viene presentata qui: routine, revisione, analisi,
   modelli e sincronizzazione si incontrano quando servono. */
var PASSI_ONB = 5;   /* il sesto è la home stessa */

function onboardingDaMostrare(){
  return !pref("onboardingFatto") && !S.onboarding;
}
/* Invito all'installazione: discreto, mai al primo secondo, mai se è già
   installato o se il browser non lo consente. */
function invitoInstallazione(){
  if (Platform.capacita.standalone) return null;          /* già installato */
  if (pref("installaNascosto")) return null;
  if (Platform.installa.possibile())
    return { automatico:true, testo:"Installalo: resta sulla schermata come un'app e funziona senza rete." };
  var suRete = (typeof location !== "undefined") && String(location.protocol||"").indexOf("http") === 0;
  if (Platform.capacita.serviceWorker && suRete)
    return { automatico:false, testo:Platform.installa.istruzioni() };
  return null;
}
function apriOnboarding(passo){
  S.onboarding = {
    passo: passo || (pref("onboardingPasso") || 1),
    priorita: ["", "", ""],
    aree: ["lavoro", "lavoro", "lavoro"],
    profilo: pref("profilo") || "pianificatore",
    fascia: { da: fasciaDi().da, a: fasciaDi().a },
    areaPrima: "lavoro",
    primoTask: "",
    areaTask: "lavoro"
  };
  /* riprende da dove eri: le priorità già scritte tornano nei campi */
  var L = top3();
  L.forEach(function(e, n){ if (e && e.t) S.onboarding.priorita[n] = e.t; });
  render();
}
function passoOnboarding(n){
  if (!S.onboarding) return;
  S.onboarding.passo = Math.max(1, Math.min(PASSI_ONB, n));
  setImp("onboardingPasso", S.onboarding.passo);
  render();
}
function saltaOnboarding(){
  setImp("onboardingFatto", true);
  setImp("onboardingPasso", 0);
  S.onboarding = null;
  toast("Puoi rivederlo quando vuoi dalle impostazioni", "info");
  commit();
}
/* Applica le scelte dei sei passi. Ogni passo è saltabile: ciò che non è stato
   scelto resta al predefinito, e nulla viene inventato. */
function applicaScelteOnboarding(){
  var o = S.onboarding;
  if (!o) return;
  if (o.profilo && PROFILI[o.profilo]) applicaProfilo(o.profilo);
  if (o.fascia && o.fascia.a > o.fascia.da) impostaFascia(o.fascia.da, o.fascia.a);
  salvaPrioritaOnboarding();
  var t = (o.primoTask || "").trim();
  if (t) {
    S.data.items.push({ id: uid(), label: testoSicuro(t, 200),
                        area: (o.areaTask === "vita") ? "vita" : "lavoro",
                        freq: "once", date: dk() });
    normalizeData();
  }
  commit();
}

function chiudiOnboarding(){
  salvaPrioritaOnboarding();
  setImp("onboardingFatto", true);
  setImp("onboardingPasso", 0);
  S.onboarding = null;
  commit();
}
/* Salvataggio continuo: quello che scrivi resta anche se ricarichi. */
function salvaPrioritaOnboarding(){
  if (!S.onboarding) return;
  var lista = S.onboarding.priorita.map(function(t, n){
    var testo = (t || "").trim();
    return testo ? { t: testo, id: null, done: false, area: S.onboarding.aree[n] }
                 : { t: "", id: null, done: false };
  });
  if (lista.some(function(e){ return e.t; })) {
    S.data.top3 = { key: dk(), list: lista };
    save();
  }
}

/* Dati di esempio riconoscibili e rimovibili in un gesto. */
function marchioDemo(){ return "demo-"; }
function caricaDemo(){
  var oggi = dk();
  var esempi = [
    { label:"Preparare la riunione con il cliente", area:"lavoro", freq:"once", date:oggi, start:10, dur:1 },
    { label:"Rispondere alle email arretrate",      area:"lavoro", freq:"daily", start:9, dur:0.5 },
    { label:"Camminata di mezz'ora",                area:"vita",   freq:"daily" },
    { label:"Spesa",                                area:"vita",   freq:"weekly", flessibile:true,
      steps:[{t:"pane"},{t:"latte"}] },
    { label:"Bolletta della luce",                  area:"vita",   freq:"monthly", dom:5 }
  ];
  esempi.forEach(function(e, n){
    S.data.items.push(Object.assign({ id: marchioDemo() + n }, e));
  });
  S.data.capture.push({ id: marchioDemo()+"n1", area:"vita",
                        text:"Chiedere a Marco il numero del gommista", done:false, at:Date.now() });
  normalizeData();
  commit();
}
function ciSonoDemo(){
  return S.data.items.some(function(i){ return String(i.id).indexOf(marchioDemo()) === 0; }) ||
         (S.data.capture||[]).some(function(c){ return String(c.id).indexOf(marchioDemo()) === 0; });
}
function togliDemo(){
  snapshot("I dati di esempio sono stati rimossi.", "Vuoi annullare la rimozione?");
  var demo = function(id){ return String(id).indexOf(marchioDemo()) === 0; };
  S.data.items = S.data.items.filter(function(i){ return !demo(i.id); });
  S.data.capture = (S.data.capture||[]).filter(function(c){ return !demo(c.id); });
  ["checks","doneAt","skips","log","rinvii"].forEach(function(m2){
    Object.keys(S.data[m2] || {}).forEach(function(k){ if (demo(k)) delete S.data[m2][k]; });
  });
  if (S.data.top3 && S.data.top3.list)
    S.data.top3.list = S.data.top3.list.map(function(e){
      return (e && demo(e.id)) ? { t:"", id:null, done:false } : e;
    });
  normalizeData();
  toast("Dati di esempio rimossi", "ok");
  commit();
}

/* Secondo giorno: un solo suggerimento, sulle routine, e poi mai più. */
function suggerimentoSecondoGiorno(){
  if (pref("suggerimentoRoutineMostrato")) return null;
  if (!pref("onboardingFatto")) return null;
  var haRoutine = S.data.items.some(function(i){ return i.freq !== "once"; });
  if (haRoutine) return null;
  var primaChiusura = (S.data.chiusure || [])[0];
  var giorniUso = (S.data.chiusure || []).length;
  if (giorniUso < 1 && !primaChiusura) return null;
  return "Hai qualcosa che si ripete ogni settimana? Mettilo in Routine e non ci pensi più.";
}
