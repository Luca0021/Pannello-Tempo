# SYNC-DECISION.md

Audit della sincronizzazione e decisione architetturale.

| | |
|---|---|
| Build auditata | `035c16ab8a8f` |
| Schema dati | v5 |
| Data audit | 2026-09-03 |
| Metodo | lettura dei sorgenti + prove eseguite nel browser sulla build servita |

> **Che cosa è stato eseguito e che cosa no.** Le affermazioni marcate
> **[PROVATO]** derivano da codice eseguito nel browser sulla build corrente, con
> l'esito riportato. Tutto il resto è lettura del codice, e lo dico invece di
> presentarlo come verifica. Nessun test Firebase Emulator e nessun Playwright
> sono stati eseguiti: in questo ambiente **non esistono Node, npm, Java né
> Python** (verificato: `node` assente, `npm` assente, `java` assente,
> `python` è lo stub del Microsoft Store). È il motivo per cui SEC-002 resta
> PARZIALE, come richiesto.

---

## 1. Funzioni Firebase attualmente presenti

### Autenticazione

| Funzione | File | Che cosa fa |
|---|---|---|
| `registraAccount(email, pw, poi)` | `js/account.js:29` | `accounts:signUp` su identitytoolkit |
| `entraAccount(email, pw, ricordami, poi)` | `js/account.js:52` | `accounts:signInWithPassword` |
| `applicaSessione(d, email, ricordami)` | `js/account.js:73` | popola `sync.fb`, **azzera** `refresh`, chiama `saveSync()` |
| `esciAccount()` | `js/account.js:105` | azzera `sync.fb` e `sync.gist`, `eliminaSicuro(SKEY)` |
| `ripulisciTokenPersistenti()` | `js/account.js:126` | gira a ogni avvio (`js/boot.js:17`) |
| `residuiCredenziali()` | `js/account.js:144` | rilegge il disco e elenca ciò che resta |
| `accountDisponibile()` | `js/account.js:24` | `apiKey && projectId` di `CONFIG_ACCOUNT` |
| `fbSignIn(email, pw)` | `js/sync.js:193` | seconda implementazione dell'accesso, usata dal percorso manuale |
| `fbToken()` | `js/sync.js:209` | rinnova l'idToken su `securetoken.googleapis.com` |
| `autenticazioneRecente()` | `js/privacy.js:70` | finestra di 15 minuti da `sync.fb.inizioSessione` |

**Ci sono due implementazioni dell'accesso**: `entraAccount` (account.js, usa
`CONFIG_ACCOUNT`) e `fbSignIn` (sync.js, usa `sync.fb`). Hanno politiche
diverse sui token: la prima azzera `refresh`, la seconda lo salva. È la radice
del difetto §4.1.

### Dati

| Funzione | File | Che cosa fa |
|---|---|---|
| `fbDocUrl()` | `js/sync.js:223` | `projects/{projectId}/databases/(default)/documents/pannello/{uid}` |
| `fbRead()` | `js/sync.js:227` | GET; 404 → `""`; legge `fields.payload.stringValue` |
| `fbWrite(text)` | `js/sync.js:237` | PATCH con `updateMask.fieldPaths=payload` |
| `fbDelete()` | `js/sync.js:251` | DELETE; 404 tollerato |
| `FirebaseProvider` | `js/sync-provider.js:82` | adattatore al contratto SyncProvider |

**La struttura remota è un documento unico per utente** in una collezione
piatta `pannello/{uid}`, con l'intero dataset serializzato in un singolo campo
stringa `payload`. Non esiste un documento per record.

### Supporto

`controllaCampiFb()` `js/sync.js:104` · `ERRORI_FB` `js/sync.js:71` (11 modelli di
errore tradotti) · `verificaCollegamento()` `js/sync.js:276` · `REGOLE_ACCOUNT`
`js/account.js:165`.

---

## 2. Funzioni GitHub Gist attualmente presenti

