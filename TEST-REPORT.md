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

Il lavoro si è svolto in due tempi: **prima** della pubblicazione delle
regole e **dopo**, perché il proprietario le ha pubblicate a mano dalla
console fra le due tornate. Le due misure insieme valgono più di ognuna da
sola: mostrano che cosa cambia pubblicandole.

#### Prima della pubblicazione

| # | Controllo | Esito |
|---|---|---|
| RETE-01 | endpoint raggiungibile | **PASSATO** |
| AUTH-01/02 | registrazione di due utenti | **PASSATO** |
| AUTH-03/04 | accesso con la password giusta, e rifiuto di quella sbagliata | **PASSATO** |
| FS-01 | il proprietario scrive il proprio documento | **FALLITO**, `403 PERMISSION_DENIED` |
| PUL-01/02 | cancellazione degli account di prova | **PASSATO** |

Otto sonde, autenticate e non: **0 operazioni permesse su 8**, comprese le
4 che le regole del repository concedono al proprietario, e **0** che
dovrebbero essere negate risultavano permesse. Il progetto aveva le regole
predefinite «production mode». Nessuna esposizione, e sincronizzazione
impossibile per chiunque.

#### Dopo la pubblicazione

Le stesse sonde, più l'isolamento fra due utenti e la cancellazione, che
prima non erano eseguibili perché il documento non si poteva creare.
**12 controlli su 13 passati.**

| # | Controllo | Esito | Che cosa si è visto |
|---|---|---|---|
| OWN-01 | A scrive il proprio documento | **PASSATO** | HTTP 200 |
| OWN-02 | A lo rilegge | **PASSATO** | HTTP 200, payload identico: andata e ritorno completo |
| ISO-01 | B legge il documento di A | **PASSATO** | `403 PERMISSION_DENIED` |
| ISO-02 | B scrive nel documento di A | **PASSATO** | `403 PERMISSION_DENIED` |
| ISO-03 | lettura **senza autenticazione** | **PASSATO** | `403 PERMISSION_DENIED` |
| ISO-04 | A legge il contenitore `users/{A}` | **PASSATO** | `403`: `allow read: if false` è in vigore |
| REG-01 | A scrive in una collezione non prevista | **PASSATO** | `403`: la clausola di chiusura c'è |
| REG-02 | A scrive schema 5 su un documento a schema 6 | **PASSATO** | `403`: lo schema non regredisce |
| REG-03 | A scrive con `aggiornatoIl` avanti di 2 minuti | **FALLITO** | `403`: **la tolleranza non è pubblicata** |
| DEL-01 | A cancella il proprio documento | **PASSATO** | 200 prima, DELETE 200, **404 dopo** |
| DEL-02 | A cancella il percorso delle versioni precedenti | **PASSATO** | HTTP 200 |
| PUL-01/02 | cancellazione dei due account | **PASSATO** | 200, e l'accesso successivo è rifiutato |

**L'isolamento fra utenti è verificato sul progetto reale**, non più solo
sull'emulatore: sei rifiuti su sei. **La cancellazione remota è stata vista
avvenire**: il documento risponde 200, poi 404. È ciò che mancava a PRV-002,
che passa a COMPLETATO.

#### La prima pubblicazione era precedente di una riga

Il confronto riga per riga fra il testo pubblicato e
`firebase/firestore.rules` diede **una sola differenza su 96 righe**:

```
pubblicato:   aggiornatoIl <= request.time
repository:   aggiornatoIl <= request.time + duration.value(5, 'm')
```

Cioè il difetto corretto in `7bba236`, ancora in vigore. La copia proveniva
da `Downloads\pannello-tempo-collaudo`, un duplicato della cartella **senza
`.git`** e fermo a prima della correzione.

Dimostrato dal vivo: l'orologio della macchina era avanti di **998 ms** su
quello del servizio (header `Date` della risposta), e con quel solo secondo
`aggiornatoIl` = adesso veniva **negato**. Passato permesso, adesso negato,
+2 minuti negato: nessuna tolleranza.

#### Dopo la seconda pubblicazione: 20 controlli su 20

Il proprietario ha ripubblicato copiando l'intero file dal repository
versionato. Rieseguite le prove sul progetto remoto — solo API REST con un
idToken di utente normale, **nessun Admin SDK, nessun service account,
nessun bypass delle regole**, quindi le Security Rules erano in vigore su
ogni chiamata:

| # | Prova | Atteso | Esito |
|---|---|---|---|
| 01 | `aggiornatoIl` 2 minuti nel passato | permesso | **PASSATO** |
| 02 | `aggiornatoIl` **all'istante corrente del client** | permesso | **PASSATO** |
| 03 | `aggiornatoIl` 2 minuti nel futuro | permesso, entro i 5 minuti | **PASSATO** |
| 04 | `aggiornatoIl` 10 minuti nel futuro | negato | **PASSATO** |
| 05 | creazione del documento del proprietario | permesso | **PASSATO** |
| 06 | lettura del documento del proprietario | permesso | **PASSATO** |
| 07 | aggiornamento del documento del proprietario | permesso | **PASSATO** |
| 08 | cancellazione del documento del proprietario | permesso | **PASSATO** |
| 09 | lettura da parte dell'altro utente | negato | **PASSATO** |
| 10 | scrittura da parte dell'altro utente | negato | **PASSATO** |
| 11 | aggiornamento da parte dell'altro utente | negato | **PASSATO** |
| 12 | cancellazione da parte dell'altro utente | negato | **PASSATO** |
| 13 | accesso non autenticato | negato | **PASSATO** |
| 14 | accesso a un percorso non previsto | negato | **PASSATO** |

