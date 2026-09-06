# SECURITY-REPORT.md

**Che cosa è stato verificato eseguendolo, che cosa no, e perché.**

Build di riferimento: vedi `build.json`, campo `sorgenti`. Gli stati dei
ticket vivono in `backlog.json` e sono riassunti in `BACKLOG-COVERAGE.md`;
questo documento spiega **come** sono stati raggiunti.

Questo file è stato **riscritto** per riflettere la build corrente. Le
versioni precedenti accodavano sezioni di aggiornamento che si
contraddicevano fra loro — «SEC-001 PARZIALE», poi «SEC-001 chiuso» tre
sezioni dopo — e un rapporto che si legge in ordine cronologico invece che
per stato non serve a decidere niente. Le correzioni di rotta restano
raccontate dove sono utili: dentro la sezione del ticket che riguardano.

---

## Riassunto

| Ticket | Stato | Come |
|---|---|---|
| SEC-001 credenziali fuori dal disco | **COMPLETATO** | eseguito nel browser su sei meccanismi di persistenza, con controprova |
| SEC-002 isolamento fra utenti | **COMPLETATO** | 14 prove su 14 sull'emulatore, quattro esecuzioni pulite. Ha trovato un difetto vero. **E ora verificato anche sul progetto reale**: sei rifiuti su sei |
| SEC-003 Content Security Policy | **PARZIALE** | provata in un browser vero: **era rotta**; corretta, resta un costo dichiarato |
| SEC-004 normalizzazione dei testi | **COMPLETATO** | eseguito **dopo** aver scoperto che non scattava |
| SEC-005 limiti dell'importazione di backup | **COMPLETATO** | idem |
| SEC-006 limiti dell'importazione ICS | **COMPLETATO** | idem |
| SEC-008 limiti e ritmo delle chiamate | **COMPLETATO** per la parte applicativa | otto meccanismi eseguiti |
| SEC-009 App Check | **PARZIALE** | predisposto, non attivo — e l'assenza di enforcement è ora **misurata**, non dedotta |
| SEC-010 regole pubblicate sul progetto reale | **PARZIALE** | pubblicate a mano e verificate: 12 controlli su 13. Il testo pubblicato è però precedente di **una riga** — manca la tolleranza sugli orologi |

`SEC-007` non compare: non è stato toccato da questo lavoro.

**Il risultato più importante di questa tornata è SEC-010**, e non è un
ticket nuovo perché è stato inventato: è un ticket nuovo perché la verifica
contro il progetto reale ha mostrato due cose che nessuna lettura del codice
poteva mostrare, e che nessun collaudo sull'emulatore poteva contraddire.

Prima: le regole non erano pubblicate affatto, quindi erano scritte bene,
provate a fondo, e non governavano niente. Dopo la pubblicazione: governano
quasi tutto, e la riga che manca è proprio quella che il pannello attraversa
a ogni salvataggio. Entrambe le volte, la differenza fra «il file è corretto»
e «il servizio è corretto» è stata misurabile solo interrogando il servizio.

---

## SEC-004, SEC-005, SEC-006 — tre ticket coperti da controlli che non c'erano

Questa è la scoperta più importante del lavoro sulla sicurezza, e va
raccontata per prima perché riguarda il metodo, non un dettaglio.

I tre ticket risultavano COMPLETATO. Il codice esisteva, era corretto, e
leggendolo non c'era niente da eccepire:

```js
if (byte !== undefined && byte > LIMITI.backupByte) { … rifiuta … }
```

**Nessuno di questi controlli scattava mai.** `js/sicurezza.js` dichiarava
`var LIMITI` con i limiti di importazione; `js/appcheck.js` dichiara un
altro `var LIMITI` con i limiti degli invii. I 60 moduli condividono un
unico scope globale (`ARCHITECTURE.md` §1) e `appcheck.js` si carica dopo:
a runtime `LIMITI` era il suo, `LIMITI.backupByte` valeva `undefined`, e
`byte > undefined` è `false`.

Erano disattivati:

| | Limite dichiarato | Comportamento reale |
|---|---|---|
| dimensione di un backup | 8 MB | nessun limite |
| voci in un backup | 5000 | nessun limite |
| dimensione di un file ICS | 4 MB | nessun limite |
| eventi in un file ICS | 500 | nessun limite |
| lunghezza di un titolo | 500 caratteri | nessun troncamento |

