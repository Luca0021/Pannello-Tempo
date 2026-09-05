# TEST-REPORT.md

**Che cosa è stato eseguito davvero, che cosa no, e con quale esito.**

Le categorie sono tenute separate di proposito. Un rapporto che le mescola
trasforma «abbiamo un collaudo» in «funziona», e sono due affermazioni
diverse.

| | |
|---|---|
| Build | vedi `build.json`, campo `sorgenti` |
| Schema | 6 |
| Node | 20.20.2 (installato per questa sessione, integrità SHA-256 verificata contro `SHASUMS256.txt` ufficiale) |
| npm | 10.8.2 · 714 pacchetti di sviluppo |
| Java | Temurin JRE 11.0.32.1, per l'emulatore Firestore |
| Browser | **Edge 152.0.4191.62 di sistema**, tramite `PT_CANALE=msedge` |

> **Il risultato più importante di questa tornata è che i collaudi sono
> stati eseguiti.** Nelle consegne precedenti erano dichiarati
> «predisposti»: non lo erano. `package.json` conteneva `"type": "module"`,
> che rende modulo ES ogni file `.js`, e tutti i collaudi usano `require()`.
> Nessuno di loro poteva partire — `node tests/runner.js` moriva alla prima
> riga. Le «242 asserzioni predisposte» erano 242 asserzioni **non
> eseguibili**, e la dichiarazione non poteva accorgersene proprio perché
> nessuno le aveva lanciate.

---

## 1. Eseguito, con esito

Ogni riga riporta il codice di uscita. Un comando con codice diverso da zero
non è passato.

### Controlli statici

| Strumento | Esito | Numeri |
|---|---|---|
| `strumenti/controlla-segreti.mjs` | **PASSATO** (exit 0) | 11 modelli, 123 file, 0 segnalazioni, 2 esenzioni con motivo |
| `strumenti/controlla-globali.mjs` | **PASSATO** (exit 0) | 60 moduli, 590 nomi globali, **0 collisioni** |
| `strumenti/controlla-impronta.mjs` | **PASSATO** (exit 0) | identità coerente nei quattro punti; 60 moduli js e 6 css allineati fra `ORDINE.txt`, `index.html` e `sw.js` |
| `strumenti/backlog.mjs` | **PASSATO** (exit 0) | 41 ticket, conteggi ricalcolati e coincidenti |

### Collaudi Node

| Suite | Esito | Asserzioni |
|---|---|---|
| `tests/unit/` | **PASSATO** (exit 0) | **29/29** — migrazioni 15, limiti e versioni 14 |
| `tests/integration/` | **PASSATO** (exit 0) | **19/19** — recupero da Gist con risposte finte |
| `tests/avvio.test.js` | **PASSATO** (exit 0) | **114/114** — i 60 moduli caricati in un DOM finto |

### Collaudi in browser (Playwright, Edge 152)

| Suite | Esito | Asserzioni |
|---|---|---|
| `tests/ui/terminologia.spec.js` | **PASSATO** (exit 0) | **8/8** |
| `tests/a11y/accessibilita.spec.js` | **PASSATO** (exit 0) | **22/22** — axe-core su 7 schermate, più contrasto del testo, contrasto dei comandi e dimensione dei bersagli |
| `tests/e2e/` + `tests/security/sentinelle.test.js` | **PASSATO** (exit 0) | **40/40** — CSP, PWA, service worker, offline, responsive, cancellazione, sentinelle dei segreti |
| `tests/ui/ui006.spec.js` | **PARZIALE** | **5 prove su 61**: vedi §3 |

### Regole Firestore sull'emulatore

| | |
|---|---|
| Comando | `firebase emulators:exec --only firestore,auth --project demo-pannello "node ../tests/security/regole.test.js"` |
| Esito | **PASSATO** (exit 0), **14/14**, in **tre esecuzioni consecutive pulite** |
| Progetto | `demo-pannello` — finto, riconosciuto come demo dall'emulatore. Nessun contatto con un progetto reale, nessuna fatturazione |

**Totale asserzioni eseguite e verdi: 246.**

---

## 2. I nove difetti trovati eseguendo

Nessuno di questi si vede leggendo il codice.

| # | Difetto | Dove | Come è emerso |
|---|---|---|---|
| 1 | **Nessun collaudo poteva partire**: `"type": "module"` contro `require()` | `package.json` | primo `node tests/runner.js` |
| 2 | **Le regole Firestore rifiutavano le scritture del proprietario** a intermittenza: `aggiornatoIl <= request.time` senza tolleranza per lo scarto fra orologi | `firebase/firestore.rules` | tre esecuzioni sull'emulatore con esiti diversi |
| 3 | **A versione corrente girava solo l'ultima migrazione**, quindi i campi introdotti dai passi precedenti restavano assenti | `js/migrations.js` | `tests/unit/migrazioni.test.js` |
| 4 | **«Adesso» a 4,38:1**, sotto il minimo | `css/tokens.css` (`--brass-testo`) | collaudo di accessibilità |
| 5 | **Il pulsante di selezione a 1,39:1**: un comando che non si vedeva | `css/components.css` (`.scegli`) | collaudo di accessibilità |
| 6 | **A 320px l'intestazione sforava di 14px** e la pagina prendeva una barra di scorrimento orizzontale | `css/components.css` (`h2`) | collaudo responsive |
| 7 | Il banco di prova caricava `js/boot.js`, che pretende un DOM completo | `tests/unit/limiti-e-versioni.test.js` | 4 prove rosse |
| 8 | `apriTutto()` non apriva davvero le schede, e accusava il prodotto di non contenere testi che c'erano | `tests/ui/terminologia.spec.js` | 1 prova rossa |
| 9 | `page.addStyleTag()` **bloccato dalla CSP** | `tests/a11y/accessibilita.spec.js` | 3 prove rosse |

