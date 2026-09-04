# DEPLOYMENT-REPORT.md

**Come si pubblica, che cosa controllare prima, e come si torna indietro.**

Build di riferimento: vedi `build.json`, campo `sorgenti`.

> **Questa build non è stata pubblicata.** Nessun `push`, nessun deploy: è
> una build candidata locale. Ciò che segue è la procedura, non il resoconto
> di una pubblicazione avvenuta.

---

## 1. Dove va

GitHub Pages, dal ramo `main`, radice del repository. Non c'è un passo di
compilazione: **il sorgente è l'artefatto**. Pages serve i file come sono.

`.nojekyll` è necessario: senza, Jekyll ignora le cartelle il cui nome
comincia con l'underscore, e cambierebbe silenziosamente ciò che viene
servito.

### Che cosa Pages dà, e che cosa non dà

| | |
|---|---|
| HTTPS | sì, con certificato gestito |
| `x-content-type-options: nosniff` | sì, mandato da Pages |
| intestazioni personalizzate | **no**: né `X-Frame-Options`, né `Strict-Transport-Security`, né `Permissions-Policy`, né `Content-Security-Policy` |
| conseguenza | la CSP vive in un `<meta>`, e `frame-ancestors` **non ha effetto** lì. `SECURITY-REPORT.md` SEC-003 |

---

## 2. Prima di pubblicare

I passi automatici stanno nella pipeline (`RUN-CI.md`). Questo è ciò che
resta da fare a mano, e va fatto **in questo ordine**.

### 2.1 La pipeline è verde

Non «è stata avviata»: verde. In particolare i tre passi che nessun'altra
verifica sostituisce:

- **Regole Firestore su Emulator** con `falliti: 0`;
- **Cancellazione** verde su entrambi i browser;
- **Accessibilità** verde, con l'output di axe allegato.

Finché non lo sono, SEC-002, PRV-002 e A11Y-004/005/006 restano PARZIALE, e
pubblicare significa pubblicare con quei rischi aperti — che è una scelta
legittima, ma va fatta sapendo quali sono.

### 2.2 L'identità della build coincide nei quattro punti

```bash
node strumenti/build.mjs
node strumenti/controlla-impronta.mjs
```

`build.json`, `js/versione.js`, `sw.js` (`VERSIONE`) e gli attributi di
`index.html` devono portare la stessa impronta. **Se divergono, il service
worker serve una build e la pagina un'altra**: è il difetto che lascia
l'HTML nuovo con i moduli vecchi, e una funzione mancante lascia la pagina
bianca.

### 2.3 Nessun segreto, nessuna collisione

```bash
node strumenti/controlla-segreti.mjs
node strumenti/controlla-globali.mjs
```

Il primo cerca chiavi e token nell'albero. Il secondo cerca i nomi globali
dichiarati da due moduli — e non è una formalità: quella collisione ha già
disattivato tutti i limiti di importazione senza un solo messaggio d'errore
(`GLOBAL-COLLISIONS.md`).

### 2.4 La configurazione Firebase

Nel repository `js/config-firebase.js` è **`non-configurato`**, e va lasciato
così. La configurazione di produzione entra nell'artefatto pubblicato:

```bash
node strumenti/genera-config-firebase.mjs --ambiente produzione
```

con le variabili d'ambiente descritte in `.env.example`. Il file generato
**non si committa**: `FIREBASE-SETUP.md` §3 spiega perché un progetto reale
committato finisce usato da un collaudo, e i collaudi scrivono.

Con `non-configurato`, l'account non è disponibile e l'interfaccia lo
**dichiara** invece di offrire un pulsante che fallisce. Pubblicare così è
una scelta valida: il pannello funziona in modalità locale, che è il
predefinito.

### 2.5 Le regole Firestore sono pubblicate

Le regole non viaggiano con il sito: stanno nel progetto Firebase. Il file
`firebase/firestore.rules` è la **sola fonte**, e va pubblicato a parte:

```bash
npx firebase deploy --only firestore:rules --project <il-tuo-progetto>
```

**Pubblicare il sito senza pubblicare le regole è la sequenza sbagliata**: il
sito offrirebbe l'account mentre il servizio è ancora sulle regole
precedenti. Regole prima, sito dopo.

---

## 3. Pubblicare

```bash
git push origin main
```

