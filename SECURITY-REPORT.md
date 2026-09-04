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
| SEC-002 isolamento fra utenti | **PARZIALE** | regole scritte, controlli statici superati, **mai eseguite** |
| SEC-003 Content Security Policy | **PARZIALE** | provata in un browser vero: **era rotta**; corretta, resta un costo dichiarato |
| SEC-004 normalizzazione dei testi | **COMPLETATO** | eseguito **dopo** aver scoperto che non scattava |
| SEC-005 limiti dell'importazione di backup | **COMPLETATO** | idem |
| SEC-006 limiti dell'importazione ICS | **COMPLETATO** | idem |
| SEC-008 limiti e ritmo delle chiamate | **COMPLETATO** per la parte applicativa | otto meccanismi eseguiti |
| SEC-009 App Check | **PARZIALE** | predisposto, non attivo |

`SEC-007` non compare: non è stato toccato da questo lavoro.

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

## SEC-002 — isolamento fra utenti: scritto, non verificato

**PARZIALE**, e resta tale. È la protezione su cui si regge tutto il modello
a account: se una regola avesse un difetto, un utente autenticato potrebbe
leggere i dati di un altro.

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

**Non eseguite.** `tests/security/regole.test.js` contiene 14 prove — utente
A che legge, scrive, aggiorna e cancella il documento di B; interrogazione
dell'intera collezione; percorso manipolato; collezione diversa; utente non
autenticato in lettura e scrittura; i casi positivi — e richiede l'emulatore
Firestore, quindi Node e Java, che qui non ci sono.

```bash
npx firebase emulators:exec --only firestore,auth --project demo-pannello \
  "node tests/security/regole.test.js"
```

Il collaudo esce con **codice 2 = SALTATO**, distinto da passato e fallito:
un test saltato non è un test superato, e il codice di uscita lo dice invece
di lasciarlo intuire.

**Regole scritte non sono regole verificate.** SEC-002 passa a COMPLETATO
soltanto quando quel comando riporta `falliti: 0`.

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

Attivarlo richiede una chiave, la configurazione nella console Firebase, e
soprattutto la verifica che **non blocchi il traffico legittimo** — che è la
parte che va provata, non supposta. `FIREBASE-SETUP.md` §12 descrive le
conseguenze di costo.

---

## Rischi residui

In ordine di gravità.

1. **L'isolamento fra utenti non è verificato.** SEC-002. Finché
   `regole.test.js` non gira, è una promessa fondata su una lettura del
   codice.
2. **La cancellazione remota non è stata vista avvenire.** Il passo di
   verifica esiste e con risposte finte funziona; contro un servizio reale
   no. `PRIVACY.md` e `TEST-REPORT.md` §5.
3. **Il percorso account non è mai stato eseguito end-to-end.**
   Registrazione, accesso, prima sincronizzazione, conflitto, disconnessione:
   tutto scritto, niente provato contro Firebase.
4. **App Check non è attivo**: la quota è esposta all'uso automatizzato.
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

Non dice «il pannello è sicuro». Dice che otto controlli sono stati eseguiti
e che quattro non lo sono, e distingue le due cose.

La lezione di SEC-004/005/006 vale per tutto il resto del documento: **un
controllo che esiste nel codice e non è mai stato eseguito è una
supposizione ragionevole, non un fatto.** Cinque dei difetti trovati in
questo lavoro erano in codice che a leggerlo sembrava corretto — e uno di
quei cinque disattivava, in silenzio, tre ticket di sicurezza che
risultavano chiusi.
