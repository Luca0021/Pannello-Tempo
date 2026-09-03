# CALENDAR-SYNC.md

**Che cosa si sincronizza, che cosa no, e perché il calendario non è
sincronizzazione.**

Ticket: CAL-001, CAL-002, CAL-003, CPY-002.

---

## 1. Le due cose che venivano chiamate con la stessa parola

Il pannello fa due operazioni completamente diverse che prima portavano
entrambe la parola «sincronizzazione»:

| | **Sincronizzazione dei dati** | **Calendario e promemoria** |
|---|---|---|
| Che cosa sposta | attività, routine, note, priorità, collegamenti, modelli | eventi con orario |
| Verso dove | uno spazio riservato all'utente su un servizio | un file `.ics` sul dispositivo |
| Serve un account | **sì** | **no** |
| È automatica | sì, entro qualche secondo da ogni modifica | **no**, la avvia l'utente |
| È bidirezionale | sì, fra i dispositivi dell'utente | **no**, una direzione per volta |
| Si aggiorna da sola | sì | **no**: è una copia congelata al momento dell'operazione |
| Se manca la rete | riprova, con attesa crescente | non serve la rete |

La conseguenza pratica della confusione era questa: un utente che leggeva
«sincronizzazione calendario» poteva ragionevolmente credere che spostando un
blocco nel pannello si spostasse anche l'evento nel calendario del telefono.
Non è mai stato vero, e non c'era modo di scoprirlo dai testi.

---

## 2. Che cosa viene sincronizzato automaticamente

Solo con un **Account Pannello Tempo**, e solo questo:

- attività (`items`) — comprese routine e task ricorrenti;
- note della posta in arrivo (`capture`);
- priorità del giorno (`top3`);
- collegamenti (`links`);
- modelli di giornata (`modelli`);
- obiettivi (`obiettivi`);
- spunte, registri e cronologia dei completamenti;
- le informazioni di versione per record, che servono a distinguere
  «modificato qui» da «arrivato di là».

**Non** viene sincronizzato, di proposito:

- tema, densità, sezioni chiuse, raggruppamento — sono preferenze del
  dispositivo, e prima viaggiavano coi dati imponendo a un dispositivo le
  scelte dell'altro;
- le copie di sicurezza locali;
- le due date di ultima esportazione e importazione `.ics`, che descrivono un
  gesto fatto su *questo* dispositivo;
- qualunque credenziale. Vedi `SECURITY-REPORT.md`.

Senza account **niente viene sincronizzato**: è la modalità predefinita, e si
chiama «Solo su questo dispositivo».

---

## 3. Che cosa fa l'importazione ICS

1. L'utente scarica dal proprio calendario un file `.ics` e lo scegli qui.
2. Il file viene letto **sul dispositivo**: non viene caricato da nessuna
   parte, e non passa per la rete.
3. Il pannello mostra l'elenco degli eventi trovati, quanti sono, quali
   esistono già, e quante righe non è riuscito a leggere.
4. L'utente sceglie quali importare. Nessuna selezione predefinita implicita
   su ciò che esiste già.
5. Prima di aggiungere qualcosa viene creata una copia di sicurezza.
6. Gli eventi scelti diventano **voci del pannello**: copie indipendenti.
7. La data dell'operazione viene registrata come «Ultima importazione».

**Che cosa NON fa:** non si collega al calendario, non rilegge il file più
tardi, non si accorge se l'evento originale cambia o viene cancellato. Se un
evento importato viene spostato nel calendario, la copia qui resta dov'era.

---

## 4. Che cosa fa l'esportazione ICS

1. Il pannello genera un file `.ics` con i blocchi che hanno un orario,
   escludendo ciò che è completato, scaduto, in attesa o senza giorno fisso.
2. Le ricorrenze diventano `RRULE`, quindi una routine settimanale è **un**
   evento che si ripete, non cinquantadue eventi.
3. Se richiesto, ogni evento porta un `VALARM` con l'anticipo scelto: è il
   calendario a mandare la notifica, e per questo funziona anche a telefono
   bloccato.
4. Il file viene scaricato. L'utente lo apre col proprio calendario.
5. La data viene registrata come «Ultima esportazione».

**Che cosa NON fa:** non scrive nel calendario, non aggiorna un'esportazione
precedente, non rimuove dal calendario ciò che qui è stato cancellato.
Riesportando si crea un file nuovo; il calendario riconosce gli eventi già
presenti dall'`UID` e dal `SEQUENCE`, ma il risultato dipende da come quel
calendario gestisce gli aggiornamenti, e non è una cosa che possiamo
garantire noi.

---

## 5. Limiti attuali, dichiarati nell'interfaccia

Tre frasi che compaiono nelle impostazioni, sezione *Calendario e promemoria*:

- **«Nessun calendario collegato.»** Non esiste nessuna connessione a un
  calendario: né lettura continua, né scrittura.
- **«Integrazione automatica non attiva.»** Nulla avviene da solo. Ogni
  importazione e ogni esportazione è un gesto dell'utente.