Senza un'eccezione, senza un avviso, senza una riga nella console.

**Come è emerso.** Non leggendo il codice: scrivendo questo rapporto ho
provato a eseguire i controlli che dichiarava, e sei prove su sedici sono
fallite. Le prime cinque volte ho supposto che fosse la mia misura a essere
sbagliata — è quasi sempre così — e la sesta ha mostrato il perché vero.

**Correzione.** I due nomi sono ora distinti, `LIMITI_IMPORT` e
`LIMITI_INVIO`, e sono stati rinominati **entrambi** di proposito: un
riferimento dimenticato diventa un `ReferenceError` rumoroso invece di un
`undefined` silenzioso.

**La rete che mancava.** `strumenti/controlla-globali.mjs` gira a ogni build
e fallisce se due moduli dichiarano lo stesso nome. Sono 590 nomi globali di
primo livello: controllarli a occhio non è un piano. Lo stesso controllo è
la prima prova di `tests/unit/limiti-e-versioni.test.js`.

**Verifica dopo la correzione**, eseguita nel browser:

```
PASSA  LIMITI_IMPORT esiste con i limiti di importazione  [backupByte=8388608]
PASSA  LIMITI_INVIO esiste con i limiti di invio          [tentativiMax=6]
PASSA  il nome generico LIMITI non esiste piu             [undefined]
PASSA  backup oltre 8 MB rifiutato
PASSA  backup oltre 5000 voci rifiutato        [dice quante ne ha trovate: 5100]
PASSA  JSON non valido rifiutato
PASSA  array al posto di un oggetto rifiutato
PASSA  file senza items rifiutato
PASSA  prototipo NON inquinato
PASSA  backup valido accettato con anteprima
PASSA  ICS oltre 4 MB rifiutato
PASSA  ICS oltre 500 eventi rifiutato          [dice quanti: 520]
PASSA  ICS valido accettato
PASSA  titolo troncato a 500 caratteri
PASSA  caratteri di controllo rimossi
```

**Che cosa resta vero dei tre ticket, oltre ai limiti.**

`ripulisciProfondo()` scarta le chiavi che permetterebbero di inquinare il
prototipo di `Object` (`__proto__`, `constructor`, `prototype`). Verificato
che dopo l'importazione di un file avvelenato `({}).inquinato` resti
indefinito, e che la chiave non sopravviva nemmeno nei dati.

Un difetto trovato in una fase precedente e ancora valido: il **conteggio
delle voci** avveniva dopo la pulizia, che tronca gli elenchi lunghi. Un
file smisurato sarebbe passato in silenzio, ridotto. Ora si conta prima, e
il messaggio dice quante voci ha trovato — 5100 nella prova, non «troppe».

URL: ammessi solo `http` e `https`. Rifiutati `javascript:`, `JaVaScRiPt:`,
`data:text/html`, `vbscript:`, `file://`, `//host`.

---

## SEC-001 — nessuna credenziale su disco

**COMPLETATO.** È l'unico ticket di sicurezza che si potesse chiudere senza
pipeline, perché non dipende da un browser remoto né da un emulatore.

### La decisione, e perché è una rimozione

«Resta collegato» **non esiste più**, e con essa la conservazione del token
di rinnovo. Non era difficile da fare bene: **non si può fare bene qui.**

| | |
|---|---|
| token di rinnovo in memoria | mai valorizzato, nemmeno se il chiamante lo chiede |
| token su disco | mai scritto; quelli delle versioni precedenti vengono rimossi all'avvio |
| preferenza «ricordami» | rimossa dal modello e dall'interfaccia |
| durata della sessione | finché il pannello è aperto |

Un token in `localStorage` è leggibile da qualunque script eseguito nella
pagina. Le difese che avevamo — CSP restrittiva, nessuno script di terze
parti — sono mitigazioni, non protezioni. L'unica soluzione vera è un cookie
`HttpOnly; Secure; SameSite=Strict`, che il JavaScript non può leggere, e
**richiede un server** che questa installazione non ha.

**Cifrare il token con una chiave presente nella stessa pagina non è una
difesa**: sposta il problema di una riga di codice.

Le tre funzioni che rimuovono la custodia — niente «Resta collegato»,
nessun OAuth per il calendario, nessun Gist — hanno tutte lo stesso limite
alla radice: senza un servizio che custodisca i segreti, non si custodiscono
segreti. Prometterlo sarebbe la cosa peggiore delle tre.

