# MIGRATIONS.md

**Come cambia la forma dei dati senza perderli.**

Schema corrente: **6**. Sorgente: `js/migrations.js`.

---

## 1. Il problema, detto una volta

I dati di chi usa il pannello sono sul suo dispositivo. Non c'è un database
centrale da migrare una notte con un DBA che guarda. Ogni utente arriva con
la forma che aveva l'ultima volta che ha aperto il pannello — che può essere
sei mesi fa, cioè quattro versioni di schema fa — e la migrazione avviene
nel suo browser, una volta sola, mentre lui aspetta che la pagina si apra.

Se va male, i dati sono suoi e sono gli unici che ha.

Da qui le quattro regole.

## 2. Le quattro regole

### Copia di sicurezza prima

`salvaBackupPreMigrazione(grezzo)` scrive in
`pannello-tempo:pre-migrazione` la stringa **grezza** letta dal disco, prima
di qualunque interpretazione, con la data.

Grezza, non l'oggetto già analizzato: se il difetto sta nell'analisi, un
oggetto già analizzato è già rovinato.

### Passi idempotenti

Ogni passo deve poter girare due volte senza cambiare il risultato la
seconda. Da qui la forma ricorrente in tutti i passi:

```js
if (d.settings.gistMigrato === undefined) d.settings.gistMigrato = false;
```

`=== undefined`, non `if (!d.settings.gistMigrato)`. La seconda forma
riscriverebbe a `false` un valore che l'utente ha portato a `true`, cioè
gli riproporrebbe una migrazione che ha già fatto.

L'idempotenza non è un vezzo: `migra()` esegue **l'ultimo passo** anche
quando i dati sono già alla versione corrente.

```js
if (v === SCHEMA_ATTUALE) {
  var ultimo = PASSI_MIGRAZIONE[PASSI_MIGRAZIONE.length - 1];
  dati = ultimo.esegui(dati);
  ...
}
```

Serve a chi ha dati di schema 6 creati da una build che aveva il campo 6 ma
non ancora quello aggiunto in coda: i campi mancanti vengono completati
senza cambiare versione. Con passi non idempotenti, questa riga sarebbe una
perdita di dati a ogni avvio.

### Su una copia

```js
try { copia = JSON.parse(JSON.stringify(dati)); }
catch (e) { return { dati: dati, log: [...], esito: "errore" }; }
```

I passi girano su `copia`. Se uno solleva un'eccezione, il `catch`
restituisce `dati`, cioè **l'originale intatto**. Non c'è nessuno stato
intermedio in cui metà dei passi è applicata e metà no.

### Niente invenzioni

Due esempi, entrambi nel codice con il motivo scritto accanto.

**3 → 4**, versione per record: non conoscendo la data di modifica dei record
esistenti, usa l'ultima sincronizzazione, e se non c'è il momento della
migrazione. Tutti i record risultano modificati nello stesso istante, ed è
la verità.

**5 → 6**, calendario: le due date restano `null` e l'interfaccia dice
«mai», perché non sappiamo se e quando l'utente abbia esportato un file
`.ics`. Una data inventata avrebbe l'aspetto di un dato.

Terzo esempio, **4 → 5**: tutto ciò che si ripete diventa «ricorrente», che
è esattamente il comportamento precedente. Il pannello **non** indovina
quali voci fossero abitudini: riclassificare i dati da soli cambia il senso
di ciò che l'utente ha scritto senza chiederglielo. La scelta resta sua,
voce per voce.

## 3. La catena

| Da → A | Nome nel codice | Che cosa fa |
|---|---|---|
| 1 → 2 | giorno singolo → elenco di giorni | `i.day` diventa `i.days[]`; i record incompleti vengono saltati, non fanno cadere la migrazione |
| 2 → 3 | impostazioni esplicite, storico e diario | crea `settings` dai predefiniti, sposta `theme` dentro `settings`, crea `chiusure`, `revisioni`, `completamenti`, `modelli`, `syncMeta`; «in attesa» acquisisce la causa `bloccatoDa` |
| 3 → 4 | versione per record (SYN-004) | crea `versioni{}` per items, capture, links, modelli, obiettivi; `syncMeta.perRecord = true` |
| 4 → 5 | routine distinte dai task ricorrenti (ROU-002) | `freq !== "once"` senza `tipo` diventa `tipo: "ricorrente"`; aggiunge `routineSpiegata` |
| 5 → 6 | calendario distinto dalla sincronizzazione (CAL-001, MIG-001) | aggiunge `ultimaEsportazioneIcs`, `ultimaImportazioneIcs` (entrambe `null`) e `gistMigrato: false` |

Nessun passo cancella un campo. L'unica rimozione in tutta la catena è
`delete i.day` nel passo 1 → 2, dopo che il valore è stato copiato in
`i.days`, e `delete d.schemaVersion` in `normalizzaVersione()`, dopo che il
valore è stato letto.

## 4. Il campo canonico, e un difetto che c'era

Dentro i dati salvati la versione è **`v`**, e solo quella.
`schemaVersion` esiste soltanto nella busta di esportazione:

```json
{ "formato":"pannello-tempo", "schemaVersion":3, "esportatoIl":"…",
  "dati": { "v":3, "…":"…" } }
```

Erano **due nomi per la stessa cosa**, e questo era un difetto: chi
importava un file scritto a mano poteva metterne uno solo, e il pannello
leggeva l'altro. `versioneDati()` ora legge entrambi e in caso di
disaccordo tiene il **più alto**:

```js
var v = Math.max(a, b);
```

Il più alto, non il più basso, e non è indifferente. Applicare una
migrazione già applicata è sicuro — sono idempotenti, §2. Saltarne una non
lo è: si finirebbe a far girare il pannello su una forma che il codice non
si aspetta più.

`normalizzaVersione()` riallinea `v` e rimuove il doppione, così il file non
resta ambiguo una seconda volta.

## 5. I quattro esiti di `migra()`

| Esito | Quando | Che cosa restituisce |
|---|---|---|
| `migrato` | la versione era inferiore | la copia migrata, e il registro dei passi |
| `aggiornato` | la versione era già 6 | i dati con gli eventuali campi mancanti completati |
| `troppo-recente` | la versione è maggiore di 6 | **i dati intatti**, senza toccarli |
| `errore` | un passo ha sollevato un'eccezione, o i dati sono illeggibili | **l'originale**, con il motivo |

`troppo-recente` è il caso di chi apre il pannello su un dispositivo che ha
una build vecchia dopo averlo usato su una nuova. La cosa giusta è **non
fare niente**: una migrazione a rovescio significherebbe cancellare i campi
che la build vecchia non conosce, cioè perdere dati per far funzionare
un'interfaccia.

## 6. Tornare indietro

`ripristinaPreMigrazione()`, raggiungibile dalle impostazioni. Cinque
passaggi:

1. legge `pannello-tempo:pre-migrazione`, e se non c'è lo dice;
2. verifica che sia analizzabile e che contenga un elenco `items`;
3. **salva una copia automatica prima di ripristinare**, perché tornare
   indietro dal ripristino deve essere possibile quanto farlo;
4. crea uno `snapshot()` annullabile;
5. sostituisce `S.data` e **riapplica la migrazione**.

Il quinto passaggio sorprende, e ha un motivo: far girare il pannello su
uno schema che il codice non si aspetta più sarebbe un difetto peggiore di
quello da cui si sta scappando. Chi vuole i dati esattamente come erano usa
**«Scarica questa copia»**, che non li tocca e produce un file.

### Un difetto corretto, che vale la pena raccontare

`backupPreMigrazione()` esisteva, era corretta, e **nessun modulo la
chiamava**. Intanto `js/state.js`, in caso di migrazione fallita, diceva
all'utente: «Trovi la copia di sicurezza in Impostazioni».

In Impostazioni non c'era niente. La copia stava in memoria locale e nessuna
schermata la mostrava.

Lo stesso valeva per `registroMigrazioniTesto()` e per l'intero sistema di
copie automatiche di `js/backup.js`: `elencoBackup()` e `ripristinaBackup()`
erano anch'esse senza chiamanti, pur essendo alimentate a ogni azione
distruttiva.

È il tipo di difetto che non si trova leggendo il modulo — il modulo è
giusto — e che si trova solo seguendo la promessa fatta all'utente fino a
vedere se qualcosa la mantiene. Il pannello che le mostra tutte vive in
`js/features/settings-ui.js`.

## 7. Aggiungere un passo

1. **alza `SCHEMA_ATTUALE`** in `js/migrations.js`;
2. **aggiungi il passo** in coda a `PASSI_MIGRAZIONE`, con `da`, `a`, `nome`
   e `esegui`. Il nome finisce nel registro che l'utente può esportare:
   scrivilo per lui, non per te;
3. **aggiungi i campi nuovi a `impostazioniPredefinite()`**, se sono
   impostazioni, con lo stesso valore che dà il passo. Se i due divergono, un
   utente nuovo e un utente migrato si ritrovano con pannelli diversi;
4. **rendilo idempotente**: `=== undefined`, non `if (!…)`;
5. **aggiungi una prova** in `tests/unit/migrazioni.test.js` con dati della
   versione precedente, reali, non minimi: quella prova è l'unica cosa che
   sta fra un utente e la perdita dei suoi dati;
6. **rigenera la build**: lo schema viene letto da `js/migrations.js` e
   stampigliato in `build.json`, `js/versione.js`, `sw.js` e `index.html`.
   Non si scrive a mano in nessuno dei quattro.

Il passo 5 non è una formalità. Le prove di `tests/unit/migrazioni.test.js`
sono scritte e **non sono mai state eseguite** in questo ambiente, perché
Node non c'è: `TEST-REPORT.md` §2. I cinque casi che coprono — 5 → 6 con
dati reali, la copia di sicurezza, l'idempotenza, lo schema 99, la catena
1 → 6 — sono stati verificati **a mano nel browser**, che è meno ripetibile
ma non meno reale.

## 8. Dove sono le migrazioni che NON sono di schema

Due cose che assomigliano a migrazioni e non lo sono:

- **la pulizia dei token da versioni precedenti** —
  `ripulisciTokenPersistenti()` in `js/account.js`. Gira all'avvio, una
  volta, segnata da `pannello-tempo:pulizia-legacy`. Non cambia la forma dei
  dati: rimuove credenziali che una build precedente aveva scritto su disco.
  `SECURITY-REPORT.md` SEC-001;
- **la migrazione dei dati da Gist** — `GIST-MIGRATION.md`. È un
  trasferimento fra servizi, avviato dall'utente, non un cambio di schema.
  Lo schema 6 aggiunge solo il marcatore `gistMigrato` che dice se è stato
  fatto.