- **«Limite dei promemoria: funzionano solo col pannello aperto.»** Anche in
  una scheda in sottofondo, ma non a pannello chiuso. È un limite del
  browser: una pagina web non può programmarsi un avviso da sola. Per gli
  avvisi a pannello chiuso serve il calendario, che li riceve dal file
  esportato.

E le due date — «Ultima esportazione», «Ultima importazione» — che dicono
`mai` quando è mai. Sono **date**, non uno stato: dicono quando l'utente ha
fatto l'operazione, non che qualcosa sia allineato.

---

## 6. Integrazioni automatiche non presenti

| Integrazione | Che cosa richiederebbe | Perché non c'è |
|---|---|---|
| Google Calendar bidirezionale | OAuth 2.0 con `client_secret`, refresh token lato server, webhook per le notifiche di cambiamento | il `client_secret` non può stare in un'applicazione che gira nel browser, e i refresh token vanno custoditi da un servizio |
| Outlook / Microsoft 365 | Microsoft Graph con OAuth, stesse esigenze | idem |
| CalDAV | credenziali del calendario conservate sul dispositivo | conserverebbe una password riutilizzabile in `localStorage`: è il limite che ha portato a ritirare «Resta collegato» e a deprecare Gist |
| Sottoscrizione a un URL `.ics` | un indirizzo pubblico stabile a cui il calendario si abbona | richiede un servizio che serva il file, e renderebbe i dati leggibili a chiunque conosca l'indirizzo |

### Perché OAuth richiede un servizio

Un'autorizzazione OAuth per scrivere in un calendario produce due cose: un
token di accesso di breve durata e un **token di rinnovo** che non scade. Il
secondo è quello che permette di continuare a scrivere nel calendario senza
richiedere di nuovo il consenso, ed è esattamente la credenziale che questa
architettura non sa custodire: qualunque cosa raggiungibile da JavaScript
nella pagina è raggiungibile da JavaScript ostile nella stessa pagina.

È la stessa ragione, con lo stesso ragionamento, che ha portato a:

- rimuovere «Resta collegato» (`SECURITY-REPORT.md`, SEC-001);
- deprecare GitHub Gist invece di tenerlo come provider avanzato
  (`SYNC-DECISION.md`, `GIST-MIGRATION.md`).

Tre funzioni diverse, un solo limite: **senza un servizio che custodisca i
segreti, non si custodiscono segreti.** Prometterne la custodia sarebbe la
cosa peggiore delle tre.

### Che cosa servirebbe, concretamente

Un servizio minimo che:

1. tenga il `client_secret` dell'applicazione;
2. completi lo scambio del codice OAuth;
3. conservi il token di rinnovo per utente, cifrato;
4. esponga al pannello solo un'operazione per volta, autorizzata dalla
   sessione dell'account;
5. riceva i webhook di cambiamento e li propaghi.

È un servizio da mantenere, con i suoi costi e la sua superficie di attacco.
Non è escluso, ed è fuori da questa iterazione.

---

## 7. Dove si trova cosa nell'interfaccia

| Area | Sezione delle impostazioni | Contiene |
|---|---|---|
| **A — Account e sincronizzazione** | *3. Account e sincronizzazione* | Solo su questo dispositivo · Account Pannello Tempo · Crea account · Accedi · Password dimenticata · Verifica email · stato · ultima sincronizzazione · modifiche in attesa · non in linea · conflitto · Disconnetti · Elimina dati cloud · Elimina account e dati · migrazione legacy |
| **B — Calendario e promemoria** | *4. Calendario e promemoria* | Esporta nel calendario · Importa da file .ics · ultima esportazione · ultima importazione · promemoria nell'app · limiti · «Nessun calendario collegato» · «Integrazione automatica non attiva» |

Nessuna parola dell'area A compare nell'area B e viceversa. La regola è
verificata da un collaudo: `tests/ui/terminologia.spec.js` fallisce se nella
sezione Calendario compare una parola dell'account, o se nell'interfaccia
consumer ricompare il nome di un fornitore.

---

## 8. Stato dei ticket

| Ticket | Stato | Perché |
|---|---|---|
| CAL-001 esportazione ICS | **COMPLETATO** | esportazione funzionante, con `RRULE` e `VALARM`, data registrata, limiti dichiarati nell'interfaccia |
| CAL-002 importazione ICS | **COMPLETATO** | anteprima, scelta per evento, copia di sicurezza prima dell'importazione, data registrata, lettura solo locale |
| CAL-003 integrazione automatica | **NON INIZIATO**, e dichiarato tale | richiede OAuth e un servizio: vedi §6. Non è un difetto da correggere, è una funzione che non c'è |
| CPY-002 terminologia | **COMPLETATO** | testi separati in `landing.html`, `js/guida.js`, impostazioni, moduli, privacy; collaudo terminologico che impedisce la regressione |

CAL-001 e CAL-002 passano a COMPLETATO perché non dipendono da strumenti
assenti: sono verificabili con il pannello aperto in un browser, e lo sono
stati. CAL-003 resta NON INIZIATO, che è la verità: non è stato tentato.
