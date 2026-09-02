/* migrations.js — versione esplicita dello schema e migrazioni incrementali.
   Regole rispettate: backup prima di migrare, passi idempotenti, nessuna
   cancellazione silenziosa, possibilità di tornare indietro, registro tecnico
   esportabile. Le migrazioni girano su una copia: se una fallisce, i dati
   originali restano intatti. */

var SCHEMA_ATTUALE = 5;
var CHIAVE_BACKUP  = "pannello-tempo:pre-migrazione";
var REGISTRO_MIGR  = [];

function impostazioniPredefinite(){
  return {
    modo: "semplice",              /* semplice | avanzata */
    onboardingFatto: false,
    onboardingPasso: 0,
    chiusuraAttiva: true,
    chiusuraOra: "18:00",
    revisioneAttiva: true,
    revisioneGiorno: 0,            /* 0 = domenica */
    sogliaLavoro: 75,              /* percentuale oltre la quale segnalare */
    sogliaVita: null,
    calcolo: {
      includiRoutine: true,
      includiAppuntamenti: true,
      includiSenzaDurata: false,
      minutiPredefiniti: 0
    },
    suggerimentoRoutineMostrato: false,
    piano: "gratuito",
    installaNascosto: false,
    analisiAttive: true,
    fascia: { da: 8, a: 20, giorni: {} },
    sfondo: "griglia",
    accumuloSpento: false,
    suggerimentiSpenti: false,
    attivazioneChiusa: false,
    notificheAperto: false,
    notificheAnticipo: 10,
    profilo: null,        /* scelto all'ingresso; null = decidono i predefiniti */
    moduli: {}            /* scelte esplicite dell'utente, vincono sul profilo */
  };
}

/* Ogni passo riceve i dati e li restituisce modificati. Deve poter essere
   eseguito due volte senza cambiare il risultato la seconda. */
var PASSI_MIGRAZIONE = [
  { da: 1, a: 2, nome: "giorno singolo → elenco di giorni",
    esegui: function(d){
      /* i record incompleti non devono far cadere la migrazione:
         vengono saltati qui e ripuliti dopo dalla normalizzazione */
      (d.items || []).forEach(function(i){
        if (!i || typeof i !== "object") return;
        if (i.day !== undefined && !Array.isArray(i.days)) i.days = [i.day];
        delete i.day;
      });
      return d;
    } },
  { da: 2, a: 3, nome: "impostazioni esplicite, storico e diario",
    esegui: function(d){
      d.settings = Object.assign(impostazioniPredefinite(), d.settings || {});
      /* le preferenze che vivevano nei dati passano alle impostazioni */
      if (d.theme && !d.settings.tema) { d.settings.tema = d.theme; delete d.theme; }
      d.chiusure     = Array.isArray(d.chiusure) ? d.chiusure : [];
      d.revisioni    = Array.isArray(d.revisioni) ? d.revisioni : [];
      d.completamenti= Array.isArray(d.completamenti) ? d.completamenti : [];
      d.modelli      = Array.isArray(d.modelli) ? d.modelli : [];
      d.syncMeta = Object.assign({
        revLocale: (d.seq || 0), revRemota: 0,
        ultimaSync: null, inAttesa: false, conflitto: null
      }, d.syncMeta || {});
      /* «in attesa» diventa «bloccati da altri»: il campo interno resta
         waiting per compatibilità, si aggiunge solo la causa */
      (d.items || []).forEach(function(i){
        if (!i || typeof i !== "object") return;
        if (i.waiting && i.bloccatoDa === undefined) i.bloccatoDa = "";
      });
      return d;
    } }
,
  { da: 3, a: 4, nome: "versione per record (SYN-004)",
    esegui: function(d){
      /* Ogni record sincronizzabile riceve una versione. Il momento della
         modifica non lo conosciamo per i dati già esistenti: usiamo la data
         dell'ultimo salvataggio se c'è, altrimenti quella della migrazione.
         Non inventiamo una cronologia che non abbiamo: tutti i record
         risultano modificati nello stesso istante, ed è la verità. */
      d.versioni = (d.versioni && typeof d.versioni === "object") ? d.versioni : {};
      var quando = (d.syncMeta && d.syncMeta.ultimaSync) || new Date().toISOString();
      ["items", "capture", "links", "modelli", "obiettivi"].forEach(function(t){
        (d[t] || []).forEach(function(r){
          if (!r || typeof r !== "object" || !r.id) return;
          if (!d.versioni[r.id])
            d.versioni[r.id] = { mod: quando, rev: 0, sporco: false, del: false };
        });
      });
      d.syncMeta = d.syncMeta || {};
      d.syncMeta.perRecord = true;   /* da qui il confronto è per record */
      return d;
    } },
  { da: 4, a: 5, nome: "routine distinte dai task ricorrenti (ROU-002)",
    esegui: function(d){
      /* Tutto ciò che si ripete diventa «ricorrente»: è esattamente il
         comportamento di prima. Non indovino quali fossero abitudini — un
         pannello che riclassifica i dati da solo cambia il senso di ciò che hai
         scritto senza chiedertelo. La scelta resta all'utente, voce per voce. */
      (d.items || []).forEach(function(i){
        if (!i || typeof i !== "object") return;
        if (i.freq && i.freq !== "once" && !i.tipo) i.tipo = "ricorrente";
      });
      d.settings = d.settings || {};
      if (d.settings.routineSpiegata === undefined) d.settings.routineSpiegata = false;
      return d;
    } }
];

