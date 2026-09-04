# ARCHITECTURE.md

**Com'è fatto Pannello Tempo, e perché è fatto così.**

Build di riferimento: vedi `build.json`, campo `sorgenti`.

---

## 1. La forma: script globali, non moduli ES

Il pannello è composto da 60 file JavaScript che condividono lo **scope
globale**, caricati in ordine da `index.html`. Non sono moduli ES, non c'è
un impacchettatore, non c'è un passaggio di compilazione.

Non è pigrizia, ed è una scelta con un costo che vale la pena dichiarare.

**Perché così:** il pannello deve funzionare anche aperto da `file://`, con
un doppio clic, senza server. I moduli ES da `file://` sono bloccati dalla
politica di origine. Senza questa scelta, la versione a file unico — che è
la via di fuga per chi non vuole o non può pubblicare niente — non
esisterebbe.

**Che cosa costa:** l'ordine di caricamento è significativo, e un errore in
un modulo impedisce il caricamento di **tutti** i successivi lasciando la
pagina bianca. È già capitato. Per questo esistono:

- `js/ORDINE.txt`, che è la fonte dell'ordine;
- `strumenti/controlla-impronta.mjs`, che verifica che `ORDINE.txt`,
  `index.html` e `sw.js` contengano gli stessi moduli **nello stesso
  ordine**;
- `tests/avvio.test.js`, che carica tutto in un DOM finto e fallisce in
  mezzo secondo invece di lasciare scoprire il problema a un utente.

**Nessuna dipendenza a runtime.** Zero. Il pannello carica solo i propri
file, e questo ha una conseguenza di sicurezza concreta: non esiste una
catena di fornitura da cui possa arrivare codice ostile, ed è ciò che rende
sostenibile `script-src 'self'` nella Content Security Policy. Le
dipendenze in `package.json` servono ai collaudi e alla build, e non
finiscono nel sito.

### Il costo peggiore: un solo spazio dei nomi

Lo scope condiviso ha un modo di rompersi che merita una riga a parte,
perché è silenzioso. Se due moduli dichiarano `var X`, **vince l'ultimo
caricato** e il primo perde il proprio valore: nessuna eccezione, nessun
avviso, niente nella console.

È già accaduto due volte in questo progetto, e in entrambi i casi ha
disattivato codice che risultava funzionante:

- `LIMITI` in `js/sicurezza.js` contro `LIMITI` in `js/appcheck.js`: tutti i
  limiti di importazione — dimensione dei backup, numero di voci, dimensione
  e numero di eventi dei calendari, troncamento dei titoli — **non
  scattavano mai**;
- tre funzioni omonime fra `js/versioni.js` e `js/conflitti.js`, con
  conseguenza che le modifiche non risultavano da sincronizzare (§3).

Da qui `strumenti/controlla-globali.mjs`, che a ogni build cerca i nomi
dichiarati da più di un modulo e fallisce se ne trova. Sono 590 nomi globali
di primo livello: controllarli a occhio non è un piano.

Convenzione adottata: quando due moduli hanno bisogno dello stesso concetto,
il nome dice **di quale modulo è** — `LIMITI_IMPORT` e `LIMITI_INVIO`, non
due `LIMITI`. E si rinominano **entrambi**, perché un riferimento
dimenticato diventa così un `ReferenceError` rumoroso invece di un
`undefined` silenzioso.

---

## 2. Gli strati

```
┌─ presentazione ──────────────────────────────────────────────┐
│  render.js          il disegno completo della pagina         │
│  rendering.js       diffing del DOM: aggiorna, non ricrea    │
│  features/*.js      un'area ciascuno (ARC-001)               │
│  css/*.css          token, base, componenti, mobile,         │
│                     desktop, accessibilità — in quest'ordine │
├─ interazione ────────────────────────────────────────────────┤
│  events.js          un solo ascoltatore, `data-act`          │
│  drag.js            trascinamento nell'agenda                │
│  navigazione.js     le quattro viste                         │
│  accessibility.js   annunci per i lettori di schermo         │
├─ dominio ────────────────────────────────────────────────────┤
│  state.js           S, load, save, commit, normalizeData     │
│  tasks.js           viste derivate, area, nome accessibile   │
│  routine.js         routine contro task ricorrenti           │
│  arretrati, accumulo, suggerimenti, balance, fascia,         │
│  serie, priorities, templates, daily-closing, weekly-review  │
├─ persistenza e sincronizzazione ─────────────────────────────┤
│  sync-provider.js   il CONTRATTO: il dominio non conosce     │
│                     nessun fornitore                         │
│  sync.js            l'adattatore Firebase, e la lettura Gist │
│  coda.js            coda offline e stato leggibile           │
│  appcheck.js        limiti, ritmo, App Check                 │
│  account.js         sessione, uscita, audit dei segreti      │
│  versioni.js        versione per record (SYN-004)            │
│  conflitti.js       fusione per record                       │
│  migrations.js      catena delle migrazioni di schema        │
│  backup.js          copie di sicurezza locali                │
├─ piattaforma ────────────────────────────────────────────────┤
│  platform.js        adattatore: archivio, rete, capacità     │
│  config-firebase.js configurazione pubblica, dalla build     │
│  sw.js              service worker                           │
└──────────────────────────────────────────────────────────────┘
```