### Come è scritto sul disco

`saveSync()` scrive a **lista chiusa**: `provider`, `auto`, `rev`, `dirty`,
`gist.id`, `gist.file`, `fb.email`, `fb.uid`. Aggiungere un campo segreto al
modello non lo porta su disco per distrazione, perché per arrivarci bisogna
**togliere** il campo da `CAMPI_SEGRETI` **e** aggiungerlo all'elenco di ciò
che si scrive. Due gesti deliberati, non una dimenticanza.

`loadSync()` si rifiuta di caricare campi segreti anche se li trova.

### Verifica eseguita

Nel browser, sulla build servita su `http://localhost`:

| Prova | Esito |
|---|---|
| una sessione viva non scrive segreti su disco | **passata** — su disco solo gli otto campi ammessi |
| un token GitHub in memoria non raggiunge il disco | **passata** |
| un blocco «sporco» di una versione precedente viene ripulito | **passata** — 7 elementi rimossi, provider riportato a `locale` |
| verifica indipendente per stringhe dopo la pulizia | **passata** — vuota |
| l'uscita non lascia residui | **passata** — `syncReady()` falso |
| l'export JSON e CSV non contiene credenziali | **passata** |
| audit su sei meccanismi di persistenza | **passata** — `localStorage`, `sessionStorage`, URL, cookie, Cache API, IndexedDB |
| **controprova**: l'audit trova davvero i segreti | **passata** — cinque tipi di sentinella rilevati |

La controprova merita una nota: un controllo che non trova niente può essere
corretto oppure rotto, e senza sporcare di proposito i due casi non si
distinguono.

### Tre difetti trovati eseguendo

1. `saveSync()` scriveva `fb.refresh`, `fb.idToken` e `gist.token` **in
   chiaro**. Trovato scrivendo tre valori sentinella e rileggendo il disco.
2. `ripulisciTokenPersistenti()` ne rimuoveva **uno su tre**. Trovato
   eseguendola su un disco sporco, non leggendola.
3. `controllaCampiGist` veniva chiamata con gli **argomenti invertiti**
   (`js/sync-provider.js`). Trovato confrontando le due chiamate con una
   coppia valida.

Più uno di piattaforma, in una fase precedente: `elimina()` non restituiva
l'esito e il magazzino simulato non aveva `removeItem`. La pulizia sembrava
funzionare e non funzionava. Ora `eliminaSicuro()` rilegge la chiave per
confermare la rimozione, invece di darla per fatta.

---

## SEC-002 — isolamento fra utenti: verificato, e un difetto trovato

**COMPLETATO.** È la protezione su cui si regge tutto il modello a account:
se una regola avesse un difetto, un utente autenticato potrebbe leggere i
dati di un altro.

### L'esecuzione, e che cosa ha trovato

```
firebase emulators:exec --only firestore,auth --project demo-pannello \
  "node ../tests/security/regole.test.js"

passati: 14  falliti: 0        exit 0, tre esecuzioni consecutive
```

Le prime esecuzioni **non** erano verdi, e il fallimento si spostava: una
volta la prova 02, una volta la 03, una volta nessuna. Un'intermittenza del
genere è un segnale, non un fastidio da riprovare finché passa.

La causa era una regola sbagliata, non un collaudo instabile:

```
/* prima */  request.resource.data.aggiornatoIl <= request.time
```

Quel timestamp lo scrive il **client**, con il proprio orologio. Bastava che
fosse avanti di qualche millisecondo perché il servizio rifiutasse la
scrittura con `PERMISSION_DENIED`. Sull'emulatore lo scarto era fra
l'orologio di Node e quello della JVM; **in produzione sarebbe stato lo
scarto fra l'orologio dell'utente e quello di Google**, e un utente con
l'orologio avanti di qualche secondo — cosa comunissima — non avrebbe mai
potuto sincronizzare, senza alcun messaggio che spiegasse perché.

```
/* ora */    request.resource.data.aggiornatoIl <= request.time + duration.value(5, 'm')
```

Cinque minuti assorbono lo scarto normale fra orologi e lasciano intatto lo
scopo del controllo: un client che dichiarasse di aver scritto domani
verrebbe comunque rifiutato, e non potrebbe vincere per sempre i confronti
«chi ha modificato per ultimo».

Dopo la correzione, tre esecuzioni consecutive pulite.

### Che cosa questo NON dimostra — e che ora è stato misurato

