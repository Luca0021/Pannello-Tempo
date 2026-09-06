# CHANGELOG.md

Che cosa è cambiato, e — dove conta — che cosa era rotto.

Le voci raccontano il difetto insieme alla correzione: «migliorata la
gestione dei limiti» non permette a nessuno di capire se il proprio backup
era a rischio.

---

## Build candidata — schema 6

**Non pubblicata.** Vedi `DEPLOYMENT-REPORT.md` §7.

### Il progetto Firebase reale è stato verificato, e le regole non sono pubblicate

Con la configurazione pubblica della Web App, tenuta in un `.env` locale
escluso da git, il percorso account è stato provato **sul progetto vero** con
le API REST. Utenti di prova su `example.com` — dominio riservato IANA, non
di nessuna persona — dati sintetici, e tutti gli account cancellati con la
controprova. Piano Firebase invariato, **Blaze non attivato**, nessuna
impostazione della console modificata.

**Authentication funziona.** Registrazione, accesso, rifiuto della password
sbagliata e cancellazione dell'account: eseguiti e verificati.

**Firestore nega tutto.** Otto sonde, autenticate e non: **0 operazioni
permesse su 8**, comprese le quattro che le regole di questo repository
concedono al proprietario; **0** operazioni che dovrebbero essere negate
risultano permesse. Il progetto ha le regole predefinite «production mode».

Le due conseguenze vanno dette insieme, perché hanno segno opposto:
**nessun dato era esposto** — non era aperto niente — e **la
sincronizzazione non funzionava per nessuno**: si entrava e non si salvava.
È lo stato peggiore da diagnosticare, perché la parte visibile funziona.

### Poi le regole sono state pubblicate, e mancava una riga

Il proprietario le ha pubblicate a mano dalla console. Le stesse sonde, più
l'isolamento e la cancellazione che prima non erano eseguibili — il documento
non si poteva creare — danno **12 controlli su 13**:

- **isolamento fra due utenti verificato sul servizio vero**: B non legge e
  non scrive il documento di A, la lettura anonima è negata, il contenitore
  `users/{uid}` è negato, la clausola di chiusura è in vigore, lo schema non
  regredisce. Sei rifiuti su sei;
- **la cancellazione remota è stata vista avvenire**: documento a 200,
  DELETE a 200, rilettura a 404. Più il percorso delle versioni precedenti.
  È ciò che mancava a **PRV-002**, che passa a COMPLETATO.

Il tredicesimo controllo fallisce, e il confronto riga per riga fra il testo
pubblicato e `firebase/firestore.rules` dà **una sola differenza su 96 righe
di codice**:

```
pubblicato:   aggiornatoIl <= request.time
repository:   aggiornatoIl <= request.time + duration.value(5, 'm')
```

È il difetto corretto in questa stessa build, ancora in vigore sul progetto.
La copia pubblicata veniva da `Downloads\pannello-tempo-collaudo`, un
duplicato della cartella **senza `.git`** e fermo a prima della correzione.

Dimostrato dal vivo: l'orologio della macchina di collaudo è avanti di
**998 ms** su quello del servizio, e con quel solo secondo `aggiornatoIl` =
adesso viene **negato**. Passato permesso, adesso negato, +2 minuti negato:
nessuna tolleranza. Il pannello scrive «adesso». **SEC-010** resta PARZIALE.

La lezione che nessun collaudo di questo repository può insegnare: ciò che
governa i dati è il testo **pubblicato**, e può divergere dal file versionato
di una riga senza che nulla lo segnali. L'emulatore leggeva il file giusto ed
era verde — 14 prove su 14 — mentre il progetto applicava l'altro. Nel flusso
di lavoro non esiste alcun passo che pubblichi le regole né che confronti le
due versioni, quindi la divergenza può ripresentarsi.

Verificare per davvero ha fatto emergere quattro difetti in più, tre dei
quali **solo** perché il progetto rifiuta le scritture: quel rifiuto è la
condizione reale del pannello oggi, quindi il messaggio che mostra in quel
momento è il messaggio che l'utente legge.

- **I messaggi d'errore mandavano l'utente in una console che non è sua.**
  13 campi su 33 contenevano gergo vietato dall'interfaccia consumer — nomi
  di servizi, «apiKey», «chiave API» — e istruzioni del tipo «Console →
  Impostazioni → …». Erano l'ultimo posto in cui sopravviveva
  l'architettura precedente, quella in cui l'utente possedeva il progetto e
  incollava la chiave a mano. La guardia sulla terminologia non li aveva mai
  letti, perché cerca nel DOM **renderizzato** e un messaggio d'errore è
  sullo schermo solo quando l'errore capita.
