# BACKLOG-COVERAGE.md

**Stato di ogni ticket, e che cosa serve per chiudere quelli aperti.**

I numeri di questo documento **non sono scritti a mano**. La fonte è
`backlog.json`; `strumenti/backlog.mjs` li ricalcola da lì e fallisce se non
coincidono. Un totale scritto a mano è vero il giorno in cui lo scrivi e
falso il giorno dopo, e un numero sbagliato ha lo stesso aspetto di un
numero giusto.

Build di riferimento: vedi `build.json`, campo `sorgenti`.

---

## Le tre parole, e cosa significano davvero

| | |
|---|---|
| **COMPLETATO** | implementato **e** verificato eseguendo. Non «il codice esiste» |
| **PARZIALE** | implementato, la verifica non è eseguibile in questo ambiente |
| **NON INIZIATO** | non implementato, con il perché |

La distinzione fra le prime due è il punto di tutto questo documento. Un
comportamento che esiste nel codice e non è mai stato eseguito è una
supposizione ragionevole, non un fatto: cinque dei difetti trovati in questo
lavoro erano in codice che a leggerlo sembrava corretto.

## Conteggi

| Area | Totale | COMPLETATO | PARZIALE | NON INIZIATO |
|---|---|---|---|---|
| A11Y | 5 | 4 | 1 | 0 |
| ARC | 2 | 2 | 0 | 0 |
| CAL | 3 | 2 | 0 | 1 |
| CPY | 1 | 1 | 0 | 0 |
| MIG | 1 | 1 | 0 | 0 |
| MOB | 2 | 0 | 2 | 0 |
| PRV | 4 | 4 | 0 | 0 |
| ROU | 2 | 2 | 0 | 0 |
| SEC | 9 | 8 | 1 | 0 |
| SYN | 6 | 6 | 0 | 0 |
| TST | 5 | 4 | 1 | 0 |
| UI | 3 | 2 | 1 | 0 |
| **totale** | **43** | **36** | **6** | **1** |

**Non esiste un solo ticket il cui stato dipenda da una prova che non è
girata.** Dove la prova non è girata, lo stato è PARZIALE. È il motivo per
cui sette righe non sono verdi pur avendo il codice al suo posto.

---

## COMPLETATO

Implementato e verificato eseguendo, nel browser, sulla build servita su
`http://localhost` — non da `file://`, dove la Content Security Policy non
si applica e i service worker non si registrano.