L'emulatore usa lo stesso file di regole, ma **non è lo stesso servizio**, e
soprattutto le regole che governano il progetto reale sono quelle
**pubblicate** su di esso, non quelle nel repository.

Nelle consegne precedenti qui c'era una possibilità: «il progetto reale
**può** avere regole diverse, comprese quelle predefinite, che negano tutto».
Non era una possibilità: **era così**, ed è stato verificato. Otto sonde sul
progetto `pannello-tempo`: **0 operazioni permesse su 8**, comprese le 4 che
queste regole concedono al proprietario, e 0 che dovrebbero essere negate
risultavano permesse. Il progetto aveva le regole predefinite «production
mode»: nessuna esposizione, e sincronizzazione impossibile per chiunque.

**Poi il proprietario le ha pubblicate a mano dalla console, e la
pubblicazione è stata verificata.** Le stesse sonde, più l'isolamento e la
cancellazione che prima non erano eseguibili — il documento non si poteva
creare — danno **12 controlli su 13**:

| Controllo | Sul progetto reale |
|---|---|
| A scrive e rilegge il proprio documento | **permesso**, payload identico |
| B legge il documento di A | **negato** `403` |
| B scrive nel documento di A | **negato** `403` |
| lettura senza autenticazione | **negato** `403` |
| A legge il contenitore `users/{A}` | **negato** `403` — `allow read: if false` è in vigore |
| A scrive in una collezione non prevista | **negato** `403` — la clausola di chiusura c'è |
| A scrive schema 5 su un documento a schema 6 | **negato** `403` |
| A cancella il proprio documento | **permesso**: 200, poi `404` |
| A scrive con `aggiornatoIl` = adesso | **negato** `403` ← l'unico fallimento |

**L'isolamento fra utenti è ora verificato dove conta**: non più su una copia
fedele del servizio, ma sul servizio. Sei rifiuti su sei.

### Ma è una versione precedente di una riga

Il confronto riga per riga fra il testo pubblicato e questo file dà **una
sola differenza su 96 righe di codice**:

```
pubblicato:   aggiornatoIl <= request.time
repository:   aggiornatoIl <= request.time + duration.value(5, 'm')
```

È il difetto corretto in `7bba236`, ancora in vigore sul progetto. La copia
pubblicata proviene da `Downloads\pannello-tempo-collaudo`, che è un
duplicato **senza `.git`** e fermo a prima della correzione.

Dimostrato dal vivo, non dedotto: l'orologio di questa macchina è avanti di
**998 ms** su quello del servizio, e con quel solo secondo di scarto una
scrittura con `aggiornatoIl` = adesso viene **negata**. Il pannello scrive
«adesso». Passato: permesso. Adesso: negato. +2 minuti: negato. +10 minuti:
negato — quindi nessuna tolleranza.

**La lezione, che nessun collaudo di questo repository può insegnare:** ciò
che governa i dati è il testo **pubblicato**, e può divergere dal file
versionato di una riga senza che nulla lo segnali. L'emulatore leggeva il
file giusto ed era verde mentre il progetto applicava l'altro. Solo una
sonda contro il servizio vero distingue i due casi.

`DEPLOYMENT-REPORT.md` §2.5 mette la pubblicazione delle regole **prima**
della pubblicazione del sito, ed è esattamente per questo.

### Che cosa c'è

`firebase/firestore.rules`, con dieci percorsi coperti e la clausola di
chiusura:

```
match /{document=**} { allow read, write: if false; }
```

Senza quella riga, una collezione creata per sbaglio resterebbe accessibile.

**L'UID sta nel percorso, non in un campo del documento.** Le regole lo
confrontano con `request.auth.uid` invece di fidarsi di ciò che il client
dichiara: un campo lo scrive il client, e un client può scrivere quello che
vuole.

`backups` e `tombstones` hanno `allow update: if false`: si creano e si
leggono, non si riscrivono. Una copia di sicurezza modificabile non è una
copia di sicurezza.

### Che cosa è stato verificato, e che cosa no

**Controlli statici superati:** 29 graffe bilanciate su 29, `rules_version`
dichiarato, clausola di chiusura presente, nessun `allow` senza condizione,
nessun `if true`, proprietà derivata dal percorso in tutti i percorsi
utente, dieci percorsi coperti.