- **Il consiglio per il rifiuto delle scritture indicava il percorso
  sbagliato**: `pannello/{uid}`, che è il percorso delle versioni precedenti
  e in sola lettura. Chi l'avesse seguito alla lettera avrebbe aperto le
  regole sul percorso sbagliato e si sarebbe ritrovato la sincronizzazione
  ancora rotta. Era l'ultima delle tre copie divergenti delle regole.
- **`fbWrite` buttava via il corpo della risposta**, che è l'unico posto
  dove il servizio scrive il motivo del rifiuto. La voce specifica della
  tabella non poteva quindi corrispondere su una scrittura, e usciva il
  messaggio generico — che parlava dei permessi di un token di un altro
  servizio di sincronizzazione. Asimmetria che lo rendeva invisibile alla
  lettura: la **lettura** conserva il corpo, quindi lo stesso rifiuto dava un
  messaggio corretto in un verso e fuorviante nell'altro.
- **Il controllo dei segreti non chiedeva niente a git.** Annunciava
  «albero versionato» camminando sul filesystem, e falliva su un `.env`
  ignorato — cioè su una configurazione corretta, fatta seguendo
  `.env.example`. Peggio del falso allarme era il consiglio: «revocare la
  chiave e rimuoverla dalla cronologia», per un file mai committato. Ora
  l'insieme dei file lo dichiara `git ls-files`, e i file ignorati sono
  riportati a parte senza far fallire nulla. Verificato in entrambe le
  direzioni: passa con `.env` presente, e continua a fallire su un file non
  ignorato che contiene una chiave.

Il primo e il secondo sono ora tenuti fermi da
`tests/unit/messaggi-errore.test.js`, che legge l'elenco delle espressioni
vietate **da** `tests/ui/terminologia.spec.js` invece di copiarlo: due copie
di una regola significano che almeno una è sbagliata, ed è la lezione già
pagata con le tre copie divergenti delle Security Rules.

### I collaudi sono stati eseguiti, e hanno trovato nove difetti

Fino a questa build i collaudi erano dichiarati «predisposti». Non lo
erano: `package.json` conteneva `"type": "module"`, che rende modulo ES
ogni file `.js`, e tutti i collaudi usano `require()`. **Nessuno di loro
poteva partire.** Tolta quella chiave — i sei strumenti hanno estensione
`.mjs` e non ne hanno bisogno — sono state eseguite **256 asserzioni**,
tutte verdi, comprese le 14 prove delle regole Firestore sull'emulatore.

Difetti trovati soltanto eseguendo:

- **Le regole Firestore rifiutavano le scritture legittime** a
  intermittenza. `aggiornatoIl <= request.time` non tollerava alcuno
  scarto, e quel timestamp lo scrive il client con il proprio orologio: un
  utente con l'orologio avanti di qualche secondo non avrebbe **mai**
  potuto sincronizzare, senza un messaggio che lo spiegasse. Ora la
  tolleranza è di cinque minuti, e un timestamp nel futuro resta rifiutato.
- **A versione corrente girava solo l'ultima migrazione**, quindi i campi
  introdotti dai passi precedenti non venivano completati: un insieme di
  dati marcato v6 e privo di `tipo` restava incompleto.
- **«Adesso» a 4,38:1** e **il pulsante di selezione a 1,39:1**: due
  elementi sotto soglia in viste che le misure a mano non coprivano.
- **A 320px l'intestazione delle schede sforava di 14px**, e la pagina
  prendeva una barra di scorrimento orizzontale.

Più tre difetti nei collaudi stessi, che accusavano il prodotto di problemi
che non aveva. Uno di questi è una buona notizia travestita: la Content
Security Policy ha **bloccato** `page.addStyleTag()`, dimostrando che
`style-src-elem` è davvero applicato.

### Difetti corretti che disattivavano codice esistente

Questi tre non si vedono leggendo il codice. Sono stati trovati eseguendo i
controlli che i documenti dichiaravano.

- **I limiti di importazione non scattavano mai.** `js/sicurezza.js`
  dichiarava `var LIMITI` e `js/appcheck.js` un altro `var LIMITI`: i 60
  moduli condividono un unico scope, `appcheck.js` si carica dopo, e a
  runtime `LIMITI.backupByte` valeva `undefined`. Poiché `byte > undefined`
  è `false`, erano **disattivati** il limite di 8 MB per un backup, quello
  di 5000 voci, i 4 MB e i 500 eventi per un file di calendario, e il
  troncamento dei titoli a 500 caratteri. Tre ticket di sicurezza
  risultavano coperti da controlli inesistenti. I due nomi sono ora
  `LIMITI_IMPORT` e `LIMITI_INVIO`. → `GLOBAL-COLLISIONS.md` §2

