/* distruttive.js — BCK-002: le azioni che tolgono qualcosa, ciascuna distinta.

   Prima esisteva un «Ripristina» generico accanto a «Svuota tutto»: due comandi
   per sei intenzioni diverse, e chi premeva non poteva sapere cosa avrebbe
   perso. Qui ogni azione dichiara che cosa elimina, che cosa conserva, quanto
   pesa la conferma e se è annullabile.

   Il livello di conferma è proporzionato al rischio, non uniforme:
     1  un clic                      (recuperabile con Annulla)
     2  una domanda                  (recuperabile da una copia di sicurezza)
     3  scrivere la parola CANCELLA  (irreversibile) */

var AZIONI_DISTRUTTIVE = [
  { id: "aspetto",
    nome: "Ripristina l'aspetto",
    elimina: "Tema, densità, sezioni aperte o chiuse, ordine dei collegamenti.",
    conserva: "Tutte le attività, le routine, le note, la cronologia e le impostazioni.",
    conferma: 1, annullabile: true, backup: false,
    esegui: function(){
      var tenuti = { fold: {} };
      P.theme = "auto"; P.dense = false; P.fold = {}; P.groupBy = "area";
      savePrefs();
      return { ok: true, nota: "Aspetto riportato ai valori iniziali." };
    } },

  { id: "impostazioni",
    nome: "Ripristina le impostazioni",
    elimina: "Modalità, profilo, moduli attivi, fascia oraria, soglie, preferenze di avviso.",
    conserva: "Attività, routine, note, priorità, cronologia e credenziali.",
    conferma: 2, annullabile: true, backup: true,
    esegui: function(){
      snapshot("Hai ripristinato le impostazioni.", "Vuoi rimetterle come erano?");
      S.data.settings = impostazioniPredefinite();
      S.disegnoCompleto = "cambio-profilo"; forzaProssimoCompleto();
      commit();
      return { ok: true, nota: "Impostazioni riportate ai valori iniziali." };
    } },

  { id: "attivita",
    nome: "Svuota le attività",
    elimina: "Tutte le attività, le routine e le priorità di oggi.",
    conserva: "Impostazioni, collegamenti, note, cronologia e credenziali.",
    conferma: 2, annullabile: true, backup: true,
    esegui: function(){
      snapshot("Hai svuotato le attività.", "Vuoi riportarle indietro?");
      var quante = (S.data.items || []).length;
      /* la lapide propaga la cancellazione, ma i riferimenti vanno tolti tutti:
         spunte, registri e ripianificazioni di voci che non esistono più
         restano altrimenti appesi e nessuno può più rimuoverli */
      (S.data.items || []).forEach(function(i){
        if (!i || !i.id) return;
        segnaCancellato(i.id);
        ripulisciRiferimenti(i.id);
      });
      S.data.items = [];
      S.data.top3 = { key: dk(), list: [{t:"",id:null,done:false},
                                        {t:"",id:null,done:false},{t:"",id:null,done:false}] };
      commit();
      return { ok: true, nota: quante + (quante === 1 ? " attività rimossa." : " attività rimosse.") };
    } },

  { id: "disconnetti",
    nome: "Disconnetti l'account",
    elimina: "Credenziali e sessione su questo dispositivo.",
    conserva: "Tutti i dati, qui e sul servizio collegato. Puoi rientrare quando vuoi.",
    conferma: 1, annullabile: false, backup: false,
    esegui: function(){
      var r = (typeof esciAccount === "function") ? esciAccount() : { residui: [] };
      var residui = r.residui || [];
      return { ok: residui.length === 0,
               nota: residui.length ? "Restano: " + residui.join(", ")
                                    : "Uscito. I dati non sono stati toccati." };
    } },

  { id: "locali",
    nome: "Elimina i dati su questo dispositivo",
    elimina: "Attività, routine, note, cronologia, copie di sicurezza e credenziali locali.",
    conserva: "I dati sul servizio collegato, se ne hai uno: da lì puoi riscaricarli.",
    conferma: 3, annullabile: false, backup: false, parola: "CANCELLA",
    esegui: null },      /* passa da cancellaTutto(false): esito per passaggio */

  { id: "account",
    nome: "Elimina l'account e tutti i dati",
    elimina: "Tutto: dati locali, dati sul servizio collegato, credenziali e copie.",
    conserva: "Niente. Restano solo i file che hai esportato tu.",
    conferma: 3, annullabile: false, backup: false, parola: "CANCELLA",
    richiedeAutenticazione: true,
    esegui: null }       /* passa da cancellaTutto(true) */
];

function azioneDistruttiva(id){
  return AZIONI_DISTRUTTIVE.filter(function(a){ return a.id === id; })[0] || null;
}

/* Esegue l'azione, creando prima una copia di sicurezza quando è recuperabile. */
function eseguiDistruttiva(id, poi){
  var a = azioneDistruttiva(id);
  if (!a) { if (poi) poi({ ok:false, nota:"Azione sconosciuta." }); return; }
  if (a.richiedeAutenticazione && !autenticazioneRecente()) {
    if (poi) poi({ ok:false, nota:"Serve un accesso recente: esci e rientra con la password." });
    return;
  }
  if (a.backup) salvaBackupAutomatico("prima di « " + a.nome + " »");
  registraOperazione("azione distruttiva", a.nome);

  if (a.esegui) { var r = a.esegui(); save(); if (poi) poi(r); return; }
  /* le due più gravi passano dalla cancellazione a passaggi */
  cancellaTutto(a.id === "account", function(esito){
    S.esitoCancellazione = esito;
    S.data = datiVuoti(); normalizeData();
    S.disegnoCompleto = "dataset-sostituito"; forzaProssimoCompleto();
    if (poi) poi({ ok: esito.completo, nota: esito.completo ? "Fatto."
                   : "Una parte non è riuscita: vedi il dettaglio.", esito: esito });
  });
}