Pages ricostruisce da sé. Il primo caricamento dopo il push serve `index.html`
dalla rete, quindi la nuova identità arriva subito; i moduli seguono, perché
sono **rete-prima** (`ARCHITECTURE.md` §6).

### Che cosa vede chi ha già il pannello aperto

Niente, finché non lo decide. Non c'è `skipWaiting()` automatico: il worker
nuovo attende, il pannello segnala che c'è un aggiornamento, e si attiva
quando l'utente lo chiede. È deliberato — un aggiornamento forzato mentre si
sta scrivendo una nota perde la nota.

---

## 4. Dopo aver pubblicato: sei controlli nel browser

Da fare sul sito pubblicato, non in locale. Sono i controlli che le prove
locali non possono dare.

| | Che cosa guardare | Perché proprio questo |
|---|---|---|
| 1 | la pagina si disegna, e **l'agenda ha altezza** | con la CSP severa l'agenda era alta 0 px, e nessuna prova da `file://` lo vedeva |
| 2 | la console non ha errori **oltre** ai due noti | `frame-ancestors` ignorato in un `<meta>`, e nient'altro |
| 3 | il service worker si registra, e `caches.keys()` mostra **una sola** cache `pt-…` | due cache significano che una build precedente non è stata ripulita |
| 4 | ricaricando **senza rete** il pannello si apre | è la promessa della PWA, e qui non è mai stata verificabile: il pannello del browser incorporato non registra i service worker |
| 5 | l'identità: `document.querySelector('.pt')?.dataset.build` uguale a `build.json` | conferma che HTML e moduli vengono dalla stessa build |
| 6 | `localStorage` non contiene credenziali | `PTCollaudo` non è pubblicato: si guarda a mano, cercando `token`, `refresh`, `apiKey` |

Se il punto 4 fallisce, il pannello resta usabile online: non è un motivo per
tornare indietro, è un difetto da correggere.

---

## 5. Tornare indietro

Il sorgente è l'artefatto, quindi tornare indietro è un commit.

```bash
git revert <commit>
git push origin main
```

**Non** `git push --force` su `main`: chi ha già scaricato l'HTML nuovo
avrebbe riferimenti a un'impronta che non esiste più.

### Che cosa non torna indietro da sé

| | Come si rimedia |
|---|---|
| **le migrazioni di schema** | i dati di un utente che ha già aperto la build nuova sono a schema 6, e la build precedente non li legge. La copia in `pannello-tempo:pre-migrazione` esiste, ma il ripristino lo fa l'utente. **È la ragione per cui una migrazione va provata prima**: `MIGRATIONS.md` |
| **le regole Firestore** | si ripubblicano dal file precedente. Firebase conserva la cronologia delle regole nella console |
| **la cache dei service worker** | il worker della build revertita ha un nome diverso, quindi si installa e ripulisce le altre. Un giro di caricamento, non un intervento |
| **i dati già sincronizzati** | restano come sono: la sincronizzazione non ha una storia da riavvolgere |

---

## 6. La versione a file unico

Esiste ed è la via di fuga per chi non vuole pubblicare niente: un file
`.html` che si apre con un doppio clic.

Due limiti, dichiarati nel file stesso:

1. **non può avere una CSP che vieta gli inline**, perché tutto il codice è
   inline;
2. da `file://` **non registra il service worker**, quindi non c'è
   funzionamento offline gestito — ma non serve: il file è già sul disco.

Non ha bisogno di deploy, e non ha bisogno di questo documento.

---

## 7. Stato di questa build

| | |
|---|---|
| pubblicata | **no** |
| commit | locale, sul ramo corrente |
| push | **non eseguito** |
| deploy | **non eseguito** |
| configurazione Firebase | `non-configurato`: l'account è inattivo e l'interfaccia lo dichiara |
| regole Firestore | scritte, **mai pubblicate né eseguite** |
| pipeline | scritta, **mai avviata**: nessuna esecuzione da cui leggere un esito |

La checklist di §2 non è stata percorsa perché richiede Node, npm, Java e
un progetto Firebase, che in questo ambiente non ci sono. I passi che si
potevano fare senza — identità della build coerente nei quattro punti,
determinismo dell'impronta, assenza di segreti, assenza di collisioni fra
globali — sono stati fatti, e i risultati sono in `TEST-REPORT.md`.
