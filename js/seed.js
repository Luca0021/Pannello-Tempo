/* seed.js — dati iniziali e collegamenti predefiniti
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- dati iniziali ---------- */
function seed(){
  return {
    items: [
      {id:"l1",area:"lavoro",freq:"daily",label:"Finestra email",start:9.5,dur:0.5},
      {id:"l2",area:"lavoro",freq:"daily",label:"Blocco focus",start:10,dur:1.5},
      {id:"l3",area:"lavoro",freq:"daily",label:"Finestra email",start:13,dur:0.5},
      {id:"l4",area:"lavoro",freq:"daily",label:"Blocco focus",start:15,dur:1.5},
      {id:"l5",area:"lavoro",freq:"daily",label:"Finestra email",start:17,dur:0.5},
      {id:"l6",area:"lavoro",freq:"daily",label:"Chiudi la giornata: prepara domani",start:17.5,dur:0.25},
      {id:"l7",area:"lavoro",freq:"weekly",day:5,label:"Rivedi il calendario e taglia una riunione",start:16,dur:0.5},
      {id:"l8",area:"lavoro",freq:"weekly",day:5,label:"Svuota del tutto la casella"},
      {id:"l9",area:"lavoro",freq:"monthly",dom:0,label:"Quali task ricorrenti puoi eliminare o automatizzare?"},
      {id:"o1",area:"lavoro",freq:"once",date:inDays(2),label:"Esempio: riunione con il cliente",start:11,dur:1},
      {id:"v1",area:"vita",freq:"daily",label:"Movimento",start:18.5,dur:0.75},
      {id:"v2",area:"vita",freq:"daily",label:"Telefono fuori dalla stanza",start:22,dur:0.25},
      {id:"v3",area:"vita",freq:"daily",label:"Svuota lo scarico"},
      {id:"v4",area:"vita",freq:"weekly",day:6,label:"Ora amministrativa: bollette e burocrazia",start:10,dur:1},
      {id:"v5",area:"vita",freq:"weekly",day:0,label:"Menù della settimana e spesa"},
      {id:"v6",area:"vita",freq:"weekly",label:"Una cosa solo per te"},
      {id:"v7",area:"vita",freq:"monthly",dom:1,label:"Controlla abbonamenti e spese ricorrenti"}
    ],
    links:[
      {id:"k1",name:"Posta",url:"https://outlook.cloud.microsoft/mail/",area:"lavoro"},
      {id:"k2",name:"Calendario",url:"https://outlook.cloud.microsoft/calendar/",area:"lavoro"},
      {id:"k3",name:"Teams",url:"https://teams.microsoft.com/",area:"lavoro"},
      {id:"k4",name:"File",url:"https://m365.cloud.microsoft/",area:"lavoro"},
      {id:"k5",name:"To Do",url:"https://todo.cloud.microsoft/",area:"lavoro"},
      {id:"k6",name:"Banca",url:"https://www.bmedonline.it",area:"vita"},
      {id:"k7",name:"Gmail",url:"https://mail.google.com/",area:"vita"},
      {id:"k8",name:"Drive",url:"https://drive.google.com/",area:"vita"}
    ],
    v:SCHEMA_ATTUALE, settings:impostazioniPredefinite(),
    chiusure:[], revisioni:[], completamenti:[], modelli:[], rinvii:{},
    syncMeta:{ revLocale:0, revRemota:0, ultimaSync:null, inAttesa:false, conflitto:null },
    ignora:{}, checks:{}, capture:[], top3:{key:"",list:[]}, doneAt:{}, skips:{}, archive:[], log:{}, seq:0
  };
}



/* Struttura vuota, senza contenuti d'esempio.
   Dopo «elimina tutto» il pannello deve restare vuoto: riseminare i dati
   dimostrativi farebbe ricomparire diciassette voci a chi ha appena chiesto di
   cancellare tutto. */
function datiVuoti(){
  var d = seed();
  d.items = []; d.capture = []; d.chiusure = []; d.revisioni = [];
  d.completamenti = []; d.modelli = []; d.archive = []; d.operazioni = [];
  d.log = {}; d.checks = {}; d.doneAt = {}; d.skips = {}; d.rinvii = {};
  d.ignora = {}; d.versioni = {}; d.coda = [];
  d.top3 = { key: dk(), list: [{t:"",id:null,done:false},
                               {t:"",id:null,done:false},{t:"",id:null,done:false}] };
  return d;
}
