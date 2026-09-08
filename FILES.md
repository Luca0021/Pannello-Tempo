# FILES.md

**Che cos'è ogni file, e — dove serve — perché esiste.**

Build di riferimento: vedi `build.json`, campo `sorgenti`.

Conteggi: **60** moduli JavaScript, **6** fogli di stile, **12** file di
collaudo, **6** strumenti, **20** documenti. Nell'impronta della build
entrano **76** file: quelli che il browser carica davvero.

---

## 1. Radice

### Serviti al browser

| File | Che cos'è |
|---|---|
| `index.html` | il pannello. Contiene la Content Security Policy in un `<meta>`, gli attributi d'identità della build (`data-build`, `data-cache`, `data-schema`) e i 60 `<script>` **nell'ordine di `js/ORDINE.txt`** |
| `landing.html` | pagina di presentazione: che cos'è, che cosa non fa, come si comincia |
| `offline.html` | ciò che il service worker mostra quando la rete manca e la pagina non è in cache |
| `sw.js` | service worker. Cache versionata col nome della build; codice e stile **rete-prima** (il perché è in `ARCHITECTURE.md` §6) |
| `manifest.webmanifest` | manifesto PWA: nome, icone, colori, orientamento |
| `build.json` | identità della build: `sorgenti`, `cache`, `schema`, `costruito`. **Generato**, non si scrive a mano |
| `icons/` | icone dell'app in PNG e SVG, e la maskable per Android |
| `.nojekyll` | dice a GitHub Pages di non passare i file per Jekyll, che ignorerebbe le cartelle con l'underscore |

### Non serviti: sviluppo e collaudo

| File | Che cos'è |
|---|---|
| `package.json` | dipendenze **di sviluppo** e comandi. Il sito non ne carica nessuna: `ARCHITECTURE.md` §1 |
| `playwright.config.js` | due browser (chromium, firefox), riferimenti visivi, artefatti |
| `backlog.json` | **la fonte** degli stati dei ticket. `BACKLOG-COVERAGE.md` si ricalcola da qui, e la pipeline fallisce se divergono |
| `_collaudo.js` | strumenti di misura per il collaudo a mano nel browser: contrasto del testo e dei comandi, bersagli, nomi accessibili. **Escluso dall'impronta** e non caricato da `index.html`. Nei suoi commenti gli otto falsi allarmi da cui gli auditor sono nati — la parte più difficile da ricostruire |
| `.env.example` | modello delle variabili d'ambiente. Il `.env` vero non entra nel repository |
| `.gitignore` | e la nota su perché `_collaudo.js` è un'eccezione e `_pt_build.ps1` no |

---

## 2. `js/` — i 60 moduli

L'ordine di caricamento è in **`js/ORDINE.txt`**, che è la fonte:
`strumenti/controlla-impronta.mjs` verifica che `ORDINE.txt`, `index.html` e
`sw.js` contengano gli stessi moduli nello stesso ordine. Un modulo presente
in uno e assente in un altro romperebbe il pannello offline, o lo lascerebbe
bianco.

### Fondamenta

| Modulo | Che cos'è |
|---|---|
| `config.js` | costanti condivise: aree, sezioni, durate, giorni, mesi. `DAYNAMES` e `DOW` sono qui, ed è la fonte unica dei nomi dei giorni |
| `config-firebase.js` | **generato** da `strumenti/genera-config-firebase.mjs`. Nel repository resta la versione `non-configurato`. Tutti gli endpoint passano da qui, in un punto solo |
| `promessa.js` | utilità sulle promesse, per non dipendere da niente |
| `versione.js` | l'identità della build leggibile dal codice |
| `platform.js` | adattatore di piattaforma: archivio, rete, capacità. `eliminaSicuro()` **rilegge** la chiave per confermare la rimozione invece di darla per fatta |
| `utils.js` | date, formattazione, `esc()`, URL sicuri |
| `migrations.js` | catena delle migrazioni di schema. Schema **6**: `MIGRATIONS.md` |
| `backup.js` | copie di sicurezza locali, le ultime cinque |
| `lavoro.js` | avanzamento delle operazioni lunghe |
| `sicurezza.js` | validazione di ciò che entra: `LIMITI_IMPORT`, `leggiBackup`, `controllaIcs`, `testoSicuro`. **Il nome della costante è `LIMITI_IMPORT` per un motivo**: `GLOBAL-COLLISIONS.md` §2 |
| `seed.js` | la forma di un dataset vuoto |
| `state.js` | `S`, `P`, `load`, `save`, `commit`, `normalizeData`. `commit()` chiama `aggiornaVersioni()` |
| `modules.js` | quali aree del pannello sono attive |