**Eseguite.** `tests/security/regole.test.js`, 14 prove su 14, exit 0:
utente A che legge, scrive, aggiorna e cancella i propri dati; A che tenta
le stesse quattro operazioni sui dati di B; interrogazione dell'intera
collezione; percorso manipolato; UID falsificato dentro il documento;
utente non autenticato in lettura e in scrittura; dati non validi;
enumerazione globale.

I controlli statici, da soli, **non avrebbero trovato** il difetto di sopra:
29 graffe su 29 e una clausola di chiusura corretta convivevano benissimo
con una regola che rifiutava le scritture legittime. È la differenza fra
«il file è ben formato» e «le regole fanno quello che devono».

Il collaudo distingue tre esiti con tre codici di uscita diversi: 0 passato,
1 fallito, **2 saltato** — perché un test saltato non è un test superato, e
il codice di uscita deve dirlo invece di lasciarlo intuire.

### La `apiKey` non è un meccanismo di autorizzazione

Va detto perché è un fraintendimento comune: la `apiKey` di Firebase è
**pubblica per costruzione** — sta nell'artefatto pubblicato e chiunque la
può leggere. Identifica il progetto, non autorizza nulla. Ciò che autorizza
sono le Security Rules e il token di sessione. Un rapporto che citasse la
`apiKey` fra le protezioni sarebbe fuorviante.

Resta fuori dal repository per un altro motivo, dichiarato in `BUILD.md` §6:
un progetto reale committato viene usato per sbaglio da un collaudo, e i
collaudi scrivono.

---

## SEC-003 — la CSP era rotta, e le prove non lo vedevano

**PARZIALE.** Il difetto è corretto; il costo della correzione è dichiarato
e non ancora rimosso.

### Che cosa è stato trovato

Per tre build questo rapporto diceva «CSP presente, non provata» e ipotizzava
che «qualcosa vada corretto al primo caricamento reale». Non era un'ipotesi
da verificare: **la CSP impediva al pannello di funzionare**, e la
formulazione prudente ha lasciato credere il contrario.

`style-src 'self'` non vieta soltanto i fogli di stile esterni: vieta anche
l'attributo `style` sui singoli elementi, che dalla CSP 3 ricade sotto
`style-src-attr`. Il pannello ne scrive **141** in dieci moduli, e non sono
decorazioni residue: `js/features/agenda-ui.js` posiziona ogni blocco orario
con `top` e `height` calcolati sull'ora.

Misurato caricando il pannello su `http://localhost` con la CSP attiva:

| | con `style-src 'self'` | atteso |
|---|---|---|
| elementi con attributo `style` a cui lo stile viene applicato | **0 su 57** | 57 su 57 |
| altezza del contenitore dell'agenda | **0 px** | 630 px |
| righe delle ore | tutte a `top: 0` | 22, 60, 98, 136, 174, 212 px |
| barra di avanzamento e segno «adesso» | senza larghezza né posizione | corretti |

**La vista Agenda era inutilizzabile sul sito pubblicato.** Non si era vista
perché le prove erano state fatte da `file://` e dal file unico, dove la CSP
non si applica. È la ragione per cui «serve un browser» non era una
formalità, ed è il motivo per cui la pipeline serve il sito con un server
statico vero.

### La regola attuale

```
default-src 'self'; script-src 'self';
style-src 'self' 'unsafe-inline'; style-src-elem 'self'; style-src-attr 'unsafe-inline';
img-src 'self' data:; font-src 'self';
connect-src 'self' https://api.github.com https://identitytoolkit.googleapis.com
  https://firestore.googleapis.com;
form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none';
upgrade-insecure-requests
```

`style-src-elem 'self'` tiene severa la regola dove conta — nessun foglio di
stile e nessun blocco `<style>` da fuori — e `style-src-attr 'unsafe-inline'`
riammette i soli attributi. Firefox non applica le direttive separate,
quindi `style-src` porta entrambi i valori come ripiego per quei browser.
**`script-src 'self'` è intatto**, ed è quello che conta contro l'esecuzione
di codice: un attributo `style` non esegue nulla.

**Costo dichiarato:** un attacco che riuscisse a iniettare HTML potrebbe ora
iniettare anche CSS. È un peggioramento reale rispetto a `style-src 'self'`,
ma `style-src 'self'` non era un'alternativa: era un pannello rotto. La
correzione definitiva è togliere i 141 stili inline passando le misure con
variabili CSS impostate via CSSOM (`element.style.setProperty()`, che la CSP
non blocca), e solo dopo rimettere `style-src 'self'`.

