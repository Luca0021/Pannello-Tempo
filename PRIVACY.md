# PRIVACY.md

**Che cosa il pannello sa di te, dove lo tiene, chi può leggerlo e come te
lo porti via.**

Ticket: PRV-001, PRV-002, PRV-003, PRV-004.

Questo documento descrive la build corrente. Se una frase qui non
corrisponde a quello che il pannello fa, è questo documento a essere
sbagliato: segnalalo.

---

## 1. Due modalità, e la predefinita non manda niente da nessuna parte

### Solo su questo dispositivo — predefinita

Nessun account, nessun servizio, niente da configurare. I dati stanno nella
memoria del browser (`localStorage`), su questo dispositivo, e **non escono
da lì**. Non esiste un server che li riceva.

Conseguenza da sapere: se perdi il dispositivo, o svuoti i dati del sito, o
usi la navigazione privata, **i dati sono persi**. Non abbiamo una copia.
Esporta un backup.

### Con un Account Pannello Tempo — a tua scelta

I dati vengono conservati anche in uno spazio riservato al tuo account, su
Google Cloud Firestore, in Europa.

---

## 2. Che cosa resta locale e che cosa viene sincronizzato

| Dato | Locale | Sincronizzato |
|---|---|---|
| attività, routine, task ricorrenti | sì | sì |
| note della posta in arrivo | sì | sì |
| priorità del giorno | sì | sì |
| collegamenti | sì | sì |
| modelli di giornata | sì | sì |
| obiettivi | sì | sì |
| spunte, registri, cronologia dei completamenti | sì | sì |
| chiusure di giornata e revisioni settimanali | sì | sì |
| tema, densità, sezioni chiuse, raggruppamento | sì | **no** |
| copie di sicurezza automatiche | sì | **no** |
| data di ultima esportazione/importazione `.ics` | sì | **no** |
| coda delle modifiche in attesa | sì | **no** |
| password | **no**, mai scritta | **no** |
| token di sessione | **no**, solo in memoria | **no** |

Le preferenze del dispositivo non si sincronizzano di proposito: prima
viaggiavano coi dati, e un dispositivo imponeva il proprio tema all'altro.

---

## 3. Dove finiscono, e chi può leggerli

| | |
|---|---|
| Servizio | Google Cloud Firestore |
| Area | Europa (`europe-west` / `eur3`) |
| Percorso | `users/{il tuo identificativo}/…` |
| Chi vi accede dall'app | **solo tu**, per le Security Rules |
| Chi vi accede altrimenti | **chi gestisce il progetto**, dalla console del servizio |

### La frase che conta

**I dati non sono cifrati end-to-end.** Sono cifrati mentre viaggiano e
cifrati sui dischi del servizio, ma il servizio li decifra per usarli:
quindi **chi gestisce il progetto Pannello Tempo può tecnicamente
leggerli**, e potrebbe essere obbligato a consegnarli da un'autorità
competente.

Nessun altro utente può, perché ogni spazio è legato al suo proprietario.

Perché non c'è la cifratura end-to-end, e a quali condizioni potrebbe
arrivare: `E2EE-DECISION.md`. La ragione breve è che con la cifratura
end-to-end una password dimenticata significa dati perduti, e le
alternative sono peggiori del problema.

Non scriviamo «i tuoi dati sono al sicuro». Non è un'informazione.

---

## 4. Protezioni attive, e non attive

| Protezione | Stato | Che cosa fa |
|---|---|---|
| TLS in transito | **attiva** | nessuno legge i dati mentre viaggiano |
| Cifratura a riposo | **attiva**, dal servizio | protegge dal furto di un disco, non da chi ha le credenziali |
| Autenticazione con email e password | **attiva** | stabilisce chi sei |
| Isolamento per identificativo | **attiva** | nessun altro utente accede al tuo spazio |
| Verifica delle regole di isolamento | **NON eseguita** | le regole sono scritte, i 14 collaudi non sono stati eseguiti: SEC-002 PARZIALE |
| Protezione dall'abuso (App Check) | **non attiva** | predisposta, con il costo dichiarato in `FIREBASE-SETUP.md` §10 |
| Cifratura sul dispositivo | **non attiva** | vedi `E2EE-DECISION.md` |
| Cifratura end-to-end | **non attiva** | idem |
| Nessun token conservato | **attiva** | la sessione finisce con la scheda |
| Content Security Policy | **attiva, con un limite** | vedi `SECURITY-REPORT.md` SEC-003 |
| Backup automatico del database | **NON esiste** | l'unica copia ripristinabile è quella che esporti tu |

La riga sulla verifica delle regole è quella che ci imbarazza di più, ed è
scritta per questo: l'isolamento fra utenti si regge su quelle regole, e
finché i collaudi non girano è una promessa fondata su una lettura del
codice.

---

## 5. Sessione e credenziali

- la **password** non viene mai scritta da nessuna parte: va a Google per
  l'autenticazione e non resta;
- il **token di sessione** vive solo in memoria e sparisce chiudendo la
  scheda. Non è su disco;
- **non esiste** un token di rinnovo: non lo chiediamo e non lo
  conserviamo. Per questo la sessione finisce con la scheda, e per questo
  «Resta collegato» è stato rimosso;