Il numero 2 merita una riga in più, perché in produzione sarebbe stato
diagnosticato come «a volte la sincronizzazione non funziona»: il timestamp
lo scrive il client con il proprio orologio, e bastava che fosse avanti di
pochi millisecondi perché il servizio rifiutasse la scrittura. Un utente con
l'orologio avanti di qualche secondo — cosa comune — non avrebbe **mai**
potuto sincronizzare.

Il numero 9 è una buona notizia travestita da fallimento: dimostra che
`style-src-elem 'self'` è davvero applicato.

---

## 3. Eseguito solo in parte

### `tests/ui/ui006.spec.js` — 5 prove su 61

La suite non arriva in fondo su questa macchina: **5 prove in 13 minuti**,
le altre 56 non eseguite. Ogni prova ricarica la pagina, ricostruisce i
dati e cattura uno scatto, e con il canale Edge di sistema il costo è di
circa due minuti e mezzo l'una.

Delle 5 eseguite, le **asserzioni strutturali sono passate** — girano prima
dello scatto, quindi un fallimento sullo scatto non le nasconde. Le stesse
proprietà (casella nativa, badge punto + parola, nome accessibile che
comincia dall'area) sono verificate anche da `terminologia.spec.js` e
`accessibilita.spec.js`, entrambe verdi.

### Regressione visiva: 14 riferimenti generati, **nessuno approvato**

Playwright ha creato 14 scatti in `tests/ui/ui006.spec.js-snapshots/` e ha
fallito le prove corrispondenti. **È il comportamento previsto**: uno scatto
appena generato non dimostra che l'aspetto sia giusto, dimostra com'era in
quel momento.

Gli scatti **non sono stati approvati** e non sono stati committati. TST-006
resta PARZIALE.

---

## 4. Bloccato, con la ragione

| Verifica | Stato | Perché |
|---|---|---|
| Seconda gamba su **Firefox** | **BLOCCATO** | su questa rete `npx playwright install` fallisce con «Download failure» per **tutti** i browser e perfino per ffmpeg (1 MB), mentre gli stessi CDN servono byte a una richiesta diretta. Aggirato per Chromium usando Edge 152 di sistema; per Firefox non esiste un'installazione di sistema |
| **Authentication** su progetto reale | **BLOCCATO** | i quattro valori pubblici della configurazione non sono su questa macchina: `js/config-firebase.js` è `non-configurato` con tutti i campi vuoti, non esiste `.env`, non esistono variabili `PT_*` |
| **Firestore** su progetto reale | **BLOCCATO** | idem |
| **Isolamento fra utenti** su progetto reale | **BLOCCATO** | idem. Verificato sull'emulatore: §1 |
| **Cancellazione remota** su servizio reale | **BLOCCATO** | idem. Verificata con risposte finte: 10/10 |
| **App Check** | **NON APPLICABILE** allo stato attuale | `appCheckSiteKey` è vuota. Una Site Key presente non significherebbe comunque App Check attivo, e App Check inizializzato non significa enforcement applicato |
| **GitHub Actions** | **NON ESEGUITO** | la pipeline non è mai stata avviata. YAML valido non significa pipeline eseguita |
| **Lettore di schermo reale** | **NON ESEGUITO** | non automatizzabile; axe trova circa un terzo dei problemi |
| **Dispositivo fisico** | **NON ESEGUITO** | l'emulazione di viewport non è un telefono |

---

## 5. Come riprodurre

```bash
npm install
npm run verifica          # segreti, globali, build, coerenza, backlog, unit, integration, avvio
```

In browser, dove i browser di Playwright si scaricano:

```bash
npx playwright install chromium firefox
npx playwright test
```

Dove **non** si scaricano, con un browser di sistema:

```bash
PT_CANALE=msedge npx playwright test --project=chromium
```

`PT_CANALE` spegne anche la cattura video, che richiede ffmpeg dallo stesso
CDN bloccato. In CI la variabile non è impostata e non cambia nulla.

Regole Firestore, con Java disponibile:

```bash
cd firebase
npx firebase emulators:exec --only firestore,auth --project demo-pannello \
  "node ../tests/security/regole.test.js"
```

> Su Windows l'emulatore Firestore **non parte con Java 21**: fallisce con
> `java.net.SocketException: Invalid argument: connect` sulla pipe interna
> basata su socket Unix. Con **Java 11** parte. In CI (`ubuntu-latest`) il
> problema non si presenta.

---

## 6. Rischi residui

In ordine di gravità.

1. **Il percorso account non è mai stato eseguito contro Firebase.**
   Registrazione, accesso, prima sincronizzazione, conflitto, disconnessione:
   tutto scritto, niente provato contro il servizio reale.
2. **La cancellazione remota non è stata vista avvenire.** Il passo di
   verifica esiste e con risposte finte funziona.
3. **Le regole sono verificate sull'emulatore, non sul progetto reale.**
   L'emulatore usa lo stesso file, ma non è lo stesso servizio, e le regole
   pubblicate sul progetto potrebbero essere diverse da quelle nel
   repository finché qualcuno non le pubblica.
4. **App Check non è attivo**: la quota è esposta all'uso automatizzato.
5. **`style-src` ammette `'unsafe-inline'`** per gli attributi `style`.
6. **Clickjacking coperto solo da JavaScript**: `frame-ancestors` non ha
   effetto in un `<meta>`.
7. **Nessun backup del database.**
8. **La regressione visiva non ha riferimenti approvati**, e su questa
   macchina non arriva in fondo.
9. **Una sola gamba di browser.** Firefox non è stato provato.
10. **Nessuna prova su lettore di schermo reale né su dispositivo fisico.**
