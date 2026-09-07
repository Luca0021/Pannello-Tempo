# CHANGELOG.md

Che cosa è cambiato, e — dove conta — che cosa era rotto.

Le voci raccontano il difetto insieme alla correzione: «migliorata la
gestione dei limiti» non permette a nessuno di capire se il proprio backup
era a rischio.

---

## Build candidata — schema 6

**Pubblicata su GitHub Pages dal flusso `Pubblica`**, impronta
`f915fb62fff8`, **con configurazione Firebase generata dai Secrets**: sul
sito l'Account è disponibile e funziona.

### `.barrabasso`: quattordici righe di stile per una barra che non esiste

La barra fissa in basso del telefono è stata sostituita da `.navprim.basso`
(NAV-001), ma il suo stile è rimasto: **sei regole, quattordici righe**, in
`css/mobile.css`. Nessun modulo scriveva più quella classe nel markup, e
ogni utente le scaricava lo stesso a ogni visita.

Prima di toglierle, `.barrabasso` è stato ricontato **in un browser**, non
solo con una ricerca nei sorgenti: dieci viste — Oggi, Agenda, Riepilogo,
Nuovo, Filtri, settimana, onboarding, chiusura di giornata, revisione
settimanale, guida — per due larghezze, cercando sia gli elementi con quella
classe sia la stringa nell'HTML dell'intero documento, che intercetta anche
un uso in un attributo. **Zero su venti combinazioni**, con il controllo che
le sei regole fossero davvero nei fogli caricati — altrimenti «zero» avrebbe
potuto voler dire soltanto che il CSS non era arrivato.

Costa una cosa, e va detta: il CSS entra nell'impronta della build, quindi
questa rimozione cambia il nome della cache e **fa riscaricare lo scheletro
a tutti**. È il prezzo di qualunque modifica a un file servito, non di
questa in particolare.

### L'impaginazione, misurata: cinque difetti e due allarmi che erano miei

Censimento in un browser vero su **26 condizioni** — sei larghezze da 320 a
1920 più zoom 200%, due temi, cinque sezioni — con dodici misure per
condizione. Nove di quelle misure non trovano niente, ed è un risultato:
zero scorrimenti orizzontali, zero sovrapposizioni, zero contrasti sotto
soglia nei due temi, zero vuoti ingiustificati.

Le cinque che trovavano qualcosa:

1. **un blocco da mezz'ora tagliava il proprio nome.** Alto 18px con un
   contenuto di 23 e `overflow:hidden`: il testo non sbordava, spariva a
   metà glifo. Cinque blocchi su otto. La scala dell'agenda passa da 38 a
   52px per ora, così la mezz'ora vale 26px e il nome entra. La scheda **non**
   diventa più alta: `.agscroll` ha un'altezza massima, quindi cambia quanto
   si scorre dentro il riquadro, non quanto occupa nella pagina;
2. **la maniglia di ridimensionamento copriva il 72% di quei blocchi.** Era
   alta 13px fisse: in un blocco da 18 restavano 5px per il gesto che uno
   voleva fare, e toccare l'attività iniziava un trascinamento. Ora è una
   frazione dell'altezza. Nessun errore, nessun controllo rosso: due
   rettangoli da confrontare, e si vede solo misurando;
3. **i titoli di sezione stavano su quattro colonne diverse** — 138, 140, 141
   e 120px — perché il bordo d'accento sta fuori dal riempimento e sposta a
   destra tutto il contenuto della scheda. Due pixel non si leggono come una
   scelta: si leggono come una colonna che non tiene. Ora è una sola;
4. **cinque comandi autonomi erano sotto il bersaglio minimo** di 24×24
   (WCAG 2.5.8): «Ripristina» e i suoi simili a 18-19px, il pulsante che apre
   una sezione a 20, quello che riporta l'agenda all'ora attuale a 22.
   `mobile.css` alzava già cinque altre classi per il dito: queste erano
   rimaste fuori dall'elenco;
5. **sei classi di testo informativo sotto i 12px**, fino a 10px sull'etichetta
   «adesso» — che dice qual è la cosa più urgente della riga. Ora la soglia è
   12px per il testo che porta un valore, con **due eccezioni dichiarate**:
   le etichette in maiuscoletto che nominano un posto invece di riportare un
   dato.

Più la vista **Riepilogo**, che non esponeva alcun titolo di primo livello:
sostituisce l'intero pannello, quindi la testata con l'`h1` della data non
c'è e la struttura cominciava da un `h2`.

