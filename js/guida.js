/* guida.js — la guida dentro il pannello.

   `GUIDA.md` è un file nel repository: chi apre il sito non lo vede mai. Una
   guida che l'utente non può raggiungere è documentazione per gli sviluppatori,
   non aiuto per chi usa il prodotto.

   Le voci non sono testo copiato: nascono dagli stessi elenchi che governano il
   pannello — moduli, profili, azioni distruttive, ambiti delle serie, stati.
   Se una funzione cambia nome, la guida cambia con lei. Le spiegazioni che non
   possono essere dedotte dal codice stanno qui sotto, in un posto solo. */

var GUIDA_SEZIONI = [
  { id:"cominciare", titolo:"Cominciare",
    testo:["All'apertura il pannello fa sei domande e poi ti lascia entrare. "+
           "Puoi saltarle tutte: niente è obbligatorio.",
           "Dopo l'ingresso compare «Come prendere la mano», che si spunta da "+
           "sola e sparisce quando ha finito. Non è un compito in più."],
    elenco: function(){
      return TRAGUARDI.map(function(t){ return { nome:t.nome, nota:t.dove }; });
    } },

  { id:"sezioni", titolo:"Le sezioni",
    testo:["Sono le stesse sul telefono e sul computer: cambia dove stanno, non "+
           "che cosa sono. Filtri, ricerca e collegamenti non sono sezioni ma "+
           "strumenti: agiscono su quello che stai guardando."],
    elenco: function(){
      return SEZIONI_PRIMARIE.map(function(s){ return { nome:s.nome, nota:s.descrizione }; });
    } },

  { id:"priorita", titolo:"Le priorità di oggi",
    testo:["Fino a tre, non di più. Compare una riga per volta: quando ne hai "+
           "scritta una, il pannello ne offre un'altra.",
           "Una priorità può essere collegata a un task: completare l'una "+
           "completa l'altro. «Scollega» toglie il legame ma non elimina il task.",
           "Si riordinano con le frecce, che funzionano anche da tastiera."] },

  { id:"proposte", titolo:"Se non sai da dove cominciare",
    testo:["Quando le priorità sono vuote il pannello propone fino a tre voci, "+
           "e per ciascuna dice **perché**: scade oggi, l'hai già rimandata, hai "+
           "un blocco in agenda per farla.",
           "Sono proposte, non scelte: le righe non vengono riempite da sole. "+
           "Scegliere è il gesto centrale, e farlo al posto tuo lo svuoterebbe.",
           "Non ti propone mai qualcosa che dipende da un'altra persona, a meno "+
           "che la data di ricontrollo non sia arrivata."],
    elenco: function(){
      return MOTIVI_SUGGERIMENTO.map(function(x){
        return { nome:"Perché "+x.testo, nota:"" };
      });
    } },

  { id:"riprogrammare", titolo:"Da riprogrammare",
    testo:["Ciò che è rimasto indietro. Ogni voce offre cinque decisioni. "+
           "«Non serve più» archivia: la ritrovi dalla ricerca, non è cancellata.",
           "Oltre "+SOGLIA_ELENCO+" arretrati l'elenco si raggruppa per età e puoi "+
           "sceglierne più di uno e decidere in un colpo solo. L'annullamento è "+
           "uno per tutti.",
           "La stessa cosa vale negli altri elenchi: dove ci sono almeno tre voci "+
           "compare «Scegli più voci». Fuori da quella modalità le caselle non "+
           "ci sono, perché sarebbero rumore per chi vuole spuntarne una sola."],
    elenco: function(){
      return Object.keys(NOMI_FASCIA).map(function(f){
        return { nome:NOMI_FASCIA[f].nome, nota:NOMI_FASCIA[f].nota };
      });
    } },

  { id:"ripetizioni", titolo:"Routine o task ricorrente",
    testo:["Due cose che si ripetono non sono la stessa cosa, e la differenza è "+
           "**che cosa succede quando salti un giorno**.",
           "Un task ricorrente va fatto: se lo salti resta indietro e torna fra "+
           "le cose da riprogrammare. Saltare la fattura di marzo non la "+
           "cancella, la sposta.",
           "Una routine è un'abitudine: se la salti, il giorno è passato e non "+
           "torna. Non diventa un arretrato e non si accumula. Un pannello che "+
           "trasforma «meditare» in settanta arretrati dopo una settimana di "+
           "ferie produce sensi di colpa e basta.",
           "Lo scegli aprendo la voce. Le voci che avevi già restano task "+
           "ricorrenti: il pannello non riclassifica da solo ciò che hai scritto."],
    elenco: function(){
      return TIPI_RIPETIZIONE.map(function(t){ return { nome:t.nome, nota:t.lungo }; });
    } },

  { id:"serie", titolo:"Routine e serie",
    testo:["Modificando qualcosa che si ripete, il pannello chiede a che cosa "+
           "vale la modifica.",
           "In nessun caso viene toccato lo storico già registrato: i "+
           "completamenti di ieri restano quelli di ieri."],
    elenco: function(){
      var E = { "questa":"Cambia solo l'occorrenza che stai guardando.",
                "questa-e-successive":"La serie si ferma alla vigilia e ne comincia una nuova.",
                "serie":"Cambia tutto, passato compreso." };
      return AMBITI.map(function(a){ return { nome:a.nome, nota:E[a.id] || "" }; });
    } },

  { id:"accumulo", titolo:"Quando qualcosa si accumula",
    testo:["Se rimandi la stessa voce più di "+SOGLIA_RINVII+" volte, il pannello te lo "+
           "fa notare — una volta sola, sulla voce messa peggio.",
           "Rimandare non è un errore. Rimandare venti volte senza accorgersene "+
           "sì: la differenza non è nel numero, ma nel fatto che nessuno l'ha "+
           "mai guardata.",
           "Le risposte sono tre: la faccio oggi, lasciala andare, ci penso "+
           "ancora. «Ci penso ancora» esiste perché a volte è la verità.",
           "Le routine non compaiono qui: per costruzione non si accumulano."] },

  { id:"giornata", titolo:"La tua giornata",
    testo:["La fascia attiva è da che ora a che ora conta il tuo tempo. Senza, "+
           "il pannello conterebbe le ventiquattr'ore, notte compresa.",
           "Il calcolo distingue quattro cose e non le confonde: pianificato "+
           "(la somma delle durate), occupato (la fascia coperta davvero: due "+
           "attività sovrapposte occupano un'ora sola), disponibile (quello che "+
           "resta) e fuori fascia."] },

  { id:"parti", titolo:"Modalità, profili e parti",
    testo:["Il profilo è il punto di partenza: accende un insieme di parti in "+
           "un colpo solo. Le parti si accendono e si spengono una per una, e "+
           "la tua scelta vince sul profilo. La modalità decide quanto "+
           "dettaglio vedere dentro le parti attive, non quali parti esistono.",
           "Spegnere una parte non cancella niente: i dati restano e tornano "+
           "riaccendendola."],
    elenco: function(){
      return MODULI.filter(function(x){ return !x.core; })
                   .map(function(x){ return { nome:x.nome, nota:x.cosa }; });
    } },

  { id:"dati", titolo:"I tuoi dati",
    testo:["Stanno nella memoria di questo browser. Non esiste un server nostro "+
           "che li riceva. Se colleghi un servizio vengono inviati anche a "+
           "quello, ma sei tu a collegarlo con credenziali tue.",
           "Se colleghi un account, **la sessione dura finché il pannello è "+
           "aperto**: chiudendolo dovrai rientrare con la password. Non esiste "+
           "un'opzione per restare collegati, e non è una dimenticanza: "+
           "conservare un token di accesso nel browser lo renderebbe leggibile "+
           "a qualunque script della pagina, e l'unica protezione vera richiede "+
           "un server che questa installazione non ha.",
           "Puoi portarli via in tre formati: JSON con tutto, CSV con le "+
           "attività, ICS con gli impegni a orario. Nessuno richiede il "+
           "pannello per essere letto."],
    elenco: function(){
      return AZIONI_DISTRUTTIVE.map(function(a){
        return { nome:a.nome, nota:"Elimina: "+a.elimina+" Conserva: "+a.conserva };
      });
    } },

  /* CPY-002 — questa voce si chiamava «Sincronizzazione» e basta, e nel
     pannello convivevano due cose chiamate con la stessa parola: mandare i
     propri dati su un altro dispositivo, e scaricare un file per il
     calendario. Ora sono due voci separate, e ognuna dice che cos'è. */
  { id:"sincronizzazione", titolo:"Sincronizzazione dei dati",
    testo:["Riguarda le tue attività, non il calendario. Serve un Account "+
           "Pannello Tempo: senza account i dati restano su questo dispositivo, "+
           "che è il comportamento predefinito.",
           "Il confronto avviene record per record. Due modifiche su voci "+
           "diverse non sono un conflitto e vengono unite da sole.",
           "Quando la stessa voce è cambiata in due posti il pannello si ferma, "+
           "mostra le differenze e ti fa scegliere. Finché non decidi non viene "+
           "sovrascritto niente."],
    elenco: function(){
      return Object.keys(STATI).filter(function(k){ return STATI[k].breve; })
        .map(function(k){ return { nome:STATI[k].breve, nota:STATI[k].cosa }; });
    } },

  { id:"calendario", titolo:"Calendario e promemoria",
    testo:["Non è sincronizzazione, ed è la distinzione che conta di più in "+
           "questa guida. Il calendario si scambia FILE: nessun collegamento "+
           "automatico, nessun account, niente che si aggiorni da solo.",
           "Nessun calendario è collegato, e l'integrazione automatica non è "+
           "attiva: un collegamento vero nei due sensi con Google Calendar o "+
           "Outlook richiede un'autorizzazione OAuth e un servizio che la "+
           "custodisca, che questa versione non ha."],
    elenco: function(){
      return [
        { nome:"Esporta nel calendario",
          nota:"Scarica un file .ics con i tuoi blocchi e lo apri col calendario, che poi manda le notifiche lui, anche a telefono bloccato. È una copia: se cambi un orario qui, il calendario non se ne accorge." },
        { nome:"Importa da file .ics",
          nota:"Leggi un file esportato dal tuo calendario, guardi cosa contiene e scegli quali eventi importare. Il file non esce dal dispositivo." },
        { nome:"Promemoria nell'app",
          nota:"Avvisi mentre il pannello è aperto, anche in una scheda in sottofondo. A pannello chiuso non arriva niente: è un limite del browser, non una scelta." },
        { nome:"Ultima esportazione e ultima importazione",
          nota:"Le trovi nelle impostazioni, sezione Calendario e promemoria. Sono date, non uno stato di sincronizzazione: dicono quando l'hai fatto, non che sia allineato." }
      ];
    } },

  { id:"problemi", titolo:"Se qualcosa va storto",
    elenco: function(){
      return [
        { nome:"Ho cancellato per sbaglio",
          nota:"«Annulla» compare subito dopo. Più tardi, guarda le copie di sicurezza in Backup e dati: ne vengono tenute cinque." },
        { nome:"Il pannello è vuoto all'apertura",
          nota:"I dati stanno nel browser: controlla di non essere in navigazione privata o su un browser diverso." },
        { nome:"La sincronizzazione dei dati dà errore",
          nota:"I dati sono comunque salvati sul dispositivo. Il dettaglio dell'errore dice che cosa non ha funzionato." },
        { nome:"La sessione è scaduta",
          nota:"Dura finché il pannello resta aperto: chiudendolo rientri con la password. Non conserviamo sul dispositivo nulla che permetta di rientrare al posto tuo, e questo è voluto." },
        { nome:"Non trovo una voce",
          nota:"La ricerca copre anche l'archivio: ciò che hai segnato come «non serve più» è lì." },
        { nome:"Ho spento una parte e mancano delle voci",
          nota:"Sono ancora lì. Riaccendi la parte dalle impostazioni." }
      ];
    } },

  { id:"limiti", titolo:"Che cosa il pannello non fa",
    testo:["Detto per evitare aspettative sbagliate."],
    elenco: function(){
      return [
        { nome:"Non condivide niente con altre persone", nota:"" },
        { nome:"Non manda notifiche a pannello chiuso", nota:"Gli avvisi arrivano solo mentre è aperto." },
        { nome:"Non si collega a Google Calendar o Outlook", nota:"Nessun calendario collegato, integrazione automatica non attiva. Puoi esportare e importare file .ics." },
        { nome:"Non cifra i dati end-to-end", nota:"Con un account i dati sono cifrati in transito e a riposo, ma chi gestisce il servizio potrebbe tecnicamente leggerli. Vedi E2EE-DECISION.md." },
        { nome:"Non tiene la sessione aperta fra un'apertura e l'altra", nota:"Servirebbe conservare sul dispositivo una credenziale riutilizzabile, e non esiste un posto sicuro dove metterla senza un server." },
        { nome:"Non ha un server proprio", nota:"Senza account, se perdi il dispositivo i dati sono persi: esporta un backup." },
        { nome:"Non indovina le priorità al posto tuo", nota:"" }
      ];
    } }
];

function sezioneGuida(id){
  return GUIDA_SEZIONI.filter(function(s){ return s.id === id; })[0] || null;
}


/* Aperta o no. Una funzione sola, perché il confronto sbagliato in un punto
   solo faceva coprire il pannello dalla guida in ogni disegno. */
function guidaVisibile(){
  return typeof S.guidaAperta === "string";
}
