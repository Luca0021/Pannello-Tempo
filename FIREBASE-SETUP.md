# FIREBASE-SETUP.md

**Procedura per il proprietario di Pannello Tempo.** Gli utenti non devono
fare nulla di quello che segue: è il punto della decisione architetturale in
`SYNC-DECISION.md`.

Tutti i valori in questo documento sono **segnaposto**. Non contiene, e non
deve contenere, configurazioni reali.

---

## 0. Prima di cominciare: che cosa è pubblico e che cosa non lo è

| Valore | Pubblico? | Dove sta |
|---|---|---|
| `apiKey` della web app | **sì** | `js/config-firebase.js`, generato dalla build |
| `authDomain`, `projectId`, `appId` | **sì** | idem |
| chiave del sito App Check (reCAPTCHA) | **sì** | idem |
| debug token App Check | **no** | solo sulla macchina di sviluppo |
| service account / private key | **no** | mai in questo progetto: non serve |
| client secret OAuth | **no** | mai: non c'è OAuth |

La `apiKey` di un progetto Firebase **non è una credenziale**: identifica il
progetto, non autorizza nulla. Google la pubblica nei propri esempi. Ciò che
protegge i dati sono tre cose diverse, e vanno configurate tutte e tre:

1. **Authentication** — stabilisce *chi* è l'utente;
2. **Security Rules** — stabiliscono *a che cosa* può accedere;
3. **App Check** — stabilisce *da dove* arrivano le richieste.

Chi salta la seconda ha un database aperto con una chiave pubblica. È il
motivo per cui questo documento mette le regole prima del deploy.

---

## 1. Creare o selezionare il progetto di produzione

1. `https://console.firebase.google.com` → **Aggiungi progetto**.
2. Nome: `pannello-tempo` (l'identificativo effettivo può differire: la
   console aggiunge un suffisso se il nome è già preso — annotalo, è il
   `projectId`).
3. Google Analytics: **disattivato**. Non raccogliamo telemetria, e attivarlo
   introdurrebbe una raccolta che la nostra informativa dichiara assente.
4. Area dei dati: **europe-west** (o `eur3` multi-regione). Va scelta ora:
   **non è modificabile dopo**.

Ripeti per un secondo progetto, `pannello-tempo-staging`, se vuoi un
ambiente di pre-produzione. Sono due progetti distinti, non due ambienti
dentro lo stesso: le Security Rules sono per progetto, e provarle su
staging senza toccare produzione è l'unico modo di provarle davvero.

## 2. Registrare la web app

1. ⚙ **Impostazioni progetto** → **Generali** → *Le tue app* → icona web `</>`.
2. Nome: `pannello-tempo-web`. **Non** attivare Firebase Hosting: il sito sta
   su GitHub Pages.
3. Copia i quattro valori:

```
apiKey:     AIzaSy…                 → PT_FIREBASE_API_KEY
authDomain: NOME-PROGETTO.firebaseapp.com → PT_FIREBASE_AUTH_DOMAIN
projectId:  NOME-PROGETTO           → PT_FIREBASE_PROJECT_ID
appId:      1:000…:web:000…         → PT_FIREBASE_APP_ID
```

## 3. Authentication

1. **Build → Authentication → Inizia**.
2. **Sign-in method** → abilita **Email/Password**.
3. Lascia **disattivato** «Link email (accesso senza password)»: richiede la
   gestione di un link di ritorno che questa versione non ha.

### Metodi di accesso: perché solo email e password

Accesso con Google o Apple richiede di gestire il ritorno da un
reindirizzamento e, per Apple, un servizio che firmi il client secret. Non
c'è, e aggiungerlo non è in questa iterazione. Email e password funzionano
interamente dal browser contro l'API di Google.

## 4. Reset della password

1. **Authentication → Templates → Password reset**.
2. Lingua: italiano.
3. **Action URL**: lascia il predefinito di Firebase, oppure impostalo su
   `https://TUO-UTENTE.github.io/Pannello-Tempo/` se vuoi che l'utente
   torni al pannello.