| Funzione | File | Che cosa fa |
|---|---|---|
| `ghHeaders()` | `js/sync.js:166` | `Authorization: Bearer <PAT>` |
| `gistRead()` | `js/sync.js:172` | GET `/gists/{id}`; gestisce `truncated` via `raw_url` |
| `gistWrite(text)` | `js/sync.js:184` | PATCH del file `pannello.json` |
| `controllaCampiGist(tok, id)` | `js/sync.js:117` | validazione formato |
| `GistProvider` | `js/sync-provider.js:50` | adattatore |
| `GistProvider.deleteRemote()` | `js/sync-provider.js:70` | **restituisce `ok:false`**: dichiara di non poter cancellare |

Non esiste codice che crei un gist: l'utente deve crearlo a mano e incollarne
l'identificativo. Non esiste controllo che il gist sia privato.

---

## 3. Chiavi memorizzate sul dispositivo

| Chiave | Dichiarata in | Contenuto |
|---|---|---|
| `pannello-tempo:v1` | `js/config.js:11` | il dataset (`S.data`) |
| `pannello-tempo:prefs` | `js/sync.js:6` | tema, densità, sezioni chiuse, raggruppamento |
| `pannello-tempo:sync` | `js/sync.js:23` | provider, auto, rev, dirty, **`gist{token,id,file}`**, **`fb{apiKey,projectId,email,uid,refresh,idToken,expAt}`** |
| `pannello-tempo:backup` | `js/backup.js:5` | copie automatiche |
| `pannello-tempo:pre-migrazione` | `js/migrations.js:8` | copia grezza prima di una migrazione |
| `pannello-tempo:pulizia-legacy` | `js/sicurezza.js` | marcatore «pulizia già eseguita» |

Tutte in `localStorage`, in chiaro, leggibili da qualunque script della pagina.

---

## 4. Token e rispettiva durata

| Token | Durata | Dove finisce |
|---|---|---|
| Firebase `idToken` | ~1 h (`expAt = now + expiresIn − 60 s`) | **su disco**, in `pannello-tempo:sync` |
| Firebase `refreshToken` | nessuna scadenza | **su disco**; rimosso solo al successivo avvio |
| GitHub PAT | quella scelta su GitHub, non letta dall'app | **su disco**, a tempo indeterminato |

### 4.1 [PROVATO] Il report di sicurezza afferma il falso

`SECURITY-REPORT.md` dichiara, per la Release 2B: «Token su disco | mai
scritto». **Non è vero nel codice corrente.** Prova eseguita nel browser sulla
build `035c16ab8a8f`:

```
sync.fb.refresh = 'REFRESH_DI_PROVA_xyz'
sync.fb.idToken = 'IDTOKEN_DI_PROVA_abc'
sync.gist.token = 'ghp_TOKEN_DI_PROVA_123'
saveSync()

localStorage['pannello-tempo:sync'] contiene:
  fb.refresh   = "REFRESH_DI_PROVA_xyz"     ← scritto
  fb.idToken   = "IDTOKEN_DI_PROVA_abc"     ← scritto
  gist.token   = "ghp_TOKEN_DI_PROVA_123"   ← scritto
```

`saveSync()` (`js/sync.js:48`) serializza `sync.fb` e `sync.gist` **interi**.
`fbSignIn()` (`js/sync.js:202`) assegna `sync.fb.refresh = d.refreshToken` e
chiama `saveSync()`: sul percorso manuale il token di rinnovo **finisce su
disco**. `applicaSessione()` lo azzera, ma vale solo per il percorso account.

### 4.2 [PROVATO] La pulizia all'avvio è incompleta

```
ripulisciTokenPersistenti() → tolti: ["sessione in memoria", "token su disco"]

dopo la pulizia:
  fb.refresh   = ""                          ← rimosso
  fb.idToken   = "IDTOKEN_DI_PROVA_abc"      ← RESTA
  gist.token   = "ghp_TOKEN_DI_PROVA_123"    ← RESTA
```