Più sei controprove, tutte passate: scrittura anonima negata, lettura di un
percorso non previsto negata, contenitore `users/{uid}` negato, il documento
del proprietario **intatto** dopo i quattro tentativi dell'altro utente, e i
due account sintetici rimossi con verifica che l'accesso successivo non
funzioni. **20 su 20, exit 0.**

Due dettagli di metodo che rendono le prove 05/07 e 10/11 distinte invece di
ripetute: in REST creazione e aggiornamento sono la stessa `PATCH`, e cambia
solo se il documento esiste. La creazione è stata quindi fatta su un
documento inesistente e l'aggiornamento su uno esistente; per l'altro utente,
la «scrittura» su un percorso nuovo nello spazio del proprietario e
l'«aggiornamento» sul documento che c'era già.

La prova **02** è quella che conta: è la scrittura che il pannello fa
davvero, ed è quella che falliva prima. Ora passa, e la **04** continua a
essere negata — la tolleranza non ha allargato il controllo, l'ha reso
sopportabile da un orologio reale. Ticket **SEC-010: COMPLETATO**.

> **Nota di metodo, e un errore da non ripetere.** La prima lettura delle
> sonde dopo la pubblicazione sembrava dire «stato misto»: due letture del
> proprietario risultavano negate. Erano **404 NOT_FOUND**, su documenti mai
> creati. Su una lettura, `404` è la prova che **il permesso è stato
> concesso** e il documento non c'è; il diniego è `403`. Il classificatore
> della sonda usava `response.ok`, che tratta 404 come fallimento, e così
> accusava le regole appena pubblicate di un difetto che non hanno. Prima
> della pubblicazione quelle stesse due letture rispondevano `403`: è
> proprio il passaggio da 403 a 404 il segno che le regole sono cambiate.

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
| **Firestore** su progetto reale | **PASSATO** | creazione, lettura, aggiornamento e cancellazione del proprietario, compresa la scrittura con `aggiornatoIl` = adesso, che è quella del pannello |
| **Isolamento fra utenti** su progetto reale | **PASSATO** | non più solo sull'emulatore: lettura, creazione, aggiornamento e cancellazione da parte di un secondo utente tutte negate, più accesso anonimo, contenitore e percorso non previsto. Con la controprova che il documento resta intatto |
| **Cancellazione remota del documento** | **PASSATO** | vista avvenire: 200, DELETE 200, poi 404. Più il percorso delle versioni precedenti. PRV-002 chiuso |
| **App Check** | **NON ATTIVO**, e ora è misurato | `appCheckSiteKey` è vuota perché nessuna Site Key è stata fornita, e il servizio ha accettato registrazione e accesso via REST **senza alcun token di App Check**: l'enforcement non è applicato. Non è una deduzione dal codice, è la risposta del servizio |
| **Regole pubblicate sul progetto** | **PASSATO** | pubblicate a mano dalla console dal proprietario, in due tornate: la prima era precedente di una riga, la seconda è il file corretto. Verificate interrogando il servizio, 20 controlli su 20. Il deploy da riga di comando non è stato eseguito — `firebase login:list` non riporta alcun account autorizzato, e l'accesso è una credenziale che solo il proprietario può fornire |
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

1. **Un file versionato corretto non dimostra un servizio corretto**, e
   nulla qui dentro tiene allineate le due cose. È il rischio che resta ora
   che SEC-010 è chiuso, e non è teorico: la prima pubblicazione differiva di
   una riga e nessun collaudo di questo repository poteva accorgersene —
   l'emulatore era verde, 14 prove su 14, mentre il progetto applicava un
   altro testo. La divergenza è stata trovata solo interrogando il servizio,
   e può ripresentarsi alla prossima modifica delle regole. Nel flusso di
   lavoro non esiste né un passo che le pubblichi né uno che confronti il
   testo pubblicato con `firebase/firestore.rules`.
2. **Due cartelle con lo stesso file e contenuto diverso.**
   `Downloads\pannello-tempo-collaudo` è un duplicato senza `.git`, fermo a
   prima delle correzioni, ed è da lì che è arrivata la prima pubblicazione
   sbagliata. Finché esiste, è una trappola aperta: chi copia un file da
   quella cartella pubblica una versione vecchia senza alcun segnale.
3. **App Check non è attivo, e ora è misurato**: il servizio ha accettato
   registrazione e accesso via REST senza alcun token. La quota è esposta
   all'uso automatizzato. Nota di sequenza: conviene attivarlo **dopo** aver
   sistemato SEC-010, altrimenti si sommano due cause di rifiuto e diventa
   difficile capire quale delle due stia agendo.
4. **`style-src` ammette `'unsafe-inline'`** per gli attributi `style`.
5. **Clickjacking coperto solo da JavaScript**: `frame-ancestors` non ha
   effetto in un `<meta>`.
6. **Nessun backup del database.**
7. **La regressione visiva non ha riferimenti approvati**, e su questa
   macchina non arriva in fondo.
8. **Una sola gamba di browser.** Firefox non è stato provato.
9. **Nessuna prova su lettore di schermo reale né su dispositivo fisico.**