### La regola che tiene insieme la sincronizzazione

`js/sync-provider.js` definisce un contratto:

```
isConfigured()   l'utente ha fornito ciò che serve?
login(cred)      stabilisce una sessione
logout()         azzera credenziali e sessione, senza residui
pull()           legge lo stato remoto
push(testo)      scrive
deleteRemote()   cancella, o dichiara di non poterlo fare
getStatus()      stato leggibile, senza gergo
resolveConflict(scelta)
```

Il dominio chiama **solo** `provider()`. Non sa che esistano Firebase o
GitHub, e non deve saperlo: cambiare servizio significa scrivere un altro
adattatore, non toccare il dominio.

Ogni adattatore normalizza i propri errori in `{ titolo, causa, cosa }`. Il
dominio non interpreta codici HTTP.

Tre adattatori:

| | Stato | Note |
|---|---|---|
| `LocalOnlyProvider` | **predefinito** | non manda niente da nessuna parte |
| `FirebaseProvider` | unico provider consumer | `isConfigured()` richiede la configurazione dalla build **e** una sessione viva in memoria |
| `GistProvider` | **deprecato, sola lettura** | `isConfigured()` restituisce sempre `false`; `gistWrite()` è stata cancellata dal codice |

---

## 3. I dati

### Sul dispositivo

| Chiave | Contenuto |
|---|---|
| `pannello-tempo:v1` | il dataset (`S.data`) |
| `pannello-tempo:prefs` | tema, densità, sezioni chiuse, raggruppamento |
| `pannello-tempo:sync` | provider, auto, rev, dirty, `gist.id`, `fb.email`, `fb.uid` |
| `pannello-tempo:backup` | ultime 5 copie automatiche |
| `pannello-tempo:pre-migrazione` | copia grezza prima di una migrazione |
| `pannello-tempo:pulizia-legacy` | marcatore «pulizia già eseguita» |

**In `pannello-tempo:sync` non ci sono credenziali.** `saveSync()` scrive a
**lista chiusa**: aggiungere un campo segreto al modello non lo porta su
disco per distrazione, perché per arrivarci bisogna togliere il campo da
`CAMPI_SEGRETI` e aggiungerlo all'elenco di ciò che si scrive.

### Nel servizio, con un account

```
users/{uid}/profile/main
users/{uid}/datasets/current      ← quello che il pannello usa oggi
users/{uid}/records/{recordId}    ← previsto, non ancora usato
users/{uid}/backups/{backupId}
users/{uid}/tombstones/{recordId}
users/{uid}/sync/meta
pannello/{uid}                    ← percorso precedente, sola lettura
```

**L'UID è nel percorso, non in un campo del documento.** Così le regole lo
confrontano con `request.auth.uid` invece di fidarsi di ciò che il client
dichiara: un campo lo scrive il client, e un client può scrivere quello che
vuole.

### Sincronizzazione: per record, ma dentro un documento unico

Questo è il punto più facile da fraintendere, e va detto chiaro.

`js/versioni.js` dà a ogni record una voce in `data.versioni`:

```
mod     quando è stato modificato l'ultima volta, sul dispositivo
rev     la versione con cui è stato accettato dal servizio
sporco  modificato qui e non ancora inviato
del     lapide, per propagare la cancellazione
```

La fusione vera la fa **`fondiPerRecord()` in `js/conflitti.js`**: applica
tutto ciò che non è in conflitto e lascia in sospeso il resto, ed è il motivo
per cui due modifiche su voci diverse non producono un conflitto.

### Due generazioni nello stesso scope, e che cosa è costato

Qui c'è un debito da dichiarare, perché leggendo i file si prende la
conclusione sbagliata. `js/versioni.js` è una **generazione precedente**
della stessa funzione, superata da `js/conflitti.js`, e i due file
dichiarano **tre nomi identici**: `versioni`, `segnaModifica`,
`risolviRecord`. `conflitti.js` si carica dopo, quindi vince, e le tre
copie in `versioni.js` erano codice morto che sembrava vivo.