### Dominio

| Modulo | Che cos'è |
|---|---|
| `plans.js`, `sharing.js` | piani e condivisione: predisposti, non attivi |
| `versioni.js` | versione per record. **Attenzione**: contiene una generazione precedente in gran parte senza chiamanti. Le funzioni vive sono `aggiornaVersioni`, `istantaneaRecord`, `raccogliRecord`, `segnaCancellazione`, `azzeraIstantanea`. Vedi `GLOBAL-COLLISIONS.md` §3 |
| `conflitti.js` | **la fusione viva**: `fondiPerRecord()`, `versioni()`, `segnaModifica()`, `risolviRecord()` |
| `stati.js` | stati leggibili, senza gergo |
| `routine.js` | routine distinte dai task ricorrenti (ROU-002) |
| `serie.js` | modificare una ricorrenza con tre ambiti (ROU-001) |
| `validazione.js` | `LIMITI_TASK` e la validazione di un task |
| `tasks.js` | viste derivate, area, nome accessibile. `badgeArea()` e `nomeAccessibile()` sono qui (UI-006) |
| `priorities.js` | le tre cose del giorno |
| `fascia.js`, `balance.js` | fasce orarie e bilanciamento Lavoro/Vita |
| `daily-closing.js`, `weekly-review.js` | chiusura di giornata e revisione settimanale |
| `onboarding.js` | le cinque domande d'ingresso, e i dati di esempio |
| `attivazione.js` | **la checklist di attivazione** (ONB-004): sette traguardi che si spuntano da soli. La riga qui diceva «la prima sincronizzazione: si decide, non avviene (SYN-006)», che è un altro modulo: corretto |
| `templates.js` | modelli di giornata |
| `actions.js` | azioni sui dati |
| `accumulo.js`, `arretrati.js`, `suggerimenti.js` | accumulo, arretrati, suggerimenti |
| `distruttive.js` | le tre azioni distruttive, ognuna con le proprie opzioni |
| `guida.js` | la guida in linea: quindici sezioni e undici domande rapide che portano alla funzione |
| `primo-uso.js` | UI-008: che cosa ha già visto chi sta usando il pannello. Spiegazioni di sezione una per volta, la promessa in cima, l'avviso sulle voci di partenza. Ricorda **sul dispositivo**, non nei dati |
| `tour.js` | UI-008: cinque tappe con il riflettore sulla UI vera, dopo l'ingresso portato a termine |
| `scoperta.js` | UI-008: «Scopri funzionalità». Spenta non aggiunge un solo nodo; «non ancora usata» si deduce dai dati |

### Sincronizzazione e account

| Modulo | Che cos'è |
|---|---|
| `sync-provider.js` | **il contratto**. Il dominio chiama solo `provider()` e non sa che esistano Firebase o GitHub. Tre adattatori: `LocalOnlyProvider` (predefinito), `FirebaseProvider`, `GistProvider` (deprecato, sola lettura) |
| `sync.js` | l'adattatore Firebase via REST, e la lettura Gist per la migrazione. `gistWrite()` **non esiste più** |
| `coda.js` | coda offline e stato leggibile |
| `appcheck.js` | `LIMITI_INVIO`, ritmo, attesa crescente, deduplicazione, riconoscimento dei cicli, limiti del dataset. App Check predisposto e non attivo, con tre costi dichiarati |
| `account.js` | sessione, uscita, cambio account, `auditSegreti()` su sei meccanismi di persistenza |
| `privacy.js` | i sette passi della cancellazione, e la **verifica** che sia avvenuta |
| `calendar.js`, `ics-import.js` | esportazione e importazione di file `.ics` |
| `notifiche.js` | promemoria locali |

### Interfaccia