**Limite della versione a file unico:** non può avere una CSP che vieta gli
inline, perché tutto il codice è inline. È il prezzo del funzionamento da
`file://`, ed è scritto nel file stesso.

### Clickjacking: `frame-ancestors` in un `<meta>` non ha effetto

Qui questo rapporto diceva: «`frame-ancestors 'none'` copre la protezione da
clickjacking». **Era falso.** `frame-ancestors` è fra le direttive che il
browser ignora quando la CSP arriva da un elemento `<meta>`: funziona solo
come intestazione HTTP. Il browser lo dichiara a ogni caricamento:

```
The Content Security Policy directive 'frame-ancestors' is ignored
when delivered via a <meta> element.
```

Verificato mettendo il pannello in un `<iframe>` della propria pagina: **si
caricava senza ostacoli**.

Nello stesso punto, `<meta http-equiv="X-Content-Type-Options">` è
**anch'esso inerte**: l'elenco degli `http-equiv` che il browser interpreta
è chiuso e non lo comprende. Resta nel file perché GitHub Pages manda già
`x-content-type-options: nosniff` da sé — quindi la protezione c'è dov'è
pubblicato — ma non è quella riga a darla.

**Mitigazione applicata:** `js/boot.js` si rifiuta di avviare il pannello
dentro una cornice e lo dichiara, con un collegamento per aprirlo in una
scheda propria. Non tenta di uscire dalla cornice: `top.location` è vietato
fra origini diverse e un tentativo fallito lascerebbe la pagina a metà.
`frame-ancestors 'none'` resta nella CSP per il caso in cui il pannello
venisse servito da qualcosa che sa mandare intestazioni.

È una difesa in JavaScript, quindi **vale finché il JavaScript gira**: non è
equivalente a un'intestazione, ed è l'unica cosa possibile senza un server.
Gli header `X-Frame-Options`, `Strict-Transport-Security` e
`Permissions-Policy` richiedono una configurazione del server che GitHub
Pages non consente.

---

## SEC-008 — limiti e ritmo delle chiamate

**COMPLETATO per la parte applicativa.** Otto meccanismi verificati
eseguendo, in `js/appcheck.js`:

| | Verificato |
|---|---|
| attesa crescente con tetto | 5 s → 300 s, e non oltre |
| sospensione dopo sei errori | con il motivo dichiarato all'utente |
| rispetto del 429 | almeno 60 s prima di riprovare |
| deduplicazione | due invii entro 3 s diventano uno |
| riconoscimento del ciclo | dopo dieci alternanze pull→push si sospende |
| dataset normale | accettato |
| 5100 voci | rifiutate |
| 950 000 caratteri | rifiutati |

**Che cosa non copre:** la limitazione dei **tentativi di accesso**. Quella
la fa Firebase (`TOO_MANY_ATTEMPTS`), non il pannello, e non è nostra da
chiudere né da rivendicare.

---

## SEC-009 — App Check predisposto, non attivo

**PARZIALE**, ed è una scelta con tre costi dichiarati in `js/appcheck.js`.
`appCheckSiteKey` è vuota: senza chiave reCAPTCHA, App Check non è attivo, e
la quota del progetto resta esposta all'uso automatizzato.

**Ora non è più una deduzione dal codice.** Registrazione e accesso via API
REST sul progetto reale sono riusciti **senza fornire alcun token di App
Check**: l'enforcement non è applicato. È la risposta del servizio, non la
lettura di un file. Vale la pena tenere separate le tre affermazioni, perché
si confondono facilmente:

- una Site Key presente non significa App Check attivo;
- App Check inizializzato nel client non significa enforcement applicato;
- l'enforcement applicato è l'unica delle tre che protegga qualcosa, e si
  verifica solo provando a chiamare il servizio senza token — come è stato
  fatto qui, con esito «accettato».

Attivarlo richiede una chiave, la configurazione nella console Firebase, e
soprattutto la verifica che **non blocchi il traffico legittimo** — che è la
parte che va provata, non supposta. `FIREBASE-SETUP.md` §12 descrive le
conseguenze di costo.

**Sequenza consigliata: prima SEC-010, poi questo.** Con le regole che negano
tutto, aggiungere l'enforcement di App Check somma due cause di rifiuto
indistinguibili, e la diagnosi diventa molto più difficile di quanto sia
adesso.