Sopravvivono un token di accesso valido fino a un'ora e un token GitHub senza
scadenza. La funzione si chiama «ripulisci token persistenti» e ne lascia due.

### 4.3 [PROVATO] `controllaCampiGist` è chiamata con gli argomenti invertiti

Firma: `controllaCampiGist(tok, id)` (`js/sync.js:117`).
Chiamata in `js/sync-provider.js:56`: `controllaCampiGist(sync.gist.id, sync.gist.token)`.

```
controllaCampiGist(pat, id)  → ""   (coppia valida, accettata)
controllaCampiGist(id, pat)  → "Il token non ha il formato atteso:
                                 deve iniziare con ghp_ oppure github_pat_."
```

Una coppia valida viene rifiutata, con un messaggio che indica il campo
sbagliato. `js/sync.js:283` usa invece l'ordine corretto: le due chiamate si
contraddicono.

---

## 5. Punti in cui il provider viene scelto

| Punto | File | Nota |
|---|---|---|
| valore iniziale `provider:"gist"` | `js/sync.js:25` | **il predefinito è Gist**, non «solo dispositivo» |
| `o.provider \|\| "gist"` in lettura | `js/sync.js:38` | un blocco senza provider ricade su Gist |
| `provider()` | `js/sync-provider.js:129` | risolve l'adattatore, ricade su `LocalOnlyProvider` se non configurato |
| `syncReady()` | `js/sync.js:59` | chiede all'adattatore, non al nome |
| `providerName()` | `js/sync.js:63` | **restituisce «GitHub Gist» o «Firebase»**: gergo mostrato all'utente |
| `applicaSessione()` | `js/account.js:74` | forza `sync.provider = "firebase"` |
| selettore a due pulsanti | `js/features/settings-ui.js:238` | `[["gist","GitHub Gist"],["firebase","Firebase"]]` |
| modulo `sync` | `js/modules.js:33` | `predefinito:"avanzato"` |
| intera scheda dietro `modoAvanzato()` | `js/features/settings-ui.js:167` | |

**Conseguenza:** in modalità semplice — il predefinito per un consumer — la
sincronizzazione **non è raggiungibile**. Quando lo diventa, il primo provider
proposto è Gist.

---

## 6. Flussi di lettura, scrittura, conflitto, cancellazione, logout

- **Lettura** `pullNow()` `js/sync.js:339`: salta se c'è una modifica aperta; se
  il remoto è vuoto fa `pushNow(true)`; se lo schema remoto è più recente si
  ferma; se `rev` remota > locale e ci sono modifiche locali chiama
  `fondiPerRecord()`, altrimenti sostituisce.
- **Scrittura** `pushNow(force)` `js/sync.js:313`: rilegge il remoto, confronta
  `rev`, incrementa, scrive tutto il dataset. Ritardo di 4 s (`scheduleSync()`).
- **Conflitto**: due meccanismi coesistono. `sync.conflict` (dataset intero,
  `js/sync.js:319`) e `S.conflitti` per record (`js/sync.js:356`). Il primo è
  quello che `resolveConflict()` `js/sync.js:393` sa risolvere.
- **Cancellazione remota**: Firebase `fbDelete()` cancella davvero; Gist
  dichiara `ok:false`. `cancellaTutto()` `js/privacy.js:90` riporta l'esito
  passo per passo e non nasconde i fallimenti parziali.
- **Logout**: `esciAccount()` `js/account.js:105`, poi `residuiCredenziali()`.
  Non copre `idToken` e PAT come dimostrato in §4.2, perché li azzera in memoria
  ma la verifica passa solo se `eliminaSicuro(SKEY)` riesce.
- **Backoff**: `ATTESA_RIPROVA` con crescita esponenziale fino a 5 minuti
  (`js/sync.js:334`).