**E due allarmi che erano miei, non del pannello.** Il numero al centro
dell'anello dichiara 11px e sullo schermo ne misura 15,5: dentro un SVG il
`font-size` è in unità del viewBox e va scalato. E la barra degli strumenti,
che a 320px mostra un collegamento su otto, **scorre di proposito** — con la
sfumatura che lo segnala e il commento che la spiega in `css/base.css`; era
il mio rilevatore a leggere la proprietà sbagliata. Un difetto va confrontato
con le intenzioni scritte prima di chiamarlo difetto.

10 prove nuove e 63 asserzioni in `tests/ui/impaginazione.spec.js`, un passo apposta nella
pipeline, e il racconto completo con le misure prima e dopo in
`UI-LAYOUT-REPORT.md`. → UI-007

### Il pannello pubblicato è utilizzabile: provato sul sito, non sull'artefatto

`Pubblica` numero 1, ramo `main`, commit `f5212f1`, ambiente `produzione`:
success in 1 minuto e 7 secondi. Prima di questa esecuzione il sito veniva
servito **dal ramo**, con due conseguenze misurate: finivano in rete
`tests/`, `strumenti/`, `package.json` e le regole Firestore, e
`js/config-firebase.js` era quello versionato, cioè `non-configurato` —
l'Account risultava non disponibile **per tutti**.

Adesso i nove file di sviluppo controllati rispondono **404**, e il flusso
completo è stato provato **sul sito pubblico**: 23 controlli su 23, con le
funzioni del pannello e non con chiamate REST scritte a mano. Registrazione,
accesso, uscita, sessione che non sopravvive al ricarico come vuole SEC-001,
scrittura e rilettura su Firestore, aggiornamento, isolamento fra utenti con
403 sul documento altrui, apertura offline dalla cache con la modifica
intatta, riconnessione che consegna la voce fatta offline, cancellazione
dell'account in sette passi con l'accesso successivo rifiutato. Una sola
cache, `pt-f915fb62`, 74 voci. Zero 404, zero errori critici in console.

Account e dati sintetici su `example.com`, tutti rimossi con la controprova.

### La pipeline è verde, e verde non significa coperto

Esecuzione numero 3, commit `f5212f1`: quattro lavori su quattro, **zero
passi falliti**. Le quattro suite che la prima esecuzione aveva lasciato
saltate girano ora su chromium **e su Firefox**, che in locale non si
scarica: la pipeline è il solo posto dove quella gamba possa girare.