---

## SEC-010 — pubblicate, meno una riga

**PARZIALE.** Il dettaglio della misura sta in «Che cosa questo NON
dimostra», dentro SEC-002. Qui basta il fatto e che cosa serve.

Il proprietario ha pubblicato le regole a mano dalla console. La struttura è
quella giusta e la pubblicazione è stata verificata: isolamento, clausola di
chiusura, contenitore negato, schema che non regredisce, cancellazione
remota. Dodici controlli su tredici.

Il tredicesimo è `tempoPlausibile()`, che sul progetto è ancora
`aggiornatoIl <= request.time`, **senza** i cinque minuti di tolleranza. Il
pannello scrive «adesso» con l'orologio del dispositivo, e un secondo di
scarto basta: la sincronizzazione resta rotta per chiunque abbia l'orologio
avanti. È lo stesso difetto di `7bba236`, in vigore su un servizio vero.

Serve sostituire nella console quella funzione con questa, e ripubblicare:

```
function tempoPlausibile() {
  return !('aggiornatoIl' in request.resource.data)
         || (request.resource.data.aggiornatoIl is timestamp
             && request.resource.data.aggiornatoIl <= request.time + duration.value(5, 'm'));
}
```

Il file completo e corretto è `firebase/firestore.rules` in **questo**
repository. Attenzione a quale copia si apre: la versione pubblicata proviene
da `Downloads\pannello-tempo-collaudo`, un duplicato senza `.git` fermo a
prima della correzione. Due cartelle con lo stesso nome di file e contenuto
diverso sono lo stesso problema delle tre copie divergenti delle regole, in
un'altra forma.

Poi rieseguire la sonda: `aggiornatoIl` = adesso deve essere permesso,
`aggiornatoIl` + 10 minuti deve restare negato. Solo dopo pensare
all'enforcement di App Check (SEC-009).

Nota sul flusso di lavoro, invariata: `.github/workflows/verifica.yml` **non
contiene alcun passo che pubblichi le regole**, e la scelta dell'ambiente
offre `emulatore`, `non-configurato` e `staging` — non `produzione`. Quindi
le regole non verrebbero pubblicate nemmeno da un push su `main`, e la
divergenza fra file versionato e testo pubblicato può ripresentarsi. Non è
una dimenticanza da correggere di nascosto: un flusso che pubblica regole di
sicurezza va progettato decidendo chi può avviarlo.

---

## Il controllo dei segreti mentiva sul proprio nome

Non è un rischio residuo, è un difetto trovato ed è già corretto, ma va
raccontato qui perché riguarda uno strumento di sicurezza.

`strumenti/controlla-segreti.mjs` annunciava «SEGRETI TROVATI NELL'ALBERO
**VERSIONATO**» camminando sul filesystem con un elenco di cartelle da
saltare scritto a mano, senza chiedere niente a git. Creare il `.env` che
`.env.example` dice di creare — «Copia questo file in `.env` e compilalo» —
faceva fallire il **primo** passo di `npm run verifica`.

Due danni, e il secondo è peggiore del primo:

1. la pipeline si fermava su una configurazione **corretta**, e le due vie
   d'uscita più comode erano aggiungere `.env` alle eccezioni o mettere
   `|| true` sul comando. Un controllo che grida al lupo viene disattivato, e
   allora non protegge più niente;
2. il consiglio stampato era **falso**: «vanno revocati sul servizio che li
   ha emessi, e poi rimossi dalla cronologia», per un file che nella
   cronologia non è mai entrato. Qualcuno avrebbe revocato una chiave senza
   motivo e cercato a lungo qualcosa che non c'era.

Ora l'insieme dei file da controllare lo dichiara git:

```
git ls-files --cached --others --exclude-standard
```

cioè ciò che è già versionato **più** ciò che entrerebbe al prossimo commit —
esattamente la domanda a cui lo strumento vuole rispondere. I file ignorati
vengono letti comunque e riportati a parte, senza far fallire nulla: un
segreto in un `.env` locale è normale e va detto in un tono normale.

Verificato in **entrambe** le direzioni, perché un controllo di sicurezza
allentato va provato anche nel verso che conta:

- con `.env` presente: exit 0, con la nota «ignorato da git, non verrà
  committato»;
- con un file **non** ignorato che contiene una chiave finta: exit 1, come
  prima.

