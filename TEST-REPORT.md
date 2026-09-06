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
| `tests/unit/` | **PASSATO** (exit 0) | **39/39** — migrazioni 15, limiti e versioni 14, messaggi d'errore 10 |
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
| Esito | **PASSATO** (exit 0), **14/14**, in **quattro esecuzioni consecutive pulite** |
| Progetto | `demo-pannello` — finto, riconosciuto come demo dall'emulatore. Nessun contatto con un progetto reale, nessuna fatturazione |

**Totale asserzioni eseguite e verdi: 256.**

### Verifiche contro il progetto Firebase REALE

Eseguite con la configurazione pubblica della Web App, tenuta in un `.env`
locale **escluso da git** (verificato con `git check-ignore`: il file non
compare nemmeno in `git status --untracked-files=all`). Piano Firebase
invariato, **Blaze non attivato**, nessuna impostazione della console
modificata: solo chiamate al piano dati.

Utenti di prova con indirizzi su `example.com` — dominio riservato IANA alla
documentazione, non di nessuna persona reale — e dati sintetici. Tutti gli
account creati sono stati cancellati, con la controprova.

| # | Controllo | Esito | Che cosa si è visto |
|---|---|---|---|
| RETE-01 | endpoint raggiungibile | **PASSATO** | risposta HTTP reale |
| AUTH-01/02 | registrazione di due utenti | **PASSATO** | HTTP 200, due UID distinti |
| AUTH-03 | accesso con la password giusta | **PASSATO** | HTTP 200, stesso UID della registrazione |
| AUTH-04 | accesso con la password **sbagliata** | **PASSATO** | rifiutato: il servizio verifica davvero |
| FS-01 | il proprietario scrive il proprio documento | **FALLITO** | `HTTP 403 PERMISSION_DENIED` |
| PUL-01/02 | cancellazione degli account di prova | **PASSATO** | HTTP 200, e l'accesso successivo è rifiutato |

**Authentication sul progetto reale funziona.** Registrazione, accesso,
rifiuto della password errata e cancellazione dell'account sono stati
eseguiti e verificati, non dedotti.

**Firestore nega tutto.** FS-01 non è un difetto del pannello, ed è stato
accertato invece di essere supposto: una seconda sonda ha provato otto
operazioni, autenticate e non.

| Operazione | Le regole del repository | Il progetto reale |
|---|---|---|
| scrittura **minima** (solo `payload`) del proprietario | permessa | **negata** |
| lettura del proprio `datasets/current` | permessa | **negata** |
| lettura del proprio `profile/main` | permessa | **negata** |
| lettura del proprio percorso precedente | permessa | **negata** |
| lettura senza autenticazione | negata | negata |
| elenco della collezione `users`, autenticato e non | negato | negato |
| scrittura in una collezione non prevista | negata | negata |

**0 operazioni permesse su 8. 4 che il repository concede al proprietario
sono negate. 0 che dovrebbero essere negate risultano permesse.**

La scrittura minima è il discriminante, e per questo è stata provata: sotto
le regole del repository è permessa — ogni funzione di validazione è
protetta da `!('campo' in request.resource.data)` — quindi il suo rifiuto
esclude che si tratti di una validazione violata dal pannello. Sul progetto
ci sono le regole predefinite **«production mode»**, che negano tutto.

Due conseguenze, di segno opposto, e vanno dette entrambe:

- **nessun dato è esposto.** Non c'è nulla di aperto, nemmeno per errore.
- **la sincronizzazione non funziona per nessun utente.** L'accesso riesce,
  il salvataggio viene rifiutato. È lo stato peggiore da diagnosticare: la
  parte visibile funziona.

Si sblocca pubblicando le regole — `firebase deploy --only firestore:rules` —
che richiede un accesso autenticato alla console e **non è stato eseguito**:
modificherebbe lo stato remoto del progetto. È il ticket **SEC-010**.

---

## 2. I tredici difetti trovati eseguendo

Nessuno di questi si vede leggendo il codice.

I primi nove sono emersi rendendo eseguibili i collaudi; gli ultimi quattro
verificando il progetto Firebase reale, e tre di loro **solo** perché il
progetto nega le scritture: quel rifiuto è la condizione in cui il pannello
si trova oggi, quindi il messaggio che mostra in quel momento è il messaggio
che l'utente legge davvero.

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
| 10 | **13 campi su 33 dei messaggi d'errore contenevano gergo vietato** dall'interfaccia consumer: nomi di servizi, «apiKey», «chiave API», e istruzioni per una console che l'utente non possiede | `js/sync.js` (`ERRORI_FB`, `dettaglioErrore`) | la nuova prova statica; la guardia esistente non li aveva mai letti |
| 11 | **Il consiglio per il rifiuto delle scritture indicava il percorso sbagliato**: `pannello/{uid}`, che è il percorso delle versioni precedenti e in sola lettura. Seguirlo non ripristinava niente | `js/sync.js` | lettura del messaggio che il progetto reale fa comparire |
| 12 | **`fbWrite` buttava via il corpo della risposta**, quindi la voce specifica della tabella non poteva mai corrispondere su una scrittura e usciva il messaggio generico, che parlava dei permessi di un altro servizio | `js/sync.js` | `HTTP 403` senza motivo, contro un rifiuto reale |
| 13 | **Il controllo dei segreti non chiedeva niente a git**: annunciava «albero versionato» camminando sul filesystem, e falliva su un `.env` ignorato — cioè su una configurazione corretta, fatta seguendo `.env.example` | `strumenti/controlla-segreti.mjs` | primo `npm run segreti` dopo aver creato `.env` |