/* CAMPO CANONICO DELLO SCHEMA
   Dentro i dati salvati il campo è `v`, e solo quello. `schemaVersion` esiste
   soltanto nella busta di esportazione, che avvolge i dati:

     { formato:"pannello-tempo", schemaVersion:3, esportatoIl:"…", dati:{ v:3, … } }

   Erano due nomi per la stessa cosa e questo era un difetto: chi importava un
   file scritto a mano poteva metterne uno solo. Ora entrambi vengono letti,
   e in caso di disaccordo si tiene il PIÙ ALTO — perché applicare migrazioni
   già applicate è sicuro (sono idempotenti), mentre saltarne una non lo è. */
function versioneDati(d){
  if (!d || typeof d !== "object") return 1;
  var a = (typeof d.v === "number" && d.v >= 1) ? d.v : 0;
  var b = (typeof d.schemaVersion === "number" && d.schemaVersion >= 1) ? d.schemaVersion : 0;
  var v = Math.max(a, b);
  return v >= 1 ? v : 1;
}
/* Dopo la lettura il campo canonico viene riallineato e il doppione rimosso,
   così il file non resta ambiguo una seconda volta. */
function normalizzaVersione(d){
  if (!d || typeof d !== "object") return d;
  var v = versioneDati(d);
  d.v = v;
  if (d.schemaVersion !== undefined) delete d.schemaVersion;
  return d;
}

function migra(dati, registra){
  var log = [];
  function nota(t){ log.push(t); if (registra) registra(t); }
  dati = normalizzaVersione(dati);
  var v = versioneDati(dati);
  if (v > SCHEMA_ATTUALE) {
    nota("dati di una versione più recente ("+v+"): lasciati intatti");
    return { dati: dati, log: log, esito: "troppo-recente" };
  }
  if (v === SCHEMA_ATTUALE) {
    /* idempotenza: anche a versione corrente i campi mancanti vengono creati */
    var ultimo = PASSI_MIGRAZIONE[PASSI_MIGRAZIONE.length - 1];
    dati = ultimo.esegui(dati);
    nota("già alla versione "+v+": completati eventuali campi mancanti");
    return { dati: dati, log: log, esito: "aggiornato" };
  }
  var copia;
  try { copia = JSON.parse(JSON.stringify(dati)); }
  catch (e) { return { dati: dati, log: ["dati illeggibili: migrazione annullata"], esito: "errore" }; }
  try {
    PASSI_MIGRAZIONE.forEach(function(p){
      if (versioneDati(copia) === p.da) {
        copia = p.esegui(copia);
        copia.v = p.a;
        nota("migrazione "+p.da+" → "+p.a+": "+p.nome);
      }
    });
    copia.v = SCHEMA_ATTUALE;
    nota("schema portato alla versione "+SCHEMA_ATTUALE);
    return { dati: copia, log: log, esito: "migrato" };
  } catch (e) {
    nota("errore durante la migrazione: "+((e && e.message) || e));
    nota("i dati originali sono stati mantenuti");
    return { dati: dati, log: log, esito: "errore" };   /* ritorno indietro */
  }
}