| Ticket | Titolo | Dove | Come è stato verificato |
|---|---|---|---|
| **SEC-001** | nessuna credenziale su disco | `js/sync.js`, `js/account.js` | eseguita nel browser: sei meccanismi di persistenza, più controprova con sentinelle |
| **SEC-002** | isolamento dei dati fra utenti | `firebase/firestore.rules`, `js/sync.js` | ESEGUITA sull'emulatore Firestore: 14 prove su 14, falliti: 0. VERIFICATA POI SUL PROGETTO REALE con le regole in vigore: lettura, creazione, aggiornamento e cancellazione da parte di un secondo utente tutte negate; accesso non autenticato negato; contenitore `users/{uid}` negato; percorso non previsto negato. E infine DAL PANNELLO, con due sessioni di browser separate sull'artefatto di produzione: il secondo utente legge un documento vuoto, non quello del primo, e la richiesta diretta del documento altrui riceve 403 |
| **SEC-003** | Content Security Policy | `index.html`, `js/boot.js` | le tre prove CSP di `tests/e2e/piattaforma.spec.js` passano in locale, agenda compresa, e il collaudo dell'accessibilità ha confermato che `style-src-elem` è applicato davvero bloccando un `addStyleTag`. E ORA ANCHE IN PIPELINE: esecuzione numero 3, commit f5212f1, il passo «CSP, PWA, offline, responsive» è passato su chromium E su firefox. Non è più un passo saltato dopo un fallimento a monte |
| **SEC-004** | normalizzazione dei campi di testo | `js/sicurezza.js`, `tests/unit/limiti-e-versioni.test.js` | eseguita nel browser DOPO aver scoperto che non scattava: il troncamento dei titoli era disattivato da una collisione fra due `var LIMITI` globali. Ora tronca a 500 caratteri e rimuove i caratteri di controllo |
| **SEC-005** | limiti dell'importazione di un backup | `js/sicurezza.js`, `tests/unit/limiti-e-versioni.test.js` | eseguita nel browser DOPO aver scoperto che nessun limite scattava (collisione fra due `var LIMITI` globali): ora 8 MB, 5000 voci, JSON non valido, array, file senza items e inquinamento del prototipo sono tutti respinti, e un backup valido passa con l'anteprima |
| **SEC-006** | limiti dell'importazione ICS | `js/sicurezza.js`, `tests/unit/limiti-e-versioni.test.js` | eseguita nel browser DOPO la stessa scoperta: ora 4 MB e 500 eventi vengono respinti, e un calendario valido passa |
| **SEC-008** | limiti e ritmo delle chiamate | `js/appcheck.js`, `js/sync.js` | otto meccanismi eseguiti nel browser (backoff, sospensione, 429, dedup, cicli, dimensioni) |
| **SEC-010** | pubblicare le regole di sicurezza sul progetto reale | `firebase/firestore.rules`, `.github/workflows/verifica.yml` | PUBBLICATE sul progetto reale e VERIFICATE interrogando il servizio, non fidandosi della console. 20 controlli su 20, exit 0, con API REST e un idToken di utente normale — nessun Admin SDK, nessun service account, nessun bypass delle regole. Le 14 prove richieste: aggiornatoIl nel passato permesso, ALL'ISTANTE CORRENTE DEL CLIENT permesso (era la prova che prima falliva), due minuti nel futuro permesso entro la tolleranza, dieci minuti nel futuro negato; creazione, lettura, aggiornamento e cancellazione del proprietario tutti permessi, con la cancellazione VISTA avvenire (200, poi 404); lettura, creazione, aggiornamento e cancellazione da parte di un secondo utente tutte negate con PERMISSION_DENIED; accesso non autenticato negato in lettura e in scrittura; percorso non previsto negato in lettura e in scrittura. Più sei controprove: il documento del proprietario è rimasto intatto dopo i quattro tentativi dell'altro utente, il contenitore users/{uid} è negato, e i due account sintetici sono stati rimossi con verifica che l'accesso successivo non funzioni |
| **PRV-001** | trasparenza su ciò che non è protetto | `js/features/settings-ui.js`, `PRIVACY.md`, `E2EE-DECISION.md` | eseguita nel browser: le tre affermazioni sono presenti nel testo visibile |
| **PRV-002** | cancellazione completa e verificata | `js/privacy.js`, `js/distruttive.js` | ESEGUITA SUL SERVIZIO REALE. Prima con chiamate REST diritte: documento creato, riletto, cancellato, e la rilettura successiva risponde 404. Poi — ed è la verifica che conta — attraverso `cancellaTutto({cloud, account, locali})`, cioè il percorso del pannello: tutti e sette i passi riusciti (cloud, verifica, account, coda, credenziali, locali, backup), esito «completo», e la controprova che l'account cancellato non permette più l'accesso. Nessun residuo lasciato sul progetto |
| **PRV-003** | esportazione dei propri dati | `js/backup.js`, `js/privacy.js` | eseguita nel browser: JSON e CSV, senza credenziali |
| **PRV-004** | analisi personali trasparenti | `js/privacy.js` | eseguita nel browser |
| **SYN-001** | contratto del fornitore di sincronizzazione | `js/sync-provider.js` | tre adattatori conformi; il dominio non nomina nessun servizio |
| **SYN-002** | stato della sincronizzazione leggibile | `js/coda.js`, `js/features/settings-ui.js` | eseguita nel browser: sei stati espliciti, mai una sola icona. PRECISAZIONE dopo la verifica funzionale: fino al commit `dcb8cae` lo stato «sincronizzato» era di fatto irraggiungibile, perché `pushNow` moriva su un difetto di contratto fra dominio e adattatore. La LEGGIBILITÀ degli stati era verificata; il loro RAGGIUNGIMENTO no. Ora il percorso completo è stato eseguito contro Firebase reale |
| **SYN-003** | coda delle modifiche offline | `js/coda.js` | eseguita nel browser |
| **SYN-004** | versione per record e fusione senza perdite | `js/versioni.js`, `js/conflitti.js` | eseguita nel browser: modifica segnata, voce non toccata non segnata, cancellazione con lapide. Ha fatto emergere il difetto peggiore del programma: `aggiornaVersioni()` passava un istante dove l'implementazione viva aspetta un dataset, e OGNI modifica salvata dal percorso normale non risultava da sincronizzare. PRECISAZIONE dopo la verifica funzionale: come per SYN-002, versioni e fusione erano verificate sui dati LOCALI, ma il percorso che li porta sul servizio non era mai stato eseguito fino a `dcb8cae`. Adesso sì: scrittura, aggiornamento e rilettura dal pannello contro Firebase reale |
| **SYN-005** | cambio account senza contaminazione | `js/account.js` | eseguita nel browser: uscita senza residui su sei meccanismi |
| **SYN-006** | sincronizzazione utilizzabile senza competenze tecniche | `js/features/settings-ui.js`, `js/sync.js`, `js/config-firebase.js` | eseguita nel browser: nessun selettore di fornitore, nessuna configurazione richiesta, terminologia verificata su 23.303 caratteri. I MESSAGGI D'ERRORE sono stati riportati in lingua comune e li verifica tests/unit/messaggi-errore.test.js (10 prove). Verificato sull'ARTEFATTO DI PRODUZIONE servito a un browser vero, contro il progetto Firebase reale, usando le funzioni del pannello e non chiamate REST scritte a mano: 17 controlli su 17. Registrazione, accesso, uscita, sincronizzazione, aggiornamento, isolamento, offline, riconnessione e cancellazione: tutte funzionanti dal pannello |
| **MIG-001** | migrazione dei dati da Gist | `js/sync-provider.js`, `js/migrations.js` | 17 casi eseguiti nel browser, compresi sette contenuti diversi e il token dimenticato dopo un errore |
| **CAL-001** | esportazione ICS | `js/calendar.js`, `js/events.js`, `js/features/settings-ui.js` | eseguita nel browser, con la data registrata |
| **CAL-002** | importazione ICS | `js/ics-import.js`, `js/sicurezza.js`, `js/features/settings-ui.js` | eseguita nel browser |
| **CPY-002** | terminologia consumer | `js/features/settings-ui.js`, `js/sync.js` | eseguita nel browser: 21 modelli su tutto il testo visibile, compresi aria-label, placeholder e title |
| **UI-002** | quanto rumore nello sfondo | `css/tokens.css`, `js/features/settings-ui.js` | eseguita nel browser |
| **UI-007** | impaginazione: colonna dei titoli, bersagli, agenda leggibile | `css/components.css`, `css/mobile.css`, `tests/ui/impaginazione.spec.js` | CENSIMENTO in un browser vero su 26 condizioni — sei larghezze da 320 a 1920 più zoom 200%, due temi, cinque sezioni. Cinque difetti veri corretti con la misura prima e dopo: blocchi d'agenda da mezz'ora alti 18px con contenuto 23 e testo tagliato (ora 24 e 24); maniglia alta 13px fisse che ne copriva il 72%; titoli di sezione su quattro colonne diverse per colpa dell'accento fuori dal riempimento (ora una sola); comandi autonomi a 18-22px sotto il minimo di WCAG 2.5.8 (ora 24); sei classi di testo informativo sotto i 12px, fino a 10 (ora 12, con due eccezioni dichiarate). Più il titolo di primo livello che mancava nel Riepilogo. 10 prove nuove e 63 asserzioni verdi, e le suite esistenti rieseguite come regressione. Due allarmi esaminati e NON corretti, con la ragione: vedi `UI-LAYOUT-REPORT.md` §3 e §4 |
| **ARC-001** | un modulo per area invece di file monolitici | `js/features/` | moduli allineati fra ORDINE.txt, index.html e sw.js |
| **ARC-003** | aggiornamento per zone invece dell'intera pagina | `js/rendering.js`, `js/render.js` | eseguita nel browser; ha fatto emergere il difetto della proprietà checked |
| **ROU-001** | ambito di modifica delle ricorrenze | `js/serie.js`, `js/events.js` | eseguita nel browser |
| **ROU-002** | routine distinte dai task ricorrenti | `js/routine.js`, `js/migrations.js` | eseguita nel browser; migrazione 4→5 verificata |
| **A11Y-001** | gerarchia delle intestazioni | `js/render.js`, `js/features/` | eseguita nel browser |
| **A11Y-002** | annunci per i lettori di schermo | `js/accessibility.js` | eseguita nel browser: la regione di annuncio esiste, è UNA sola (ce n'erano due con lo stesso id) e sopravvive al ridisegno |
| **A11Y-005** | casella di completamento nativa e con un nome | `css/components.css`, `js/tasks.js` | ESEGUITA con Playwright e axe-core: 22 prove su 22, exit 0. Comprende i nomi accessibili di tutti i campi, i label associati, le didascalie con il nome sul comando e i gruppi di pulsanti |
| **A11Y-006** | nessuna informazione dal solo colore | `css/components.css`, `js/tasks.js` | ESEGUITA: 22 prove su 22. Ha trovato due difetti veri — il pulsante di selezione a 1,39:1 e il testo «Adesso» a 4,38:1 — entrambi corretti e riverificati |
| **TST-003** | prove unitarie | `tests/unit/migrazioni.test.js`, `tests/avvio.test.js`, `tests/runner.js` | ESEGUITE con Node 20.20.2: 29 asserzioni su 29, exit 0 (migrazioni 15, limiti e versioni 14). Prima non erano eseguibili affatto: `"type": "module"` in package.json rendeva ESM ogni file .js e i collaudi usano `require()` |
| **TST-004** | prove d'integrazione | `tests/integration/gist-migrazione.test.js` | ESEGUITE con Node: 19 asserzioni su 19, exit 0 |
| **TST-005** | prove end-to-end | `tests/e2e/cancellazione.spec.js`, `tests/e2e/piattaforma.spec.js`, `tests/security/sentinelle.test.js` | 130 prove in locale su Chromium (canale Edge di sistema). In pipeline, esecuzione numero 3 sul commit f5212f1, TUTTE le suite sono passate su chromium E su firefox: terminologia, UI-006, sentinelle, cancellazione, CSP/PWA/offline/responsive, accessibilità. Nessun passo saltato per un fallimento a monte. E il flusso completo — registrazione, accesso, scrittura, rilettura, aggiornamento, isolamento, offline, riconnessione, cancellazione — è stato provato SUL SITO PUBBLICO, 23 controlli su 23. Resta saltato il solo confronto visivo dentro UI-006, per assenza di riferimenti approvati: è TST-006 |
| **TST-007** | pipeline di verifica | `.github/workflows/verifica.yml`, `strumenti/` | VERDE: esecuzione numero 3, evento push, commit f5212f1, quattro lavori su quattro riusciti, zero passi falliti. «Build e collaudi locali» 23 passi su 23; «Collaudi in browser» completo su entrambi i browser. L'unico passo saltato è «Fallisci se qualcosa è rosso», saltato PERCHÉ niente era rosso: è un cancello superato, non un controllo mancato. La prima esecuzione era rossa, e le sue due cause sono state corrette e riprovate in pipeline |

## PARZIALE

Il codice c'è. La verifica no — ma il motivo **non è più quello scritto qui
per diverse consegne**, e vale la pena dirlo perché era l'alibi di tutto il
resto.

Diceva: «in questo ambiente non ci sono Node, npm, Java né Python
(verificato, non supposto)». Adesso ci sono. Node 20.20.2 e Temurin JRE 11
sono stati installati, e con loro sono girati i runner delle prove unitarie,
Playwright su Edge di sistema e l'Emulator Firestore. Delle quindici righe
che quella frase giustificava ne restano **sei**, e ognuna ha ora un motivo
proprio e specifico invece di un motivo comune:

- **hardware o persone che non si possono automatizzare** (dispositivo
  fisico, lettore di schermo);
- **scatti di riferimento da approvare a mano**, che è il punto della
  regressione visiva;
- **App Check non attivo**, che richiede una chiave e una decisione di costo.

Nessuno di questi si risolve installando qualcosa.

Due motivi sono spariti da questo elenco, e conviene dire quali perché
erano quelli che bloccavano tutto il resto:

- **«le regole non sono pubblicate sul progetto reale»** — chiuso. Le regole
  sono pubblicate e **verificate interrogando il servizio**, 20 controlli su
  20: vedi SEC-010;
- **«la pipeline mai avviata» e «una gamba di browser mancante»** — chiusi
  insieme. La pipeline è stata eseguita ed è **verde** (esecuzione numero 3,
  commit f5212f1), e Firefox esegue in pipeline tutte le suite che qui non
  si possono scaricare: vedi TST-007, TST-005 e SEC-003. Restava vero fino
  alla consegna precedente che «un passo saltato non è un passo passato»;
  adesso quei passi non sono più saltati.

Che cosa serve per ognuno, con precisione:

| Ticket | Titolo | Dove | Che cosa manca per chiuderlo |
|---|---|---|---|
| **SEC-009** | App Check | `js/appcheck.js`, `js/config-firebase.js` | chiave reCAPTCHA, attivazione, enforcement, e la verifica che il traffico legittimo non venga bloccato. Nota: l'enforcement va attivato DOPO aver pubblicato le regole, altrimenti si sommano due cause di rifiuto e diventa difficile capire quale sia |
| **UI-006** | indicatore Lavoro/Vita nelle righe delle attività | `css/tokens.css`, `css/components.css`, `js/tasks.js` | la regressione visiva verde con riferimenti APPROVATI a mano: vedi TST-006 |
| **A11Y-004** | tastiera e fuoco sempre visibile | `css/accessibility.css`, `css/tokens.css` | una prova con un lettore di schermo reale: axe trova circa un terzo dei problemi |
| **TST-006** | regressione visiva | `tests/ui/ui006.spec.js`, `playwright.config.js` | i riferimenti approvati. Ce ne sono 19 sul disco, non tracciati e non guardati, e sono per Windows: in pipeline il suffisso è `linux`, quindi non varrebbero comunque. Servono una revisione a mano e un commit apposta. Finché non succede la pipeline può essere verde con ZERO copertura visiva, e strumenti/stato-regressione-visiva.mjs lo scrive nel riepilogo perché non passi inosservato |
| **MOB-001** | installabile e utilizzabile offline | `sw.js`, `manifest.webmanifest`, `offline.html` | una prova su un dispositivo fisico |
| **MOB-002** | utilizzabile su schermo piccolo | `css/mobile.css`, `css/components.css` | una prova su un dispositivo fisico: l'emulazione non è un telefono |

`RUN-CI.md` §8 dice, per ognuno, quale output serve; `TEST-REPORT.md` §2
elenca le prove scritte e non eseguite.

## NON INIZIATO

| Ticket | Titolo | Perché |
|---|---|---|
| **CAL-003** | integrazione automatica del calendario | `CALENDAR-SYNC.md` | richiede OAuth e un servizio che custodisca i refresh token. Senza server non è realizzabile senza promettere una custodia che non esiste: CALENDAR-SYNC.md §6 |

---

## Come si chiude un PARZIALE

1. si esegue la pipeline (`RUN-CI.md` §2 o §3);
2. si guarda l'output del passo corrispondente;
3. **se è verde**, si cambia lo stato in `backlog.json`, si allineano i
   conteggi in questo documento e si lascia che
   `strumenti/backlog.mjs` confermi;
4. **se è rosso**, si legge `RUN-CI.md` §9: la natura del fallimento dice se
   il difetto è nella prova o nel prodotto.

Il passo 3 non si salta e non si anticipa. Un ticket portato a COMPLETATO
prima di avere l'esito davanti non è un errore di forma: è la ragione per
cui un rapporto di collaudo smette di servire a qualcosa.

## I buchi nella numerazione

`SEC-007` e `A11Y-003` non compaiono, e non è una dimenticanza: non sono
stati toccati da questo lavoro. La matrice contiene i ticket su cui c'è
stato un intervento, non l'intero backlog storico. `strumenti/backlog.mjs`
verifica il contrario di ciò che potrebbe sfuggire — che **nessun ticket
citato nel codice sia assente dalla matrice** — perché quello è il caso
pericoloso: lavoro fatto che non risulta da nessuna parte.