Si chiudono **SEC-003** (il passo CSP verde in pipeline era il criterio
letterale), **TST-005** (tutte le suite su entrambi i browser) e **TST-007**
(un'esecuzione verde).

Resta però una cosa da dire, e sta nel riepilogo di ogni esecuzione: **il
confronto visivo è saltato**, perché gira solo contro riferimenti approvati
e non ce n'è nessuno. La pipeline è verde con zero copertura visiva. È
esattamente ciò che `strumenti/stato-regressione-visiva.mjs` esiste per
rendere impossibile ignorare.

### L'impronta non è confrontabile fra sistemi diversi

Avevo previsto che la build pubblicata avrebbe avuto impronta
`6d749ffe5ab4`. Il sito ha pubblicato `f915fb62fff8`, e la previsione era
sbagliata.

Ricalcolando l'impronta **dai file scaricati dal sito** viene esattamente
`f915fb62fff8`: la build pubblicata è coerente con ciò che serve. La
differenza stava da questa parte — `css/components.css` sul disco Windows ha
CRLF, e l'impronta è uno SHA-256 sul contenuto. Normalizzando i fine riga a
LF l'impronta locale diventa `f915fb62fff8`, alla cifra.

Il sorgente è lo stesso; l'identità della build no. `BUILD.md` §2 ora lo
dice, con le due conseguenze pratiche: un'impronta locale diversa da quella
pubblicata non è di per sé un allarme, e per confrontare la propria copia
col sito si ricalcola l'impronta dai file serviti.

### La sincronizzazione non ha mai potuto funzionare

È il difetto più grave di tutto il lavoro, e per trovarlo è servito mettere
il codice del pannello e un servizio Firebase nella stessa stanza — cosa che
non era mai stata fatta.

`normalizzaLettura()` restituiva `{ rev, payload }`. Ma il contratto che il
dominio implementa è un'altra cosa: `readRemote()` deve risolvere col
**testo** del documento, e lo si legge in tutti e quattro i suoi chiamanti,
che fanno `txt.trim()` o `remoteRevOf(txt)`. Entrambi gli adattatori vivi
passano già del testo; incartarlo in un oggetto rendeva `txt.trim`
`undefined`.

In `pushNow` quel TypeError finiva nel `.catch` finale, che lo traduceva in
«Errore imprevisto» e stato «errore». **La scrittura non partiva mai**: non
per una configurazione, non per un utente, ma per chiunque e a ogni
tentativo. Anche `verificaCollegamento()` — la diagnostica che dovrebbe dire
all'utente dove si rompe la sincronizzazione — si rompeva allo stesso punto.

Nessuna prova l'aveva visto, e nessuna era sbagliata: unit e integrazione
esercitano gli adattatori direttamente; la cancellazione usa risposte finte;
le Security Rules sono state verificate con chiamate REST scritte a mano,
che non attraversano il codice del pannello; le suite in browser non hanno un
servizio con cui parlare. È per questo che «SEC-010 chiuso, 20 controlli su
20» conviveva con una sincronizzazione che non scriveva niente: misuravano
oggetti diversi.

Ora c'è `tests/unit/sincronizzazione.test.js`, che fa girare `pushNow` contro
un servizio finto e verifica che una PATCH parta davvero. Controprova:
rimettendo la versione rotta, il collaudo passa da 9 verdi a 8 rosse su 9.

### L'artefatto di produzione è stato provato, non solo costruito

Costruito in locale con gli stessi passi di `pubblica.yml`, servito a un
browser vero, provato contro il progetto Firebase reale **usando le funzioni
del pannello**: **17 controlli su 17**. Registrazione, accesso, uscita,
sincronizzazione, aggiornamento, isolamento fra due utenti, utilizzo offline,
modifica offline che non si perde, riconnessione, cancellazione dell'account
e dei dati. La persistenza della sessione risulta funzionante **come
dichiarata**: non sopravvive al ricarico, perché il token non viene
conservato (SEC-001).

Account sintetici su `example.com`, cancellati con la controprova. Nessun
Admin SDK, nessun service account, nessun bypass delle regole.

### La pipeline ha girato per la prima volta, ed è stata rossa

Sul commit `da24a58`. Il lavoro locale è passato per intero — 23 passi su
23, regole Firestore sull'Emulator comprese — e i due lavori in browser sono
falliti al passo UI-006, lasciando **saltati** i quattro successivi:
sentinelle, cancellazione, CSP/PWA/offline/responsive, accessibilità. Un
passo saltato non è un passo passato, ed era il motivo per cui SEC-003 e
TST-005 restavano PARZIALE.

Dentro il rosso, una prima volta: «Terminologia della UI consumer» è passato
anche **su Firefox**.

Due cause, e sono di natura diversa.

### 1. La data scaduta era la scritta meno leggibile del pannello

**3,73:1 in tema scuro**, contro il minimo di 4,5:1. Uno stile inline in
`js/features/task-list-ui.js` usava `--rust` — un colore di **superficie** —
dove serviva `--rust-testo`, la variante per le scritte, che sullo stesso
fondo dà 5,91:1. Il bordo resta `--rust`: per un contorno la soglia è 3:1 e
la passa.

`tokens.css` lo dice da sempre, righe 35-38: «Ottone e verde sono nati come
colori di superficie… Servono varianti scure per le scritte». Vale per la
ruggine allo stesso modo, e qui era stata presa la variante sbagliata.

Nessuna lettura del CSS l'avrebbe trovato: la regola nel CSS non c'è. Ed è
una delle prove che su questa macchina non arrivavano mai in fondo — l'ha
trovata la pipeline, su entrambi i browser, e sopravviveva al retry.

### 2. Il confronto visivo faceva fallire ciò che non c'entrava

In `ui006.spec.js` convivevano due controlli con prerequisiti opposti: 14
asserzioni **strutturali**, che non richiedono nulla di approvato, e il
**confronto visivo**, che ha senso solo contro un riferimento che qualcuno ha
guardato. Stando nella stessa prova, il secondo faceva fallire il primo.

Ora il confronto gira solo contro riferimenti **approvati**, e approvato
significa **versionato in git** — non «presente sul disco». Un file appena
scritto da Playwright è sul disco e non dimostra niente; l'unica prova che
una persona l'abbia guardato è il commit che lo aggiunge.
`playwright.config.js` passa inoltre a `updateSnapshots: 'none'`: il
predefinito `missing` crea il riferimento assente e alla seconda esecuzione
la prova passa contro uno scatto che nessuno ha mai visto.

Non è un controllo indebolito, ed è stato provato nei tre versi: senza
riferimento la comparazione è saltata e annotata e **nessuno scatto viene
scritto**; con un riferimento che combacia passa; con uno che differisce
fallisce, 446.819 pixel diversi, exit 1.

Perché «verde» non possa nascondere «non ho guardato»,
`strumenti/stato-regressione-visiva.mjs` conta le comparazioni saltate e le
scrive nel riepilogo della pipeline.

Trovato per strada: `PW_UPDATE_SNAPSHOTS` non è una variabile che Playwright
legga, quindi l'input «aggiorna_riferimenti_visivi» del flusso di lavoro era
**decorativo** — metterlo a `true` non produceva alcun effetto né alcun
errore.

### Un flusso che pubblica davvero il sito, e non parte da solo

Il sito era pubblicato da `pages-build-deployment`, il flusso automatico di
GitHub che serve Pages **dal ramo**. Due conseguenze verificate
sull'artefatto vero: finiscono in rete anche `tests/`, `strumenti/`,
`package.json`, `.env.example` e le regole Firestore; e viene servito
`js/config-firebase.js` come sta in git, cioè `non-configurato`.

Nuovo `.github/workflows/pubblica.yml`: monta un artefatto con i **soli file
serviti** — l'elenco lo dichiara `build.mjs --elenco`, la stessa fonte che
calcola l'impronta — genera la configurazione dai Secrets senza farla entrare
nel repository, e la controlla prima di pubblicare con
`strumenti/controlla-artefatto.mjs`.

Si avvia **solo a mano** e chiede di digitare `pubblica`: un flusso che
pubblica con credenziali di produzione a ogni commit sposta dentro un
automatismo la decisione «questo è pronto per le persone».

**Non è attivo.** Serve che il proprietario cambi *Settings → Pages →
Source* da «Deploy from a branch» a «GitHub Actions». Finché non lo fa, il
file non cambia niente: il sito resta quello di adesso. È deliberato.

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

Dimostrato dal vivo: l'orologio della macchina di collaudo era avanti di
**998 ms** su quello del servizio, e con quel solo secondo `aggiornatoIl` =
adesso veniva **negato**. Passato permesso, adesso negato, +2 minuti negato:
nessuna tolleranza. E il pannello scrive «adesso».

### Poi la seconda pubblicazione, e SEC-010 si chiude

Ripubblicato l'intero file dal repository versionato, le prove sono state
rifatte sul progetto remoto: **20 controlli su 20, exit 0**, comprese le 14
fondamentali. Solo API REST con un idToken di utente normale — nessun Admin
SDK, nessun service account, nessun bypass — quindi le regole erano in vigore
su ogni chiamata.

- **tolleranza**: passato permesso, **istante corrente del client permesso**,
  +2 minuti permesso, +10 minuti negato. La prova decisiva è la seconda: è
  la scrittura che il pannello fa a ogni salvataggio, ed era quella che
  falliva. Il limite superiore continua a valere, quindi la tolleranza non
  ha allargato il controllo, l'ha reso sopportabile da un orologio reale;
- **proprietario**: creazione, lettura, aggiornamento e cancellazione tutti
  permessi, con la cancellazione vista avvenire (200, poi 404);
- **altro utente**: lettura, creazione, aggiornamento e cancellazione tutte
  negate, e la controprova che il documento resta intatto dopo i quattro
  tentativi;
- **accesso anonimo** e **percorsi non previsti**: negati in lettura e in
  scrittura; negato anche il contenitore `users/{uid}`.

**SEC-010: COMPLETATO.** Con esso, l'isolamento fra utenti (SEC-002) non è
più verificato soltanto su una copia fedele del servizio: è verificato sul
servizio.

La lezione che nessun collaudo di questo repository può insegnare: ciò che
governa i dati è il testo **pubblicato**, e può divergere dal file versionato
di una riga senza che nulla lo segnali. L'emulatore leggeva il file giusto ed
era verde — 14 prove su 14 — mentre il progetto applicava l'altro. Nel flusso
di lavoro non esiste alcun passo che pubblichi le regole né che confronti le
due versioni, quindi la divergenza può ripresentarsi: dopo ogni modifica
delle regole va rieseguita una sonda contro il servizio.

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
- **Pipeline GitHub Actions**: tre lavori, 34 passi, due browser. Eseguita
  tre volte: la prima rossa, la terza **verde**. → `RUN-CI.md`
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

**Sei** ticket sono PARZIALE, e nessuno dei sei si risolve installando
qualcosa. Il motivo comune di prima — «in questo ambiente non ci sono Node,
Java, Playwright, l'emulatore né un progetto Firebase reale» — è caduto: ci
sono, e sono girati. Restano quattro motivi propri:

| | Ticket |
|---|---|
| riferimenti visivi da guardare e approvare a mano | TST-006, e UI-006 che ne dipende |
| una chiave reCAPTCHA e una decisione di costo | SEC-009 |
| un lettore di schermo reale | A11Y-004 |
| un dispositivo fisico | MOB-001, MOB-002 |

→ `TEST-REPORT.md`, `BACKLOG-COVERAGE.md`

---

## Pubblicate in precedenza

| Commit | Che cosa |
|---|---|
| `f090579` | contrasto: azzerati 90 testi illeggibili, «Da riprogrammare» compreso |
| `a985f52` | prima release verificata in un browser vero: la CSP era rotta e l'agenda non si disegnava |