- **Le modifiche non risultavano da sincronizzare.** `aggiornaVersioni()`
  chiamava `segnaModifica(id, quando)` passando un istante, ma
  l'implementazione viva — in `js/conflitti.js`, che vince sulla copia
  omonima in `js/versioni.js` — ha firma `segnaModifica(id, dati)`. Il
  record di versione finiva in un registro usa e getta: **ogni modifica
  salvata dal percorso normale non veniva segnata come da inviare**, quindi
  con un account collegato non sarebbe mai arrivata sull'altro dispositivo.
  Le cancellazioni funzionavano. → `GLOBAL-COLLISIONS.md` §3

- **La regione di annuncio per i lettori di schermo era duplicata.**
  `id="annunci"` esisteva due volte, e quella dentro `#app` veniva ricreata
  a ogni ridisegno — una regione viva sostituita nello stesso istante in cui
  il testo cambia può non essere annunciata affatto. Rimossa anche
  `annunciaMirato()`, che non aveva un solo chiamante.

- **Il controllo dei segreti segnalava sé stesso.** L'eccezione per il
  segnaposto di `.env.example` era scritta riproducendo il valore che
  ammetteva — trentacinque `X` in chiaro — e trentacinque `X` soddisfano il
  modello «chiave API Google» che quello stesso file dichiara. Il primo
  passo della pipeline usciva in errore e **bloccava tutti i successivi**,
  con una diagnosi incomprensibile. Ora l'eccezione descrive la *forma* del
  segnaposto invece di riprodurlo. Nello stesso file: le eccezioni valevano
  per **tutti** i modelli invece che per quello a cui erano destinate,
  perché il terzo argomento veniva usato come `&& modello`, sempre vero.

### Accessibilità

Cinque viste in quattro condizioni di tema e larghezza, più due condizioni
sul solo contrasto: **0 fallimenti** su contrasto del testo, contrasto dei
comandi, dimensione dei bersagli, nomi accessibili, id duplicati,
riferimenti ARIA rotti, salti di intestazione e scorrimento orizzontale.
Controprova 0 → 3 → 0. → `ACCESSIBILITY-REPORT.md`

- **Il bordo dei campi era invisibile**, in entrambi i temi: 1,50:1 sulle
  schede in chiaro, 1,70:1 in scuro, contro il 3:1 richiesto dalla 1.4.11.
  Per un campo bianco dentro una scheda bianca il bordo è l'unica cosa che
  dice che lì c'è un campo. Riguardava 31 campi e ogni pulsante contornato.
  Nuovo token `--bordo-campo`, con il fondo peggiore **misurato** e non
  ipotizzato.
- **Sette campi senza nome accessibile**, e uno il cui unico nome era il
  segnaposto — che sparisce appena si scrive.
- **31 `<label>` che non etichettavano niente.** Ora il nome sta sul
  comando, con un `aria-label` che contiene il testo visibile, e la
  didascalia è uno `<span>`.
- **I sette pulsanti dei giorni erano larghi 9 pixel** a 375px, e attaccati.
  Nello stesso blocco: il nome era la sola iniziale, e «M» compariva due
  volte; lo stato scelto stava solo nel colore. Ora 31×32 px a 320px, nomi
  pieni da `DAYNAMES`, e `aria-pressed`.
- **La stella delle priorità era a 1,03:1** sullo sfondo di pagina: un
  comando che non si vedeva.
- **Il testo del giorno selezionato era `#fff` fisso**: in tema scuro, su
  azzurro chiaro, 3,08:1.
- **`--muted` era ancora sotto soglia** in 13 testi: il caso peggiore non
  era la tappa scura dello sfondo, ma la riga della griglia **sopra** quella
  tappa. Correzione di una correzione precedente, che aveva dichiarato un
  caso peggiore incompleto.

### Sincronizzazione e account

- **Un solo fornitore per chi usa il prodotto**, e la **modalità locale è il
  predefinito**: `provider` passa da `"gist"` a `"locale"`.
  → `SYNC-DECISION.md`
- **Nessun token su disco.** «Resta collegato» è stato rimosso: non era
  difficile da fare bene, non si può fare bene senza un server. `saveSync()`
  scrive a lista chiusa; i token delle versioni precedenti vengono rimossi
  all'avvio. Tre difetti trovati eseguendo: `saveSync()` scriveva tre
  segreti in chiaro, la pulizia ne rimuoveva uno su tre, e
  `controllaCampiGist` veniva chiamata con gli argomenti invertiti.
  → `SECURITY-REPORT.md` SEC-001
- **Gist è deprecato e in sola lettura.** `gistWrite()` è stata cancellata
  dal codice; il fornitore non è più selezionabile; il token vive solo in
  memoria e viene dimenticato anche in caso di errore. Resta una via
  d'uscita per portare via i dati. → `GIST-MIGRATION.md`