4. Personalizza il mittente e l'oggetto: un'email di sistema anonima finisce
   nello spam.

Nel pannello il comando è **«Password dimenticata»**, e chiama
`accounts:sendOobCode` con `requestType: PASSWORD_RESET`.

## 5. Verifica dell'email

1. **Authentication → Templates → Email address verification**, in italiano.
2. Decidi la politica:
   - **consigliata per l'MVP**: verifica *richiesta ma non bloccante*.
     L'utente entra e sincronizza subito; il pannello mostra un avviso
     «Email non verificata» con il comando per rimandare il messaggio.
   - **bloccante**: richiede una regola Firestore aggiuntiva
     (`request.auth.token.email_verified == true`). Più severa, ma un utente
     che non riceve l'email resta chiuso fuori dai propri dati.

`firebase/firestore.rules` contiene la clausola bloccante **commentata**, con
scritto perché non è attiva. Attivarla è una riga.

## 6. Firestore

1. **Build → Firestore Database → Crea database**.
2. **Modalità produzione** (regole chiuse): non «modalità test», che apre
   tutto per trenta giorni e viene dimenticata.
3. Area: la stessa scelta al punto 1.

Struttura creata dall'applicazione, documentata in `ARCHITECTURE.md`:

```
users/{uid}/profile/main
users/{uid}/datasets/current
users/{uid}/records/{recordId}
users/{uid}/backups/{backupId}
users/{uid}/tombstones/{recordId}
users/{uid}/sync/meta
```

L'UID è **nel percorso**, non in un campo del documento: così le regole lo
confrontano con `request.auth.uid` invece di fidarsi di ciò che il client
dichiara.

## 7. Pubblicare le Security Rules

**Prima del deploy del sito.** Un database in modalità produzione senza
regole nega tutto, il che è sicuro ma rompe l'app; con regole sbagliate
espone i dati.

> ### Questo passo NON è stato eseguito sul progetto `pannello-tempo`
>
> Non è un avvertimento generico: è lo stato **misurato** del progetto.
> Otto sonde, autenticate e non, sul progetto reale: **0 operazioni
> permesse su 8**, comprese le quattro che le regole di questo repository
> concedono al proprietario. Nessuna operazione che dovrebbe essere negata
> risulta permessa, quindi **non c'è alcuna esposizione** — ci sono le
> regole predefinite «production mode», che negano tutto.
>
> La frase qui sopra, «è sicuro ma rompe l'app», descrive esattamente la
> situazione attuale: Authentication funziona (registrazione, accesso,
> rifiuto della password errata e cancellazione dell'account sono stati
> verificati sul progetto vero), e il salvataggio viene rifiutato con
> `PERMISSION_DENIED`. Un utente si registra, entra, e i suoi dati non
> arrivano da nessuna parte.
>
> Finché il comando qui sotto non viene eseguito, la funzione «account» è
> visibile e inutilizzabile. È il ticket **SEC-010**; il dettaglio delle
> sonde sta in `SECURITY-REPORT.md` e `TEST-REPORT.md` §1.

```bash
npm i -g firebase-tools
firebase login
firebase use NOME-PROGETTO
firebase deploy --only firestore:rules
```

Verifica che siano quelle giuste: **Firestore → Regole** deve mostrare la
clausola di chiusura

```
match /{document=**} { allow read, write: if false; }
```

Senza quella riga, una collezione creata per sbaglio resterebbe accessibile.

I 14 collaudi delle regole stanno in `tests/security/regole.test.js` e vanno
eseguiti **sull'emulatore, non sul progetto di produzione**: §13.

## 8. Domini autorizzati

**Authentication → Settings → Authorized domains.** Aggiungi:

```
TUO-UTENTE.github.io
localhost              (già presente)
127.0.0.1              (aggiungilo: serve ai collaudi)
```