Il modello per record (`js/versioni.js`, `js/conflitti.js`) è **client-side**:
i record hanno `mod`/`rev`/`sporco`/`del` in `data.versioni`, ma vengono
trasportati dentro il blob unico. Non c'è isolamento per record lato server.

---

## 7. Funzioni calendario

`js/calendar.js` — **solo esportazione**: `buildIcs()`:48, `firstOccurrence()`:34,
`fold()`:17 (piega a 74 ottetti), `stampLocal()`:28, `download()`:87.
`js/privacy.js:39` `esportaIcsTutto()`.

Nessun OAuth, nessuna connessione, nessuna lettura di un calendario remoto.

## 8. Funzioni ICS

`js/ics-import.js` — importazione da file. Il commento in testa (`:3`) già dice
correttamente che la sincronizzazione bidirezionale richiederebbe OAuth e un
server.

## 9. Testi che confondono dati e calendario

Le **sezioni** sono già separate (`js/features/settings-ui.js:660-661`: «3.
Account e sincronizzazione», «4. Calendario e notifiche»). L'ambiguità è nei
testi e nella nomenclatura:

| Punto | Testo | Problema |
|---|---|---|
| `landing.html:202` | «Sincronizzazione tua» | non dice di che cosa |
| `landing.html:231` | «Sincronizzazione fra dispositivi» | in un elenco che nomina anche il calendario |
| `settings-ui.js:135` | «Esporta gli slot nel calendario: le notifiche le manda lui» | corretto, ma sta sotto un titolo che comprende «notifiche» |
| `settings-ui.js:362` | «Importa dal calendario» | è «importa da un file .ics», non dal calendario |
| `settings-ui.js:458` | «il tuo Gist su GitHub» / «il tuo progetto Firebase» | gergo nel testo di cancellazione |
| `settings-ui.js:261` | `providerName()` | stampa «GitHub Gist» / «Firebase» |
| `guida.js:143` | voce «Sincronizzazione» | non distingue dati e calendario |
| `modules.js:33` | modulo «Sincronizzazione» | nome generico |

Mancano gli stati espliciti richiesti: «Nessun calendario collegato», «Ultima
esportazione», «Ultima importazione», «Integrazione automatica non attiva».

## 10. Comportamenti legacy da migrare

1. `provider` predefinito `"gist"` → deve diventare `"locale"`.
2. `sync.gist.token` su disco → da rimuovere, non riscrivere.
3. `sync.fb.idToken` su disco → da rimuovere.
4. `sync.fb.apiKey` / `projectId` inseriti dall'utente → sostituiti dalla
   configurazione di build.
5. `sync.ricordami` e il parametro `ricordami` di `entraAccount` → residui di
   una funzione rimossa, ancora nella firma.
6. `REGOLE_ACCOUNT` (`account.js:165`) e la regola nel `<textarea>`
   (`settings-ui.js:237`) → **due copie divergenti** delle regole, entrambe
   piatte su `pannello/{uid}` e **entrambe senza la clausola di chiusura**
   `match /{document=**} { allow read, write: if false; }`.
7. Collezione piatta `pannello/{uid}` → struttura `users/{uid}/…`.
8. Doppio meccanismo di conflitto (dataset intero + per record).

---

## Valutazione dei due provider

| Criterio | Firebase (oggi, manuale) | GitHub Gist | Firebase gestito (proposto) |
|---|---|---|---|
| Primo utilizzo | 8 passaggi in console Google | creare un gist + un PAT | email e password |
| Competenze tecniche | **necessarie** | **necessarie** | nessuna |
| Gestione credenziali | apiKey+projectId+email+password a mano | PAT incollato | password |
| Revoca | password Firebase | solo da GitHub, a mano | password / logout |
| Sicurezza client | idToken e refresh su disco (§4.1) | **PAT su disco, senza scadenza** | idToken solo in memoria |
| Isolamento utenti | regole scritte, **mai eseguite** | **nessuno**: il PAT vede tutti i gist dell'utente | regole per UID + test Emulator |
| Conflitti | rev + fusione per record | idem | idem |
| Cancellazione remota | reale (`DELETE`) | **impossibile** (`ok:false`) | reale |
| Recupero account | reset password Firebase | nessuno | reset password |
| Costi | a carico dell'utente | gratuito | **a carico del proprietario** |
| Dipendenza fornitore | Google | GitHub | Google |
| Supporto consumer | impossibile | impossibile | possibile |
| Futura app mobile | da riconfigurare | non praticabile | stesso progetto, stesso UID |