Non era innocuo. `aggiornaVersioni()` — che è in `versioni.js` ed è
**viva**, chiamata a ogni salvataggio — invocava `segnaModifica(id, quando)`
passando un istante. La firma viva è `segnaModifica(id, dati)`, dove il
secondo argomento è un insieme di dati: `versioni("2026-…")` restituiva un
registro usa e getta e il record di versione finiva lì. Risultato: **ogni
modifica salvata dal percorso normale non risultava da sincronizzare.** Le
cancellazioni sì, perché `segnaCancellazione(id)` ha un solo argomento.

Corretto, e le tre copie morte sono state rimosse. Ciò che resta di
`versioni.js` — `confrontaInsiemi`, `unisci`, `raccogliRecord`,
`differenzeRecord`, `accettaRevisione`, `versioneDi` — **non ha chiamanti**
fuori dal file: è la parte della vecchia generazione che nessuno usa. Non è
stata cancellata in questo passaggio perché non esiste ancora una prova
eseguibile del percorso di sincronizzazione, e rimuovere ottanta righe alla
cieca è più rischioso del debito. Le funzioni vive del file sono
`aggiornaVersioni`, `istantaneaRecord`, `raccogliRecord` (usata da queste
due), `segnaCancellazione` e `azzeraIstantanea`.

`strumenti/controlla-globali.mjs` gira a ogni build e fallisce se due moduli
dichiarano lo stesso nome. È la rete che mancava: con 60 file in un unico
scope, questa collisione non produce nessun errore, solo un valore perduto.

**Ma il trasporto è un documento unico.** `users/{uid}/datasets/current`
contiene l'intero dataset serializzato in un campo stringa. Quindi:

- il confronto per record è **client-side**: si scarica tutto, si confronta,
  si riscrive tutto;
- due dispositivi che scrivono nello stesso momento non producono una
  fusione lato server: vince l'ultimo, e il primo se ne accorge al giro
  successivo attraverso `rev`;
- il limite di 900 000 caratteri per documento è un limite del dataset
  intero, non di un record.

`users/{uid}/records/{recordId}` esiste nella struttura e nelle regole
proprio per poter passare a un documento per record senza rifare tutto.
Non è stato fatto: il costo è alto e il beneficio si vede solo con dataset
grandi o con molti dispositivi contemporanei.

---

## 4. Migrazioni di schema

`js/migrations.js`. Schema corrente: **6**.

| Da → A | Che cosa |
|---|---|
| 1 → 2 | giorno singolo → elenco di giorni |
| 2 → 3 | impostazioni esplicite, storico, diario |
| 3 → 4 | versione per record (SYN-004) |
| 4 → 5 | routine distinte dai task ricorrenti (ROU-002) |
| 5 → 6 | calendario distinto dalla sincronizzazione (CAL-001, MIG-001) |

Quattro regole, tutte verificate da `tests/unit/migrazioni.test.js`:

1. **copia di sicurezza prima**, in `pannello-tempo:pre-migrazione`;
2. **passi idempotenti**: eseguirli due volte non cambia il risultato;
3. **su una copia**: se un passo fallisce, i dati originali restano;
4. **niente invenzioni**: la 5→6 aggiunge due date di calendario e le lascia
   **nulle**, perché non sappiamo se e quando l'utente abbia esportato un
   file. Una data inventata sarebbe peggio di un'assenza dichiarata.

Il campo canonico dentro i dati è `v`. `schemaVersion` esiste solo nella
busta di esportazione. In caso di disaccordo si tiene il **più alto**:
applicare una migrazione già applicata è sicuro perché sono idempotenti,
saltarne una non lo è.

---

## 5. Disegno e diffing

`render()` produce l'HTML **intero** della pagina in una stringa.
`rendering.js` lo confronta con il DOM esistente e aggiorna solo ciò che è
cambiato: `sincronizza()` per struttura, `sincronizzaPerChiave()` per le
liste con `data-id`.

Perché non ricreare tutto: si perderebbero il fuoco, la posizione del
cursore, lo scorrimento e lo stato dei campi in scrittura. `data-keep`
segna i campi il cui valore va preservato attraverso un ridisegno.

**Una lezione imparata a caro prezzo:** il diffing sincronizzava solo gli
**attributi**. Per una casella nativa lo stato vero è la **proprietà**
`checked`, e appena l'utente clicca l'attributo resta dov'era. Il difetto si
manifesta quando lo stato cambia da qualcosa che non è il clic — una voce
completata su un altro dispositivo, un annullamento, un ripristino: i dati
dicono «fatto» e la casella resta vuota. Ora `sincronizzaProprieta()`
allinea `checked` e `disabled`. `value` no, di proposito: lo preserva già
`data-keep`, e sovrascriverlo cancellerebbe ciò che l'utente sta scrivendo.