Se git non è disponibile, o se la cartella non è la radice del repository,
l'insieme di git non viene usato e si esamina tutto: meglio un falso allarme
che un buco. Il caso da evitare era il silenzio — se i percorsi di git e
quelli del filesystem non combaciassero, ogni file risulterebbe «ignorato» e
lo strumento passerebbe senza aver controllato niente.

---

## Rischi residui

In ordine di gravità.

1. **Il testo pubblicato è precedente al file versionato, di una riga, e
   quella riga rompe la sincronizzazione.** `tempoPlausibile()` sul progetto
   non ha la tolleranza sugli orologi: il pannello scrive «adesso», un
   secondo di scarto basta a farsi negare la scrittura, e questa macchina è
   avanti di 998 ms. **Un utente si registra, entra, e non riesce a
   salvare.** Non c'è esposizione di dati; c'è una funzione visibile e
   inutilizzabile. Si chiude con SEC-010, ed è il primo rischio perché è
   l'unico già in atto.
2. **Un file versionato corretto non dimostra un servizio corretto.** È il
   rischio strutturale che resta anche dopo aver sistemato la riga: nulla,
   in questo repository o nella sua pipeline, confronta il testo pubblicato
   con `firebase/firestore.rules`. L'emulatore leggeva il file giusto ed era
   verde — 14 prove su 14 — mentre il progetto applicava un altro testo. La
   divergenza è stata trovata solo interrogando il servizio vero, e può
   ripresentarsi alla prossima modifica delle regole.
3. **Il percorso account è verificato quasi per intero sul servizio vero.**
   Registrazione, accesso, password errata, scrittura, rilettura, isolamento
   fra due utenti, cancellazione del documento e dell'account: eseguiti e
   verificati. Restano non eseguibili conflitto e fusione fra due
   dispositivi, che richiedono due sessioni concorrenti, e la scrittura con
   il timestamp che il pannello usa davvero, per il punto 1.
4. **App Check non è attivo, e l'assenza di enforcement è misurata**: il
   servizio ha accettato registrazione e accesso senza alcun token. La quota
   è esposta all'uso automatizzato.
5. **`style-src` ammette `'unsafe-inline'`** per gli attributi `style`: chi
   riuscisse a iniettare HTML potrebbe iniettare CSS. Si chiude togliendo i
   141 stili inline.
6. **Clickjacking coperto solo da JavaScript.** `frame-ancestors` non ha
   effetto in un `<meta>` e GitHub Pages non permette intestazioni.
7. **Nessun backup del database.** L'unica copia ripristinabile dei dati di
   un utente è quella che ha esportato lui.
8. **Nessun limite proprio sui tentativi di accesso**: dipende dal servizio.
9. **`js/versioni.js` contiene una generazione precedente** in gran parte
   senza chiamanti. Non è un rischio di sicurezza diretto, ma è il tipo di
   codice che ha già prodotto un difetto grave (`ARCHITECTURE.md` §3).

---

## Che cosa questo rapporto non dice

Non dice «il pannello è sicuro». Dice quali controlli sono stati eseguiti e
quali no, e distingue le due cose.

Soprattutto non dice «i dati degli utenti sono protetti dalle regole di
questo repository». Dice che il testo **pubblicato** sul progetto isola gli
utenti — verificato, sei rifiuti su sei sul servizio vero — e che quel testo
**non è** il file di questo repository: gli manca una riga, e quella riga
impedisce ogni salvataggio. Le due affermazioni «le regole sono corrette» e
«le regole in vigore sono queste» restano separate, e nulla qui dentro le
tiene allineate automaticamente.

La lezione di SEC-004/005/006 vale per tutto il resto del documento: **un
controllo che esiste nel codice e non è mai stato eseguito è una
supposizione ragionevole, non un fatto.** Cinque dei difetti trovati in
questo lavoro erano in codice che a leggerlo sembrava corretto — e uno di
quei cinque disattivava, in silenzio, tre ticket di sicurezza che
risultavano chiusi.

SEC-010 aggiunge un secondo corollario, che l'emulatore non poteva insegnare:
**un controllo eseguito contro una copia fedele del servizio non dice nulla
sul servizio.** Le 14 prove sull'emulatore erano verdi mentre il progetto
vero prima negava tutto e poi applicava un testo diverso di una riga. Nessuna
delle due cose contraddiceva l'altra, perché misurano oggetti diversi:
l'emulatore misura il file, la sonda misura il servizio.