- **Account e Calendario sono due cose diverse**, in tutta l'interfaccia,
  nella guida, nell'onboarding e nella pagina di presentazione. Il
  calendario è **esportazione**, non integrazione, e ora lo dice.
  → `CALENDAR-SYNC.md`
- **La prima sincronizzazione si decide, non avviene**: conteggi locali e
  remoti, quattro scelte esplicite, copia di sicurezza prima, nessuna
  sovrascrittura silenziosa. I titoli delle attività non compaiono nel
  riepilogo.
- **La configurazione Firebase viene dalla build**, non dall'utente: nessuno
  deve creare un progetto, copiare una API key o pubblicare regole. Con
  `non-configurato` l'account non è disponibile e l'interfaccia **lo
  dichiara** invece di offrire un pulsante che fallisce.
  → `FIREBASE-SETUP.md`
- **Limiti, ritmo e cicli**: attesa crescente con tetto, sospensione dopo
  sei errori, rispetto del 429, deduplicazione, riconoscimento dei cicli,
  limiti sul dataset. App Check **predisposto e non attivo**, con tre costi
  dichiarati.

### Privacy e cancellazione

- **Si dice anche ciò che NON è protetto.** Tre affermazioni di trasparenza
  nell'interfaccia, e una tabella di otto protezioni con il loro limite.
  Nessuna dichiarazione di cifratura end-to-end, che non c'è.
  → `PRIVACY.md`, `E2EE-DECISION.md`
- **La cancellazione ha sette passi e nessuna falsa conferma.** Dopo un
  `DELETE` riuscito il documento viene **riletto**: se è ancora leggibile,
  l'esito è parziale e lo dice. Scelta separata su dati locali, dati nel
  servizio e account.

### Interfaccia

- **L'indicatore Lavoro/Vita non è più una barra colorata** accanto alla
  casella, che comunicava l'area col solo colore ed era ambigua rispetto
  allo stato di completamento. Ora è un punto più la parola, nella riga dei
  metadati, e sparisce quando la lista è già raggruppata per area.
  14/14 asserzioni in sette condizioni. → `UI-BEFORE-AFTER.md`
- **La casella di completamento è nativa**, annunciata come tale e comandata
  dalla barra spaziatrice senza codice nostro. Nell'agenda in elenco era a
  destra: spostata a sinistra.
- **Il diffing del DOM non sincronizzava la proprietà `checked`.** Per una
  casella nativa lo stato vero è la proprietà, non l'attributo: i dati
  dicevano «fatto» e la casella restava vuota quando lo stato cambiava da
  qualcosa che non era il clic.

### Costruzione e verifica

- **Impronta deterministica** sui 76 file serviti, stampigliata nei quattro
  punti che devono coincidere. Un elenco di esclusioni divergente fra lo
  strumento canonico e quello di lavoro avrebbe fatto riscaricare l'intero
  scheletro a tutti gli utenti per niente: allineato. → `BUILD.md`
- **Controllo delle collisioni fra nomi globali** a ogni build: 590 nomi in
  un solo spazio, controllarli a occhio non è un piano.
- **Pipeline GitHub Actions**: tre lavori, 34 passi, due browser,
  `workflow_dispatch` con la scelta dell'ambiente. Mai avviata.
  → `RUN-CI.md`
- **`backlog.json` è la fonte** degli stati dei ticket, e
  `BACKLOG-COVERAGE.md` si ricalcola da lì: i conteggi non si scrivono a
  mano da nessuna parte.
- **Schema 6**: date del calendario e marcatore di migrazione. La migrazione
  lascia le date **nulle** invece di inventarle. → `MIGRATIONS.md`

### Documentazione

Venti documenti, tutti riferiti alla stessa build. `SECURITY-REPORT.md` è
stato **riscritto** invece di ricevere altre sezioni di aggiornamento: le
versioni precedenti si contraddicevano fra loro — «SEC-001 PARZIALE» e
«SEC-001 chiuso» a tre sezioni di distanza — e citavano due file di collaudo
che in questo repository non sono mai esistiti.

### Quel che resta aperto

Nove ticket sono **PARZIALE**, e non per pigrizia: richiedono Node, Java,
Playwright, l'emulatore Firestore o un progetto Firebase reale, che in
questo ambiente non ci sono. Circa 240 asserzioni sono scritte e **non
eseguite**. → `TEST-REPORT.md`, `BACKLOG-COVERAGE.md`

---

## Pubblicate in precedenza

| Commit | Che cosa |
|---|---|
| `f090579` | contrasto: azzerati 90 testi illeggibili, «Da riprogrammare» compreso |
| `a985f52` | prima release verificata in un browser vero: la CSP era rotta e l'agenda non si disegnava |