Senza il dominio di GitHub Pages, l'accesso funziona in locale e fallisce
online — con un errore che non nomina il dominio, quindi difficile da
diagnosticare.

## 9. GitHub Pages

Il sito è statico. Nulla da configurare su Firebase, ma tre cose da sapere:

1. **La configurazione non è nel repository.** Nel repository c'è la versione
   `non-configurato`; quella vera la genera la pipeline durante il deploy, dai
   segreti dell'ambiente. Vedi §16.
2. **Le intestazioni HTTP non sono configurabili.** GitHub Pages non permette
   di aggiungere `Content-Security-Policy`, `X-Frame-Options` o
   `Strict-Transport-Security`. Conseguenze in `SECURITY-REPORT.md`, SEC-003.
3. **La cartella va caricata con la sua struttura.** `css/`, `js/`, `icons/`
   devono restare cartelle: caricare i file appiattiti produce 404 su tutto e
   una pagina bianca. È già capitato due volte.

## 10. App Check

1. **Build → App Check → Inizia**.
2. Registra la web app con **reCAPTCHA Enterprise** (o v3).
3. Copia la **chiave del sito** → `PT_APPCHECK_SITE_KEY`.
4. Firestore: lascia **«Non applicato»** per una settimana e guarda le
   metriche. Passa a **«Applicato»** solo quando le richieste verificate sono
   la quasi totalità: applicare subito chiude fuori gli utenti su browser che
   non superano il controllo.

### Debug token: solo in sviluppo

Per lavorare in locale serve un debug token, che si registra in **App Check →
App → Gestisci debug token**.

- vive **solo** sulla macchina di sviluppo, in `.env`;
- `.env` è escluso da git;
- il generatore **si interrompe** se trova `PT_APPCHECK_DEBUG_TOKEN`
  valorizzata con `--ambiente produzione`;
- la pipeline lo verifica di nuovo prima del deploy.

Tre controlli per la stessa cosa, perché un debug token in una build pubblica
è una porta aperta permanente e nessuno se ne accorge.

### Rotazione

Se la chiave del sito viene compromessa: crea una nuova chiave reCAPTCHA,
aggiorna il segreto `PT_APPCHECK_SITE_KEY`, rifai il deploy, elimina la
vecchia chiave. Nessun dato utente è coinvolto: App Check non autentica
nessuno, verifica solo da dove arriva la richiesta.

## 11. Restrizioni della chiave API

La `apiKey` non autorizza, ma limitarla riduce l'uso improprio della quota.

1. `https://console.cloud.google.com` → stesso progetto → **API e servizi →
   Credenziali**.
2. Apri la chiave `Browser key (auto created by Firebase)`.
3. **Restrizioni applicazione** → *Referrer HTTP*:

```
https://TUO-UTENTE.github.io/*
http://localhost:*/*
http://127.0.0.1:*/*
```

4. **Restrizioni API** → limita a: *Identity Toolkit API*, *Token Service
   API*, *Cloud Firestore API*, *Firebase App Check API*.

Attenzione: sbagliare qui rompe l'accesso in modo silenzioso. Prova in
locale e online prima di considerarlo fatto.

## 12. Budget e avvisi

Il piano gratuito Spark non permette spesa, ma nemmeno App Check: per
usarlo serve **Blaze**, che è a consumo. Quindi il budget va impostato.

1. `https://console.cloud.google.com/billing` → **Budget e avvisi** →
   **Crea budget**.
2. Ambito: il progetto di Pannello Tempo.
3. Importo: parti da **5 €/mese**. Serve a scoprire un problema, non a
   pagare un servizio.
4. Soglie di avviso: **50%, 90%, 100%** dell'importo, via email.
5. **Non** collegare un'azione automatica che disattivi la fatturazione:
   disattivarla rende i dati inaccessibili agli utenti. L'avviso serve a
   guardare, non a spegnere.