| Modulo | Che cos'è |
|---|---|
| `rendering.js` | diffing del DOM. `sincronizzaProprieta()` allinea `checked` e `disabled` — gli **attributi** non bastano per una casella nativa |
| `render.js` | il disegno completo della pagina |
| `features/task-list-ui.js` | righe, sezioni, editor di una voce, stati vuoti |
| `features/agenda-ui.js` | l'agenda. È il modulo che posiziona i blocchi con attributi `style`, ed è il motivo del compromesso sulla CSP |
| `features/settings-ui.js` | impostazioni, account, calendario, centro privacy |
| `features/priorita-ui.js` | il riquadro delle priorità |
| `features/riprogrammare-ui.js` | «Da riprogrammare» |
| `features/modals-ui.js` | onboarding, chiusura, revisione |
| `features/conflitti-ui.js` | la scelta record per record |
| `accessibility.js` | annunci per i lettori di schermo. **Una** sola regione viva, e sta fuori da `#app` |
| `navigazione.js` | le quattro viste |
| `drag.js` | trascinamento nell'agenda |
| `events.js` | un solo ascoltatore, tutto passa da `data-act` |
| `boot.js` | avvio, e il rifiuto di girare dentro una cornice |
| `pwa-boot.js` | registrazione del service worker e aggiornamento **deciso dall'utente** |

---

## 3. `css/` — sei fogli, in quest'ordine

| Foglio | Che cos'è |
|---|---|
| `tokens.css` | **la fonte** di colori e misure. Temi chiaro, scuro e auto. Ogni valore corretto per contrasto porta accanto il motivo e il numero |
| `base.css` | tipografia, contenitore, icone |
| `components.css` | schede, righe, campi, pulsanti, badge d'area, agenda |
| `mobile.css` | `max-width` 640 e 430: campi a riga intera, giorni della settimana a riga intera |
| `desktop.css` | due colonne dove c'è spazio |
| `accessibility.css` | fuoco visibile, `forced-colors`, `prefers-reduced-motion`, varianti dei chip |

L'ordine conta: `tokens` definisce, gli altri usano, `accessibility` ha
l'ultima parola.

---

## 4. `tests/` — dodici file

Nessuno è mai stato eseguito in questo ambiente: non c'è Node.
`TEST-REPORT.md` distingue eseguito, scritto-e-non-eseguito, e non scritto.

| File | Prove | Richiede |
|---|---|---|
| `runner.js` | — | esegue `unit/` e `integration/` |
| `avvio.test.js` | 60 | Node. Carica i 60 moduli in un DOM finto: un `ReferenceError` lascerebbe la pagina bianca, e questo lo scopre in mezzo secondo |
| `unit/migrazioni.test.js` | 15 | Node |
| `unit/limiti-e-versioni.test.js` | 13 | Node. Le collisioni fra globali, i limiti di importazione, e che le modifiche risultino da sincronizzare |
| `integration/gist-migrazione.test.js` | 20 | Node |
| `security/regole.test.js` | 14 | Node + Java + emulatore Firestore |
| `security/sentinelle.test.js` | 11 | Node + Playwright |
| `ui/ui006.spec.js` | 60 + regressione visiva | Node + Playwright |
| `ui/terminologia.spec.js` | 8 | Node + Playwright |
| `e2e/cancellazione.spec.js` | 10 | Node + Playwright |
| `e2e/piattaforma.spec.js` | 17 | Node + Playwright |
| `a11y/accessibilita.spec.js` | 14 + 6 | Node + Playwright + axe-core. Le sei aggiunte misurano ciò che axe non misura, e hanno trovato difetti veri |

---

## 5. `strumenti/` — sei strumenti

