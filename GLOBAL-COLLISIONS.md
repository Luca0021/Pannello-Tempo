# GLOBAL-COLLISIONS.md

**I nomi globali del pannello, le due collisioni che hanno prodotto difetti
reali, e il controllo che le impedisce.**

Build di riferimento: vedi `build.json`, campo `sorgenti`.

---

## 1. Perché questo documento esiste

I 60 moduli di `js/` condividono un **unico scope globale**: non sono moduli
ES, non c'è un impacchettatore, e `index.html` li carica in sequenza
nell'ordine di `js/ORDINE.txt`. La ragione è in `ARCHITECTURE.md` §1 — il
pannello deve funzionare aperto con un doppio clic da `file://`, dove i
moduli ES sono bloccati dalla politica di origine.

Il costo è una modalità di guasto che non somiglia a un guasto:

> se due moduli dichiarano `var X`, **vince l'ultimo caricato** e il primo
> perde il proprio valore. Nessuna eccezione. Nessun avviso. Niente nella
> console. Il codice del primo modulo continua a girare, leggendo campi
> `undefined` da un oggetto che non è il suo.

È accaduto due volte in questo progetto. In entrambi i casi ha disattivato
codice che risultava scritto, corretto e funzionante.

---

## 2. Collisione 1 — `LIMITI`: tutti i limiti di importazione disattivati

| | |
|---|---|
| Nomi in conflitto | `LIMITI` |
| Dichiarato in | `js/sicurezza.js` (limiti di importazione) e `js/appcheck.js` (limiti di invio) |
| Ordine di caricamento | `sicurezza.js` è 10°, `appcheck.js` è 22° |
| Vincitore a runtime | `appcheck.js` |
| Perdente | `sicurezza.js`, in silenzio |

Il codice di `js/sicurezza.js` era questo, e leggendolo non c'era niente da
eccepire:

```js
if (byte !== undefined && byte > LIMITI.backupByte) { … rifiuta … }
```

A runtime `LIMITI` era l'oggetto di `appcheck.js`, quindi
`LIMITI.backupByte` valeva `undefined`, e **`byte > undefined` è `false`**.
Il confronto non solleva niente: restituisce falso e il controllo passa
oltre.

### Che cosa era disattivato

| Limite dichiarato | Valore | Comportamento reale |
|---|---|---|
| dimensione di un backup importato | 8 MB | nessun limite |
| voci in un backup | 5000 | nessun limite |
| dimensione di un file di calendario | 4 MB | nessun limite |
| eventi in un file di calendario | 500 | nessun limite |
| lunghezza di un titolo | 500 caratteri | nessun troncamento |
| lunghezza di una nota | 5000 caratteri | nessun troncamento |

Tre ticket di sicurezza — SEC-004, SEC-005, SEC-006 — risultavano
**COMPLETATO** sulla base di controlli che non scattavano mai.

### Come è emerso

Non leggendo il codice: **eseguendolo**. Scrivendo `SECURITY-REPORT.md` ho
provato a far scattare i controlli che il documento dichiarava, e sei prove
su sedici sono fallite. Per cinque volte ho supposto che fosse la mia misura
a essere sbagliata — è quasi sempre così — e alla sesta ho stampato
`LIMITI` e ho visto un oggetto con `tentativiMax` e `attesaMassima` dentro
il modulo dell'importazione.

### Correzione

I due nomi sono ora distinti, e sono stati rinominati **entrambi**:

| Prima | Dopo | Modulo |
|---|---|---|
| `LIMITI` | `LIMITI_IMPORT` | `js/sicurezza.js` |
| `LIMITI` | `LIMITI_INVIO` | `js/appcheck.js` |

Rinominarli entrambi non è pignoleria. Se ne avessi rinominato uno solo, un
riferimento dimenticato all'altro avrebbe continuato a leggere l'oggetto
sbagliato in silenzio. Rinominandoli entrambi, il nome generico `LIMITI` non
esiste più: un riferimento dimenticato diventa un **`ReferenceError`
rumoroso**, che ferma il modulo e si vede.