### Quote e monitoraggio

| Che cosa guardare | Dove | Soglia oltre cui indagare |
|---|---|---|
| Letture Firestore/giorno | Firestore → Utilizzo | > 50 × utenti attivi |
| Scritture Firestore/giorno | idem | > 20 × utenti attivi |
| Richieste App Check rifiutate | App Check → Metriche | > 5% del totale |
| Accessi falliti | Authentication → Utilizzo | picchi improvvisi |
| Documenti per utente | Firestore | > 10 (la struttura ne prevede pochi) |

Un utente normale fa poche letture al giorno: il pannello legge all'apertura
e a ogni ritorno di fuoco, e scrive con un ritardo di quattro secondi
accorpando le modifiche. Numeri molto sopra questi indicano un ciclo di
sincronizzazione, non successo commerciale.

### Traffico anomalo: cosa fare

1. **Guarda** quali UID generano il traffico (Firestore → Utilizzo).
2. **Se è un solo UID**: probabile ciclo pull/push su un dispositivo. Il
   pannello ha già la protezione (`js/coda.js`, backoff esponenziale e
   deduplicazione), ma una versione vecchia in cache potrebbe non averla.
3. **Se sono molti UID nuovi**: probabile abuso. Passa App Check a
   «Applicato» se non lo è già.
4. **Se serve fermare tutto**: §Sospensione.

### Sospensione della sincronizzazione

In ordine di gravità crescente, e tutte reversibili:

1. **App Check → Applicato**: chiude le richieste non verificate.
2. **Authentication → Sign-in method → Email/Password → disattiva**: nessun
   accesso nuovo; le sessioni in corso durano al massimo un'ora, perché non
   conserviamo token di rinnovo.
3. **Regole di sola lettura**: pubblica una versione con `allow write: if
   false;`. Gli utenti continuano a leggere i propri dati, e il pannello
   funziona in locale.
4. **Regole chiuse**: `allow read, write: if false;`. Il pannello continua a
   funzionare in modalità solo dispositivo — la modalità predefinita — e
   mostra un errore leggibile sulla sincronizzazione.

Nessuno di questi passaggi cancella dati.

## 13. Emulatore

Serve **Java 11+** oltre a Node.

```bash
npm i -D @firebase/rules-unit-testing firebase-tools
npx firebase emulators:exec --only firestore,auth --project demo-pannello \
  "node tests/security/regole.test.js"
```

Il progetto `demo-pannello` è **finto**: il prefisso `demo-` è quello che
l'emulatore riconosce come progetto dimostrativo. Non tocca nulla di reale e
non richiede credenziali.

Il collaudo esce con:

- `0` — tutte le prove superate;
- `1` — almeno una fallita;
- `2` — **saltato**, perché manca `@firebase/rules-unit-testing`.

Il codice 2 è distinto di proposito: **un test saltato non è un test
superato**, e la pipeline non deve poterli confondere.

## 14. Build di sviluppo

```bash
cp .env.example .env          # e compila
node strumenti/genera-config-firebase.mjs --ambiente emulatore
```

> **`.env` resta fuori dal repository, e questo è verificato, non promesso.**
> È coperto da `.gitignore` (righe `.env` e `.env.*`, con `!.env.example` per
> tenere dentro il modello). Controlli fatti dopo averlo creato:
>
> ```bash
> git check-ignore -v .env                    # → .gitignore:4:.env
> git status --porcelain --untracked-files=all | grep '\.env'   # → nulla
> ```
>
> Il secondo è quello che conta: `--untracked-files=all` elenca anche i file
> mai aggiunti, e `.env` non compare nemmeno lì.
>
> **`npm run segreti` lo tollera, e non per un'eccezione.** Lo strumento
> chiede a git quali file sono versionati (`git ls-files --cached --others
> --exclude-standard`) e riporta i file ignorati a parte, senza far fallire
> nulla. Prima camminava sul filesystem e falliva su un `.env` corretto,
> consigliando di revocare una chiave che non era mai stata pubblicata: vedi
> `SECURITY-REPORT.md`, «Il controllo dei segreti mentiva sul proprio nome».
> Se un giorno `.env` comparisse fra i segreti **veri**, vorrebbe dire che ha
> smesso di essere ignorato — ed è il momento di preoccuparsi.