Il numero 13 aveva un secondo danno, peggiore del primo: il consiglio che
stampava — «vanno revocati sul servizio che li ha emessi, e poi rimossi
dalla cronologia» — è **falso** per un file mai committato, e avrebbe portato
qualcuno a revocare una chiave senza motivo e a cercare a lungo nella
cronologia qualcosa che non c'era. La via d'uscita più comoda, poi, era
aggiungere `.env` alle eccezioni o mettere `|| true` sul comando: un
controllo che grida al lupo viene disattivato, e allora non protegge più
niente. Ora l'insieme dei file lo dichiara `git ls-files --cached --others
--exclude-standard`, cioè ciò che è versionato più ciò che entrerebbe al
prossimo commit; i file ignorati vengono comunque letti e riportati a parte,
senza far fallire nulla. Verificato in **entrambe** le direzioni: passa con
`.env` presente, e continua a fallire su un file non ignorato che contiene
una chiave finta.

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
| **Authentication** su progetto reale | **PASSATO** | non più bloccato: la configurazione è arrivata. Registrazione, accesso, rifiuto della password errata e cancellazione dell'account eseguiti sul progetto vero. Vedi §1 |
| **Firestore** su progetto reale | **FALLITO**, per una causa remota | il progetto nega ogni operazione: ha le regole predefinite, non quelle del repository. Accertato con 8 sonde, non supposto. SEC-010 |
| **Isolamento fra utenti** su progetto reale | **NON VERIFICABILE** allo stato attuale | non si può distinguere l'isolamento da un rifiuto generalizzato: se è negato tutto, anche l'accesso di un estraneo è negato, ma questo non dimostra che le regole del repository funzionino. Verificato sull'emulatore: §1. Si sblocca con SEC-010 |
| **Cancellazione remota del documento** | **NON VERIFICABILE** allo stato attuale | il documento non si può nemmeno creare. La cancellazione dell'**account**, invece, è stata vista avvenire sul servizio reale: §1 |
| **App Check** | **NON ATTIVO**, e ora è misurato | `appCheckSiteKey` è vuota perché nessuna Site Key è stata fornita, e il servizio ha accettato registrazione e accesso via REST **senza alcun token di App Check**: l'enforcement non è applicato. Non è una deduzione dal codice, è la risposta del servizio |
| **Regole pubblicate sul progetto** | **NON ESEGUITO**, di proposito | `firebase deploy --only firestore:rules` modifica lo stato remoto del progetto e richiede un accesso autenticato alla console: non è un'operazione da eseguire senza che il proprietario la decida |
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

1. **La sincronizzazione non funziona sul progetto reale, e l'accesso sì.**
   Non è più un rischio: è uno stato accertato. Le regole pubblicate negano
   ogni scrittura, quindi un utente si registra, entra, e poi non riesce a
   salvare. Finché SEC-010 non è chiuso, la funzione «account» è visibile e
   inutilizzabile. È il primo rischio perché è l'unico già in atto.
2. **Le regole del repository non sono mai state in vigore da nessuna
   parte tranne l'emulatore.** L'emulatore legge lo stesso file, ma non è lo
   stesso servizio: ora sappiamo — non supponiamo — che il progetto ne ha
   altre. Il corollario scomodo è che l'isolamento fra utenti, che era il
   rischio numero uno delle consegne precedenti, in produzione non è
   verificato con QUESTE regole. Oggi nessuno legge i dati di nessuno perché
   nessuno legge niente.
3. **La cancellazione del documento remoto non è stata vista avvenire.** Il
   passo esiste e con risposte finte funziona; sul servizio reale il
   documento non si può nemmeno creare. La cancellazione dell'account,
   invece, è stata verificata sul servizio vero.
4. **App Check non è attivo, e ora è misurato**: il servizio ha accettato
   registrazione e accesso via REST senza alcun token. La quota è esposta
   all'uso automatizzato. Nota di sequenza: conviene attivarlo **dopo** aver
   pubblicato le regole, altrimenti si sommano due cause di rifiuto e
   diventa difficile capire quale delle due stia agendo.
5. **`style-src` ammette `'unsafe-inline'`** per gli attributi `style`.
6. **Clickjacking coperto solo da JavaScript**: `frame-ancestors` non ha
   effetto in un `<meta>`.
7. **Nessun backup del database.**
8. **La regressione visiva non ha riferimenti approvati**, e su questa
   macchina non arriva in fondo.
9. **Una sola gamba di browser.** Firefox non è stato provato.
10. **Nessuna prova su lettore di schermo reale né su dispositivo fisico.**