`js/validazione.js` usava già `LIMITI_TASK`, quindi la convenzione esisteva
e non era stata seguita.

### Verifica dopo la correzione

Eseguita nel browser sulla build servita su `http://localhost`. Quindici
prove, tutte passate: i due oggetti esistono con i propri valori, il nome
generico non esiste più, e tutti e sei i limiti respingono ciò che devono
respingere dicendo **quanto** hanno trovato («5100 attività», «520 eventi»)
invece di «troppe». Il dettaglio è in `SECURITY-REPORT.md`.

Le stesse prove sono in `tests/unit/limiti-e-versioni.test.js`, **non
eseguite** in questo ambiente per assenza di Node.

---

## 3. Collisione 2 — tre funzioni: le modifiche non risultavano da sincronizzare

| | |
|---|---|
| Nomi in conflitto | `versioni`, `segnaModifica`, `risolviRecord` |
| Dichiarati in | `js/versioni.js` e `js/conflitti.js` |
| Ordine di caricamento | `versioni.js` è 16°, `conflitti.js` è 17° |
| Vincitore a runtime | `conflitti.js` |
| Perdente | `js/versioni.js`, in silenzio |

I due file sono **due generazioni della stessa funzione**: la
sincronizzazione per record. `conflitti.js` è la generazione viva;
`versioni.js` è quella precedente, mai rimossa.

Questa collisione è peggiore della prima, perché le **firme non
coincidevano**:

```js
// js/versioni.js  (morta)
function segnaModifica(id, quando)   // secondo argomento: un istante ISO
// js/conflitti.js  (viva)
function segnaModifica(id, dati)     // secondo argomento: un insieme di dati
```

E `aggiornaVersioni()` — che sta in `versioni.js` ed è **viva**, chiamata da
`js/state.js` a ogni salvataggio — passava un istante:

```js
segnaModifica(id, quando);           // «quando» è una data ISO
```

L'implementazione viva faceva `versioni(dati)` con `dati` uguale a una
stringa, rispondeva `typeof d !== "object"` e restituiva **un registro usa e
getta**. Il record di versione veniva scritto lì dentro e buttato via.

### Conseguenza

**Ogni modifica salvata dal percorso normale non risultava da
sincronizzare.** Il campo `sporco` non veniva mai messo a `true`, quindi:

- con un account collegato, una voce modificata su un dispositivo **non
  sarebbe mai arrivata** sull'altro;
- `fondiPerRecord()` vedeva quel record come invariato.

Le **cancellazioni** funzionavano, perché `segnaCancellazione(id)` prende un
solo argomento. Le modifiche fatte da `js/serie.js` funzionavano, perché
chiama `segnaModifica(id)` senza il secondo argomento. Solo il percorso
principale era rotto — il che spiega perché non si era visto.

### Prova, prima e dopo

Eseguita nel browser:

```
prima:  segnaModifica(id, "2026-09-03T…")  →  nessun record scritto
        modifica + salvataggio             →  «la modifica non risulta da sincronizzare»
dopo:   segnaModifica(id)                  →  { mod:…, rev:0, sporco:true, del:false }
        modifica + salvataggio             →  sporco:true, del:false
        voce non toccata                   →  sporco:false   (nessun conflitto falso)
        cancellazione                       →  del:true, sporco:true   (lapide)
```

### Correzione

1. `aggiornaVersioni()` chiama `segnaModifica(id)` senza il secondo
   argomento. L'istante lo mette la funzione da sé, e la differenza fra il
   momento del confronto e quello della scrittura è di microsecondi.
2. Le tre definizioni morte sono state **rimosse** da `js/versioni.js`, con
   una nota al loro posto che dice dov'è l'implementazione viva. Erano già
   morte a runtime: rimuoverle non cambia il comportamento, cambia ciò che
   un lettore conclude.

### Che cosa resta da fare, e perché non l'ho fatto qui

Il resto di `js/versioni.js` — `confrontaInsiemi`, `unisci`,
`raccogliRecord`, `differenzeRecord`, `accettaRevisione`, `versioneDi`,
`TIPI_SINCRONIZZABILI` — **non ha chiamanti** fuori dal file. È la parte
della vecchia generazione che nessuno usa.