Con `--ambiente emulatore` il pannello parla con l'emulatore locale, non col
progetto vero: gli endpoint passano tutti da `js/config-firebase.js`, in un
punto solo, perché un modulo che se ne dimenticasse finirebbe a scrivere in
produzione durante un collaudo.

C'è anche una seconda protezione, indipendente: `vietaProduzioneNeiTest()`
interrompe l'esecuzione se `globalThis.__PT_TEST__` è vero e l'ambiente è
`produzione`. Due difese perché la conseguenza dell'errore è scrivere dati
finti nel database degli utenti.

## 15. Staging

Stessa procedura, secondo progetto:

```bash
node strumenti/genera-config-firebase.mjs --ambiente staging
```

con `PT_FIREBASE_*` che puntano a `pannello-tempo-staging`. Serve a provare
le regole con dati realistici prima di pubblicarle in produzione.

## 16. Deploy: dove finisce la configurazione

**Nel repository resta la versione `non-configurato`.** Quella vera viene
generata durante il deploy:

1. i quattro valori stanno nei **segreti** del repository GitHub
   (*Settings → Secrets and variables → Actions*);
2. il workflow li mette nell'ambiente e lancia il generatore con
   `--ambiente produzione`;
3. il risultato entra nell'artefatto pubblicato su Pages;
4. **non** viene committato.

Così il repository non contiene la configurazione di produzione — che è la
regola che ci siamo dati — e il sito pubblicato sì.

Se apri `js/config-firebase.js` nel repository e trovi valori reali, qualcuno
ha eseguito il generatore in locale e ha committato: va rimosso dalla
cronologia, non solo dal file.

## 17. Rollback

| Situazione | Cosa fare |
|---|---|
| regole sbagliate pubblicate | **Firestore → Regole → Cronologia**: le versioni precedenti sono lì, si ripubblica con un clic. Farlo subito: una regola permissiva espone i dati per tutto il tempo in cui resta attiva |
| configurazione sbagliata pubblicata | rifai il deploy con i segreti corretti. La build precedente resta in cache nei service worker degli utenti fino al ricaricamento |
| chiave API compromessa | ruotala nella console Cloud, aggiorna il segreto, rifai il deploy. Nessun dato utente è coinvolto |
| App Check troppo severo | riportalo a «Non applicato»: effetto immediato, nessun deploy |
| serve fermare tutto | §12 Sospensione |
| dati di un utente da ripristinare | dalle copie in `users/{uid}/backups/`, se presenti. Altrimenti dall'export locale dell'utente: non abbiamo backup del database, e va detto |

**Non c'è un backup automatico del database.** Firestore offre l'esportazione
programmata su Cloud Storage, non è configurata, e configurarla comporta un
costo di archiviazione e una decisione su quanto conservare. Finché non c'è,
l'unica copia dei dati di un utente che possiamo ripristinare è quella che ha
esportato lui. È scritto anche in `PRIVACY.md`, perché è una cosa che
l'utente ha diritto di sapere.

---

## Riepilogo: l'ordine conta

```
1. progetto           →  2. web app          →  3. Authentication
4. reset password     →  5. verifica email   →  6. Firestore
7. REGOLE             →  8. domini           →  9. Pages
10. App Check         →  11. chiave API      →  12. budget
13. emulatore + test  →  14. sviluppo        →  15. staging
16. deploy            →  17. rollback provato
```

Le regole (7) prima del deploy (16). E il rollback (17) provato **prima** di
averne bisogno: una procedura di emergenza non provata è una speranza.