/* Copia di sicurezza scritta prima di qualunque migrazione, recuperabile
   dalle impostazioni finché non viene sostituita da una nuova. */
function salvaBackupPreMigrazione(grezzo){
  try {
    Platform.archivio.scrivi(CHIAVE_BACKUP, JSON.stringify({
      quando: new Date().toISOString(), dati: grezzo
    }));
    return true;
  } catch (e) { return false; }
}
function backupPreMigrazione(){
  try { return JSON.parse(Platform.archivio.leggi(CHIAVE_BACKUP) || "null"); }
  catch (e) { return null; }
}
/* DIFETTO CORRETTO — la copia esisteva e non si poteva raggiungere.

   `backupPreMigrazione()` era definita e non veniva chiamata da nessun modulo,
   mentre js/state.js in caso di migrazione fallita diceva all'utente «Trovi la
   copia di sicurezza in Impostazioni». Non c'era niente in Impostazioni: la
   copia stava in memoria locale e nessuna schermata la mostrava. Lo stesso
   valeva per `registroMigrazioniTesto()`, e per l'intero sistema di copie
   automatiche di js/backup.js — `elencoBackup()` e `ripristinaBackup()` erano
   anch'esse senza chiamanti, pur essendo alimentate a ogni azione distruttiva.

   Questa funzione è la parte che mancava per la copia pre-migrazione. Il
   pannello che le mostra tutte vive in js/features/settings-ui.js. */
function ripristinaPreMigrazione(){
  var b = backupPreMigrazione();
  if (!b || !b.dati) return { ok:false, motivo:"Nessuna copia pre-migrazione su questo dispositivo." };
  var d;
  try { d = JSON.parse(b.dati); }
  catch (e) { return { ok:false, motivo:"La copia risulta illeggibile e non viene applicata." }; }
  if (!d || typeof d !== "object" || !Array.isArray(d.items))
    return { ok:false, motivo:"La copia non contiene un insieme di dati valido." };
  /* una copia prima del ripristino: tornare indietro dal ripristino deve
     essere possibile quanto farlo */
  salvaBackupAutomatico("prima del ripristino della copia pre-migrazione");
  snapshot("Hai ripristinato i dati come erano prima dell'aggiornamento dello schema.",
           "Vuoi annullare il ripristino?");
  S.data = Object.assign(seed(), d);
  /* La migrazione viene riapplicata, come fa `ripristinaBackup()`: far girare
     il pannello su uno schema che il codice non si aspetta più sarebbe un
     difetto peggiore di quello da cui si sta scappando. Chi ha bisogno dei
     dati esattamente come erano usa «Scarica questa copia», che non li tocca. */
  var m3 = migra(S.data);
  S.data = m3.dati;
  normalizeData();
  if (typeof forzaProssimoCompleto === "function") {
    S.disegnoCompleto = "dataset-sostituito"; forzaProssimoCompleto();
  }
  registraOperazione("ripristino", "copia pre-migrazione del " + b.quando);
  commit();
  return { ok:true, quando: b.quando };
}
function registroMigrazioniTesto(){
  return REGISTRO_MIGR.length
    ? REGISTRO_MIGR.join("\n")
    : "Nessuna migrazione eseguita in questa sessione.";
}