---

## 6. Il service worker

`sw.js`. Cache versionata col nome della build (`pt-<8 cifre>`).

| Risorsa | Strategia | Perché |
|---|---|---|
| navigazione | rete, poi cache, poi `offline.html` | l'HTML deve essere quello nuovo |
| `.js`, `.css`, `build.json` | **rete, poi cache** | vedi sotto |
| immagini e icone | cache, poi rete | non cambiano fra build |
| chiamate ai servizi | **mai in cache** | conterrebbero dati personali |

**Perché codice e stile sono rete-prima.** Prima erano cache-prima, e
succedeva questo: la navigazione andava in rete, quindi `index.html` era
quello nuovo, mentre i moduli venivano serviti dalla cache, quindi vecchi.
HTML della build nuova con moduli della build vecchia: una funzione che la
pagina chiama e il modulo non definisce produce un `ReferenceError`, e la
pagina resta bianca.

Nessuno `skipWaiting()` automatico: l'aggiornamento lo decide l'utente, così
non perde ciò che sta scrivendo. Il worker nuovo attende e si attiva quando
la pagina gli manda `'aggiorna-ora'`.

---

## 7. Content Security Policy

In un `<meta>`, perché GitHub Pages non permette intestazioni HTTP.

```
default-src 'self'; script-src 'self';
style-src 'self' 'unsafe-inline'; style-src-elem 'self'; style-src-attr 'unsafe-inline';
img-src 'self' data:; font-src 'self';
connect-src 'self' https://api.github.com https://identitytoolkit.googleapis.com
  https://firestore.googleapis.com;
form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none';
upgrade-insecure-requests
```

Tre cose da sapere, tutte documentate in `SECURITY-REPORT.md` SEC-003:

1. **`style-src` ammette `'unsafe-inline'`** per gli attributi `style`. Con
   la regola severa l'agenda non si disegnava: `style-src 'self'` vieta
   anche l'attributo `style`, e l'agenda posiziona ogni blocco con `top` e
   `height` calcolati. `script-src` resta intatto, ed è quello che conta
   contro l'esecuzione di codice.
2. **`frame-ancestors` non ha effetto in un `<meta>`.** Il browser lo
   ignora e lo dichiara a ogni caricamento. La protezione da clickjacking
   vive in `js/boot.js`, in JavaScript, e vale finché il JavaScript gira.
3. **`X-Content-Type-Options` in un `<meta>` è inerte.** Resta perché
   GitHub Pages manda già l'intestazione, ma non è quella riga a darla.

---

## 8. Configurazione

`js/config-firebase.js` è **generato** da
`strumenti/genera-config-firebase.mjs` a partire dalle variabili
d'ambiente. Nel repository resta la versione `non-configurato`; quella di
produzione entra nell'artefatto pubblicato durante il deploy e non viene
committata.

Cinque ambienti: `produzione`, `staging`, `sviluppo`, `emulatore`,
`non-configurato`. Gli endpoint passano tutti da questo file, in un punto
solo: un modulo che se ne dimenticasse finirebbe a scrivere in produzione
durante un collaudo. E `vietaProduzioneNeiTest()` è la seconda difesa,
indipendente dalla prima.

Con `non-configurato`, `accountDisponibile()` è `false` e l'interfaccia
dichiara che l'account non è disponibile, invece di offrire un pulsante che
fallisce.

---

## 9. Che cosa NON c'è, e perché

| | Perché no |
|---|---|
| impacchettatore, transpilatore | il pannello deve funzionare da `file://` |
| framework | 60 file globali e un diffing di 200 righe bastano; un framework aggiungerebbe una dipendenza a runtime |
| dipendenze a runtime | nessuna catena di fornitura, e `script-src 'self'` sostenibile |
| un server proprio | la conseguenza è che nessuna credenziale riutilizzabile può essere custodita: niente «Resta collegato», niente OAuth per il calendario, niente Gist |
| cifratura end-to-end | `E2EE-DECISION.md`: il recupero dell'account, e la ricerca |
| telemetria | scelta di prodotto, dichiarata in `PRIVACY.md` |
| documento per record su Firestore | previsto nella struttura e nelle regole, non implementato: §3 |
| collaborazione, condivisione, pagamenti | fuori da questa iterazione |

Le tre righe centrali hanno un tratto in comune, e vale la pena vederlo:
**senza un servizio che custodisca i segreti, non si custodiscono segreti.**
È lo stesso ragionamento che ha portato a rimuovere «Resta collegato», a
deprecare Gist e a non collegare il calendario. Tre funzioni diverse, un
solo limite. Prometterne la custodia sarebbe la cosa peggiore delle tre.