Due elementi decidono da soli:

- **Il PAT non può essere conservato in modo sicuro senza un server.** È lo
  stesso limite che ha portato a rimuovere «Resta collegato». Tenere Gist come
  «provider avanzato» significherebbe continuare a scrivere un segreto senza
  scadenza in `localStorage`.
- **Gist non sa cancellare.** `deleteRemote()` restituisce `ok:false`. Un
  prodotto destinato al mercato non può offrire «Elimina i miei dati» e poi
  svuotare un file lasciandolo dov'è.

---

## DECISIONE

> **A — Firebase come unico provider per tutti gli utenti, con GitHub Gist
> deprecato in sola lettura per la sola migrazione.**

Nel dettaglio:

1. **Predefinito: «Solo su questo dispositivo».** Nessun account richiesto per
   usare il prodotto. `provider` iniziale `"locale"`, non `"gist"`.
2. **Un solo progetto Firebase, del proprietario di Pannello Tempo**,
   configurato in fase di build. L'utente non vede mai apiKey, projectId,
   regole o collezioni.
3. **Isolamento per UID** con struttura `users/{uid}/…` e regole con clausola di
   chiusura negativa, verificate con test Emulator prima di dichiararle valide.
4. **Gist rimosso dal percorso consumer** e **deprecato**, non mantenuto come
   modalità avanzata. Motivo dimostrato dal codice, non preferenza: PAT
   inconservabile in sicurezza (§4.1) e cancellazione remota impossibile.
5. **Percorso di migrazione per chi usa Gist oggi**: lettura del gist esistente,
   esportazione, trasferimento sull'account, rimozione del PAT locale,
   istruzioni per revocarlo su GitHub. Nessuna cancellazione automatica del
   contenuto remoto: i dati dell'utente non si toccano senza chiederglielo.
6. **Nessun token persistito.** `idToken` solo in memoria; `refresh` mai
   richiesto; PAT rimosso all'avvio. La sessione dura quanto la scheda aperta,
   e lo si dichiara.
7. **Nessuna cifratura client-side in questa iterazione**, e nessuna
   affermazione «end-to-end encrypted». Le ragioni stanno in
   `E2EE-DECISION.md`.

### Perché non le altre opzioni

- **B (Firebase consumer + Gist avanzato)**: scartata. Richiede di conservare un
  PAT in `localStorage` e di offrire un provider che non sa cancellare. Sarebbe
  un falso senso di sicurezza, che la Fase 7 vieta esplicitamente.
- **C (entrambi allo stesso livello)**: scartata. È lo stato attuale, ed è la
  causa dell'ambiguità che si vuole rimuovere.
- **D (altro modello, es. backend proprio)**: scartata per questa iterazione.
  Risolverebbe cookie `HttpOnly` e «Resta collegato», ma introduce un servizio
  da mantenere, e il mandato esclude di simulare backend.

### Condizione bloccante dichiarata

Il punto 2 richiede una cosa che **non esiste ancora**: un progetto Firebase di
Pannello Tempo e la sua configurazione pubblica. Finché non c'è,
`CONFIG_ACCOUNT` resta vuoto e `accountDisponibile()` restituisce `false` — cioè
il percorso account è **codice morto nella build pubblicata**, esattamente come
oggi. Le istruzioni per crearlo staranno in `FIREBASE-SETUP.md`; l'esito dei
test Emulator non è dichiarabile prima di averli eseguiti.