| Strumento | Che cosa fa | Fallisce se |
|---|---|---|
| `build.mjs` | **il build canonico**: impronta SHA-256 sui file serviti, e la stampiglia nei quattro punti | due calcoli danno impronte diverse |
| `controlla-impronta.mjs` | `build.json`, `js/versione.js`, `sw.js`, `index.html` coincidono; e i moduli sono allineati fra `ORDINE.txt`, `index.html` e `sw.js` | divergono |
| `controlla-globali.mjs` | cerca i nomi dichiarati da più di un modulo | ne trova uno. `GLOBAL-COLLISIONS.md` |
| `controlla-segreti.mjs` | cerca chiavi, token e credenziali nell'albero | ne trova uno |
| `genera-config-firebase.mjs` | scrive `js/config-firebase.js` dalle variabili d'ambiente | l'ambiente chiesto è `produzione` durante un collaudo |
| `backlog.mjs` | ricalcola i totali da `backlog.json` e li confronta col documento | non coincidono, o un ticket chiuso si appoggia a una verifica dichiarata non eseguita |

---

## 6. `firebase/`

| File | Che cos'è |
|---|---|
| `firestore.rules` | **la sola fonte** delle regole. Dieci percorsi, UID nel percorso, `backups` e `tombstones` non riscrivibili, clausola di chiusura che nega tutto il resto |
| `firebase.json` | configurazione degli emulatori |
| `firestore.indexes.json` | indici |

Non contiene **nessuna** configurazione di un progetto reale: `BUILD.md` §6.

---

## 7. `.github/workflows/`

| File | Che cos'è |
|---|---|
| `verifica.yml` | tre lavori — *build*, *browser* (chromium e firefox), *riepilogo* — 34 passi, `workflow_dispatch` con la scelta dell'ambiente. `RUN-CI.md` |

---

## 8. I venti documenti

| Documento | Risponde a |
|---|---|
| `ARCHITECTURE.md` | com'è fatto, e che cosa costa |
| `FILES.md` | questo |
| `BUILD.md` | come si costruisce, e perché l'impronta è deterministica |
| `MIGRATIONS.md` | come cambia lo schema senza perdere dati |
| `SYNC-DECISION.md` | perché la modalità locale è il predefinito e Firebase l'unico fornitore |
| `FIREBASE-SETUP.md` | come si configura il progetto, per chi pubblica |
| `GIST-MIGRATION.md` | come si porta via ciò che è su Gist |
| `CALENDAR-SYNC.md` | perché il calendario è esportazione e non integrazione |
| `E2EE-DECISION.md` | perché non c'è cifratura end-to-end |
| `PRIVACY.md` | che cosa è protetto e che cosa **non** lo è |
| `SECURITY-REPORT.md` | che cosa è stato verificato eseguendolo |
| `ACCESSIBILITY-REPORT.md` | i numeri, per condizione, e gli otto falsi allarmi |
| `GLOBAL-COLLISIONS.md` | le due collisioni che hanno prodotto difetti reali |
| `UI-BEFORE-AFTER.md` | l'indicatore Lavoro/Vita, prima e dopo |
| `UI-LAYOUT-REPORT.md` | l'impaginazione misurata su 26 condizioni: i cinque difetti veri, i due allarmi che erano miei (UI-007) |
| `UX-PRIMO-ACCESSO.md` | che cosa vede chi apre il pannello la prima volta, misurato; il tour, le spiegazioni, la scoperta e le domande rapide (UI-008) |
| `TEST-REPORT.md` | eseguito, scritto-non-eseguito, non scritto |
| `DEPLOYMENT-REPORT.md` | come si pubblica, e come si torna indietro |
| `RUN-CI.md` | come si avvia la pipeline e che cosa restituire |
| `CHANGELOG.md` | che cosa è cambiato, e che cosa era rotto |
| `BACKLOG-COVERAGE.md` | **generato** da `backlog.json` |
| `README.md` | *assente*: `landing.html` fa quel lavoro per chi arriva dal sito |

---

## 9. Che cosa NON c'è

| | Perché |
|---|---|
| `node_modules/` | nessuna dipendenza a runtime; quelle di sviluppo si installano al bisogno |
| un `dist/` o `build/` | il sorgente **è** l'artefatto: nessuna trasformazione |
| `.env` | mai nel repository. Il modello è `.env.example` |
| `_pt_build.ps1` | strumento di lavoro locale. Duplica la logica del build in un secondo linguaggio, e quella duplicazione è già costata un difetto (`BUILD.md` §2): versionarlo inviterebbe a mantenerlo |
| una configurazione Firebase reale | `BUILD.md` §6 |
| `README.md` | vedi sopra |