- **nessun cookie**;
- i **backup** e le **esportazioni** non contengono credenziali: un
  controllo automatico cerca i modelli di sei tipi di segreto in sei
  meccanismi di persistenza (`tests/security/sentinelle.test.js`).

Perché non teniamo la sessione: conservare una credenziale riutilizzabile
richiede un cookie protetto dal browser, quindi un server, che questa
installazione non ha. Qualunque cosa raggiungibile da JavaScript nella
pagina è raggiungibile da JavaScript ostile nella stessa pagina, e cifrarla
con una chiave che sta nella stessa pagina sposta il problema di una riga.

---

## 6. Conservazione

| Dato | Quanto resta |
|---|---|
| attività e note | finché non le cancelli tu |
| cronologia dei completamenti | ultime 1200 voci, poi le più vecchie cadono |
| chiusure di giornata | ultime 400 |
| copie di sicurezza automatiche | ultime 5 |
| copia prima di una migrazione | 1, sostituita dalla successiva |
| coda delle modifiche | ultime 300 |
| diario tecnico delle operazioni | ultime 200 |
| dati nell'account | finché non elimini l'account o i dati cloud |

Non c'è una scadenza automatica: nulla viene cancellato dopo N mesi, perché
un pannello che dimentica le tue routine dell'anno scorso non serve.

---

## 7. Diario tecnico

Il pannello tiene un diario delle operazioni tecniche, leggibile e
scaricabile dalle impostazioni. Contiene **che cosa** è avvenuto e
**quante** voci ha toccato. **Non contiene**:

- titoli o contenuti delle attività;
- token, password, chiavi;
- indirizzi email di altri account.

Esempio reale: `migrazione — recupero dal servizio precedente, modo unisci,
26 voci in arrivo`.

Il motivo è concreto: un diario tecnico finisce negli screenshot di
assistenza e nei messaggi di segnalazione. Se contenesse «Visita dal
cardiologo», quel dato finirebbe in una casella di posta.

---

## 8. Telemetria: non c'è

- nessun servizio di analisi;
- nessun contatore di eventi;
- Google Analytics **disattivato** nel progetto Firebase, e la procedura di
  configurazione lo prescrive;
- nessuna segnalazione automatica di errori;
- nessuna pubblicità, nessun tracciatore, nessun cookie.

Il servizio registra, per proprio conto, i log tecnici di accesso alle
proprie API — è inevitabile usando un servizio di terzi, e li governa
l'informativa di Google.

**Se un giorno introducessimo telemetria**, questa sezione cambierebbe
prima del rilascio, non dopo. È anche il motivo per cui l'attivazione di
App Check è una decisione con un costo dichiarato: reCAPTCHA raccoglie
segnali sul dispositivo, e questa sezione andrebbe riscritta.

---

## 9. I tuoi comandi

Tutti gratuiti, in ogni piano: le funzioni che servono a controllare i
propri dati non stanno mai dietro un pagamento.

### Esportare

| Formato | Contiene |
|---|---|
| JSON | tutto, reimportabile, senza credenziali |
| CSV | le attività, per fogli di calcolo |
| ICS | i blocchi con orario, per il calendario |

### Cancellare

| Comando | Che cosa fa |
|---|---|
| **Cancella la cronologia** | completamenti, chiusure, revisioni, registri. Le attività restano |
| **Elimina i dati di questo dispositivo** | dati locali, credenziali, copie di sicurezza |
| **Elimina i dati cloud** | il contenuto del tuo spazio, compreso il percorso delle versioni precedenti |
| **Elimina account e dati** | i due precedenti, più l'account di accesso |

Ogni comando riporta l'esito **passo per passo**. Se il cloud fallisce e il
locale riesce, lo dice: un «fatto» complessivo che nasconde un fallimento
parziale è peggio di un errore dichiarato.

L'eliminazione dell'account richiede di aver inserito la password da poco:
è irreversibile, e chi trova il dispositivo aperto non deve poterla
eseguire.

**PRV-002 è PARZIALE**: la cancellazione è implementata e riporta gli esiti,
ma la verifica che il documento remoto non sia più leggibile dopo
l'eliminazione richiede l'emulatore, e non è stata eseguita. Non
dichiariamo verificata una cancellazione che non abbiamo visto avvenire.

---

## 10. Analisi personali

Il pannello ricava alcune osservazioni dai tuoi dati — a che ora completi
le cose, quali routine salti, quante volte rimandi la stessa voce. Sono
calcolate **sul dispositivo**, non escono da lì per essere elaborate, e si
possono spegnere dalle impostazioni.

Le impostazioni elencano esattamente quali dati usano e quante voci
contengono, così la frase «usa i tuoi dati» ha un numero accanto.

---

## 11. Minori

Il pannello non è destinato a minori di 16 anni e non chiede l'età. Non
raccogliamo dati che permettano di dedurla.

---

## 12. Se qualcosa cambia

Cambiando ciò che viene raccolto o dove finisce, questo documento cambia
**prima** del rilascio. La versione della build a cui si riferisce è in
`build.json`, campo `sorgenti`, e ogni modifica sostanziale è in
`CHANGELOG.md`.

Non ci sono versioni di questo documento tenute nascoste: la cronologia è
quella di git.
