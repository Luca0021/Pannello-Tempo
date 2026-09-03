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
| A11Y | 5 | 2 | 3 | 0 |
| ARC | 2 | 2 | 0 | 0 |
| CAL | 3 | 2 | 0 | 1 |
| CPY | 1 | 1 | 0 | 0 |
| MIG | 1 | 1 | 0 | 0 |
| MOB | 2 | 0 | 2 | 0 |
| PRV | 4 | 3 | 1 | 0 |
| ROU | 2 | 2 | 0 | 0 |
| SEC | 8 | 5 | 3 | 0 |
| SYN | 6 | 6 | 0 | 0 |
| TST | 5 | 0 | 5 | 0 |
| UI | 2 | 1 | 1 | 0 |
| **totale** | **41** | **25** | **15** | **1** |

**Non esiste un solo ticket il cui stato dipenda da una prova che non è
girata.** Dove la prova non è girata, lo stato è PARZIALE. È il motivo per
cui quindici righe non sono verdi pur avendo il codice al suo posto.

---

## COMPLETATO

Implementato e verificato eseguendo, nel browser, sulla build servita su
`http://localhost` — non da `file://`, dove la Content Security Policy non
si applica e i service worker non si registrano.

| Ticket | Titolo | Dove | Come è stato verificato |
|---|---|---|---|
| **SEC-001** | nessuna credenziale su disco | `js/sync.js`, `js/account.js` | eseguita nel browser: sei meccanismi di persistenza, più controprova con sentinelle |
| **SEC-004** | normalizzazione dei campi di testo | `js/sicurezza.js` | eseguita nel browser |
| **SEC-005** | limiti dell'importazione di un backup | `js/sicurezza.js` | eseguita nel browser |
| **SEC-006** | limiti dell'importazione ICS | `js/sicurezza.js` | eseguita nel browser |
| **SEC-008** | limiti e ritmo delle chiamate | `js/appcheck.js`, `js/sync.js` | otto meccanismi eseguiti nel browser (backoff, sospensione, 429, dedup, cicli, dimensioni) |
| **PRV-001** | trasparenza su ciò che non è protetto | `js/features/settings-ui.js`, `PRIVACY.md`, `E2EE-DECISION.md` | eseguita nel browser: le tre affermazioni sono presenti nel testo visibile |
| **PRV-003** | esportazione dei propri dati | `js/backup.js`, `js/privacy.js` | eseguita nel browser: JSON e CSV, senza credenziali |
| **PRV-004** | analisi personali trasparenti | `js/privacy.js` | eseguita nel browser |
| **SYN-001** | contratto del fornitore di sincronizzazione | `js/sync-provider.js` | tre adattatori conformi; il dominio non nomina nessun servizio |
| **SYN-002** | stato della sincronizzazione leggibile | `js/coda.js`, `js/features/settings-ui.js` | eseguita nel browser: sei stati espliciti, mai una sola icona |
| **SYN-003** | coda delle modifiche offline | `js/coda.js` | eseguita nel browser |
| **SYN-004** | versione per record e fusione senza perdite | `js/versioni.js`, `js/conflitti.js` | eseguita nel browser: cinque categorie, conflitti isolati per record |
| **SYN-005** | cambio account senza contaminazione | `js/account.js` | eseguita nel browser: uscita senza residui su sei meccanismi |
| **SYN-006** | sincronizzazione utilizzabile senza competenze tecniche | `js/features/settings-ui.js`, `js/sync.js`, `js/config-firebase.js` | eseguita nel browser: nessun selettore di fornitore, nessuna configurazione richiesta, terminologia verificata su 23.303 caratteri |
| **MIG-001** | migrazione dei dati da Gist | `js/sync-provider.js`, `js/migrations.js` | 17 casi eseguiti nel browser, compresi sette contenuti diversi e il token dimenticato dopo un errore |
| **CAL-001** | esportazione ICS | `js/calendar.js`, `js/events.js`, `js/features/settings-ui.js` | eseguita nel browser, con la data registrata |
| **CAL-002** | importazione ICS | `js/ics-import.js`, `js/sicurezza.js`, `js/features/settings-ui.js` | eseguita nel browser |
| **CPY-002** | terminologia consumer | `js/features/settings-ui.js`, `js/sync.js` | eseguita nel browser: 21 modelli su tutto il testo visibile, compresi aria-label, placeholder e title |
| **UI-002** | quanto rumore nello sfondo | `css/tokens.css`, `js/features/settings-ui.js` | eseguita nel browser |
| **ARC-001** | un modulo per area invece di file monolitici | `js/features/` | moduli allineati fra ORDINE.txt, index.html e sw.js |
| **ARC-003** | aggiornamento per zone invece dell'intera pagina | `js/rendering.js`, `js/render.js` | eseguita nel browser; ha fatto emergere il difetto della proprietà checked |
| **ROU-001** | ambito di modifica delle ricorrenze | `js/serie.js`, `js/events.js` | eseguita nel browser |
| **ROU-002** | routine distinte dai task ricorrenti | `js/routine.js`, `js/migrations.js` | eseguita nel browser; migrazione 4→5 verificata |
| **A11Y-001** | gerarchia delle intestazioni | `js/render.js`, `js/features/` | eseguita nel browser |
| **A11Y-002** | annunci per i lettori di schermo | `js/accessibility.js` | eseguita nel browser: la regione di annuncio esiste, è UNA sola (ce n'erano due con lo stesso id) e sopravvive al ridisegno |

## PARZIALE

Il codice c'è. La verifica no, e nei quindici casi qui sotto il motivo è
sempre lo stesso: **in questo ambiente non ci sono Node, npm, Java né
Python** (verificato, non supposto). Senza di quelli non girano l'Emulator
Firebase, Playwright, i runner delle prove unitarie e la regressione visiva.

Che cosa serve per ognuno, con precisione:

| Ticket | Titolo | Dove | Che cosa manca per chiuderlo |
|---|---|---|---|
| **SEC-002** | isolamento dei dati fra utenti | `firebase/firestore.rules`, `js/sync.js` | tests/security/regole.test.js su Emulator con falliti: 0 |
| **SEC-003** | Content Security Policy | `index.html`, `js/boot.js` | il passo CSP verde in pipeline, con l'agenda che si disegna |
| **SEC-009** | App Check | `js/appcheck.js`, `js/config-firebase.js` | chiave reCAPTCHA, attivazione, e la verifica che il traffico legittimo non venga bloccato |
| **PRV-002** | cancellazione completa e verificata | `js/privacy.js`, `js/distruttive.js` | tests/e2e/cancellazione.spec.js verde, e una cancellazione vista avvenire su un servizio reale |
| **UI-006** | indicatore Lavoro/Vita nelle righe delle attività | `css/tokens.css`, `css/components.css`, `js/tasks.js` | regressione visiva verde con riferimenti approvati, non appena generati |
| **A11Y-004** | tastiera e fuoco sempre visibile | `css/accessibility.css`, `css/tokens.css` | il passo Accessibilità verde, e una prova con un lettore di schermo reale |
| **A11Y-005** | casella di completamento nativa e con un nome | `css/components.css`, `js/tasks.js` | il passo Accessibilità verde |
| **A11Y-006** | nessuna informazione dal solo colore | `css/components.css`, `js/tasks.js` | il passo Accessibilità verde su tutta la pagina |
| **TST-003** | prove unitarie | `tests/unit/migrazioni.test.js`, `tests/avvio.test.js`, `tests/runner.js` | Node: il rispettivo passo verde |
| **TST-004** | prove d'integrazione | `tests/integration/gist-migrazione.test.js` | Node: il rispettivo passo verde |
| **TST-005** | prove end-to-end | `tests/e2e/cancellazione.spec.js`, `tests/e2e/piattaforma.spec.js`, `tests/security/sentinelle.test.js` | Node e Playwright: i rispettivi passi verdi su entrambi i browser |
| **TST-006** | regressione visiva | `tests/ui/ui006.spec.js`, `playwright.config.js` | una prima esecuzione che generi gli scatti, la loro revisione, e il commit che li approva |
| **TST-007** | pipeline di verifica | `.github/workflows/verifica.yml`, `strumenti/` | una prima esecuzione reale: RUN-CI.md §9 |
| **MOB-001** | installabile e utilizzabile offline | `sw.js`, `manifest.webmanifest`, `offline.html` | il passo PWA verde, e una prova su un dispositivo fisico |
| **MOB-002** | utilizzabile su schermo piccolo | `css/mobile.css`, `css/components.css` | il passo responsive verde, e una prova su un dispositivo fisico: l'emulazione non è un telefono |

`RUN-CI.md` §8 dice, per ognuno, quale output serve; `TEST-REPORT.md` §2
elenca le prove scritte e non eseguite.

## NON INIZIATO

| Ticket | Titolo | Perché |
|---|---|---|
| **CAL-003** | integrazione automatica del calendario | richiede OAuth e un servizio che custodisca i refresh token. Senza server non è realizzabile senza promettere una custodia che non esiste: CALENDAR-SYNC.md §6 |

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