Non è stata cancellata in questo passaggio: non esiste ancora una prova
eseguibile del percorso di sincronizzazione, e rimuovere ottanta righe alla
cieca è più rischioso del debito. Le funzioni **vive** del file sono
`aggiornaVersioni`, `istantaneaRecord`, `raccogliRecord` (usata dalle prime
due), `segnaCancellazione` e `azzeraIstantanea`.

`ARCHITECTURE.md` §3 lo dichiara, così chi legge `versioni.js` non conclude
che `confrontaInsiemi()` sia il meccanismo in uso — che è esattamente
l'errore che questo documento aveva commesso nella sua prima stesura.

---

## 4. Il controllo

`strumenti/controlla-globali.mjs`, eseguito dalla pipeline nel lavoro
*build*, passo **«Nessuna collisione fra nomi globali»**, prima dei collaudi
unitari.

```bash
node strumenti/controlla-globali.mjs
```

Legge `js/ORDINE.txt` — la stessa fonte che usa `index.html` — e per ogni
modulo raccoglie le dichiarazioni di primo livello. Esce con codice 1 se un
nome è dichiarato da più di un modulo, oppure due volte nello stesso file.

La stessa verifica è la **prima prova** di
`tests/unit/limiti-e-versioni.test.js`, così vale anche eseguendo solo i
collaudi unitari.

### Stato attuale

| | |
|---|---|
| moduli esaminati | 60 |
| nomi globali di primo livello | **590** |
| di cui `var` | 106 |
| di cui `function` | 484 |
| di cui `let`/`const` | 0 |
| **collisioni fra moduli** | **0** |
| doppioni dentro un modulo | 0 |

Cinquecentonovanta nomi in un solo spazio: controllarli a occhio non è un
piano.

### Il limite del controllo, dichiarato

Riconosce le dichiarazioni che **cominciano a colonna 0**. È una regola
sintattica grossolana, non un parser, e la scelta è deliberata: in questo
codice le dichiarazioni interne a una funzione sono sempre rientrate — sono
1139 e vengono correttamente ignorate — mentre quelle di primo livello non
lo sono mai.

Che cosa **non** vedrebbe:

- una dichiarazione di primo livello scritta rientrata (per esempio dentro
  un `if` a livello di modulo);
- un globale implicito creato da un'assegnazione senza dichiarazione
  (`X = 1` dentro una funzione, senza `var`);
- un'assegnazione esplicita a `window.X`.

Un falso positivo si vedrebbe subito e si corregge; un falso negativo di
questo tipo è il difetto che stiamo cercando. Se in futuro serve una
garanzia più forte, la strada è sostituire l'euristica con un parser
(`acorn` o simili) e chiedere l'elenco dei binding di primo livello — un
lavoro di poche righe, che ha senso quando il progetto avrà una dipendenza
di sviluppo in più da giustificare.

---

## 5. Convenzione

Da qui in avanti:

1. **Il nome dice di quale modulo è.** `LIMITI_IMPORT` e `LIMITI_INVIO`, non
   due `LIMITI`. `LIMITI_TASK` in `js/validazione.js` era già così.
2. **Si rinominano entrambi**, non uno solo: il nome generico deve sparire,
   perché un riferimento dimenticato deve rompersi a voce alta.
3. **Un nome generico in un modulo nuovo è un rischio, non un'eleganza.**
   Quattro sono ancora in uso in una sola dichiarazione — `SOGLIE`
   (`js/lavoro.js`), `TABELLE` (`js/conflitti.js`), `PROVIDER`
   (`js/sync-provider.js`), `RITMO` (`js/appcheck.js`) — e vanno bene finché
   restano unici; il controllo se ne accorge il giorno in cui non lo sono.
4. **Due generazioni della stessa funzione non convivono.** Se la seconda
   sostituisce la prima, la prima si rimuove nello stesso passaggio. La
   collisione di §3 è nata dal non averlo fatto.
