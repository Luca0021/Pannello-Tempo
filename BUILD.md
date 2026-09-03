# BUILD.md

**Come si costruisce una build, e perché l'identità va in quattro punti.**

---

## 1. In breve

```bash
node strumenti/build.mjs
```

Calcola l'impronta dei file serviti, la stampiglia nei quattro punti,
riscrive `build.json`.

```bash
node strumenti/controlla-impronta.mjs
```

Verifica che i quattro punti coincidano e che i moduli siano allineati fra
`js/ORDINE.txt`, `index.html` e `sw.js`. **Esce con 1 se qualcosa non
torna**, ed è il passo che va guardato prima di pubblicare.

Non c'è nient'altro: nessun impacchettatore, nessuna transpilazione, nessun
minificatore. Il contenuto del repository **è** il sito. `ARCHITECTURE.md`
§1 spiega perché, e che cosa costa.

## 2. L'impronta

SHA-256 su **percorso + contenuto** di ogni file servito, in ordine
alfabetico:

```js
h.update(f + '\n');
h.update(readFileSync(join(RADICE, f)));
```

Il percorso entra insieme al contenuto perché rinominare un file senza
cambiarne il contenuto è comunque una build diversa.

Da lì:

| | |
|---|---|
| `sorgenti` | le prime **12** cifre esadecimali |
| `cache` | `'pt-' + ` le prime **8** |

La cache **deriva** dall'impronta, non è un numero indipendente:
`controlla-impronta.mjs` verifica proprio questa derivazione, perché se non
vale significa che una delle due è stata scritta a mano.

### Che cosa NON entra

L'impronta descrive ciò che il **browser carica**. Elenco esplicito in
`FUORI`, in `strumenti/build.mjs`:

```
.git/  .github/  .claude/  tests/  strumenti/  firebase/
node_modules/  playwright-report/  test-results/
*.md  .env*  .gitignore  *.yml  package.json  package-lock.json
playwright.config.*  _collaudo.js  backlog.json
```

Se documenti, collaudi e strumenti entrassero, l'impronta cambierebbe
anche quando il sito è identico, e il service worker di ogni utente
riscaricherebbe l'intero scheletro per niente.

L'elenco è esplicito di proposito: un filtro implicito nasconde le
decisioni.

### La stessa esclusione, in due posti

`FUORI` in `strumenti/build.mjs` **è duplicato** in `_pt_build.ps1`, lo
strumento con cui l'impronta si calcola a mano quando Node non c'è, e i due
**devono coincidere esattamente**.

Non è un dettaglio di forma. È già andata male: `_pt_build.ps1` non
escludeva `package.json` e `playwright.config.js`, l'impronta risultava su
78 file invece di 76, e la conseguenza sarebbe stata che la **prima**
esecuzione in CI avrebbe prodotto un'impronta diversa senza che nulla fosse
cambiato — con il passo «coerenza dell'impronta» rosso e una diagnosi
confusa, e tutti i service worker a riscaricare.

Se aggiungi un file di sviluppo alla radice del progetto, va escluso in
**entrambi**.

### Determinismo

```bash
node strumenti/build.mjs --solo-impronta
```

Stampa solo l'impronta, senza data e senza scrivere niente: serve a
confrontare due calcoli consecutivi. La pipeline lo fa a ogni run, e il
confronto sarebbe inutile se ci fosse dentro un istante.

Verificato a ogni fase di questo lavoro: due calcoli consecutivi, impronta
identica.

## 3. I quattro punti

La stessa identità compare in quattro posti, e devono coincidere.

| Punto | Che cosa contiene | Chi lo legge |
|---|---|---|
| `build.json` | `sorgenti`, `cache`, `schema`, `costruito`, `commit`, `base` | il pannello, per dire quale build sta girando |
| `js/versione.js` | gli stessi valori, leggibili dal codice | il pannello, senza una richiesta di rete |
| `sw.js` | `var VERSIONE = 'pt-…'` | il service worker: **è il nome della cache** |
| `index.html` | `data-build`, `data-cache`, `data-schema`, `<meta name="build">` | la diagnostica, e chi guarda il sorgente |

**Perché quattro e non uno.** Ognuno viene letto in un momento in cui gli
altri non sono disponibili: `sw.js` gira in un worker che non ha il DOM,
`index.html` è la prima cosa che arriva e non può aspettare una `fetch`,
`js/versione.js` serve al codice prima che `build.json` sia stato scaricato.

**Che cosa succede se divergono.** Il service worker serve una build e la
pagina un'altra. È il difetto che produce una **pagina bianca** dopo un
aggiornamento, e si è già presentato: `ARCHITECTURE.md` §6.

Nessuno dei quattro si scrive a mano. `strumenti/build.mjs` li stampiglia
tutti nello stesso passaggio, e `strumenti/controlla-impronta.mjs` fallisce
se non coincidono.

## 4. Lo schema si legge, non si scrive

```js
const mig = readFileSync(join(RADICE, 'js/migrations.js'), 'utf8');
const mSchema = /var SCHEMA_ATTUALE = (\d+)/.exec(mig);
```

Se il pattern non c'è, il build **esce con 2** e non scrive niente. Meglio
non costruire che costruire con uno schema inventato.

`controlla-impronta.mjs` va oltre: verifica che `build.json.schema`
coincida con `SCHEMA_ATTUALE` **nel sorgente**, non solo con se stesso. Due
numeri di schema in due posti, prima o poi, divergono.

## 5. Moduli allineati

`controlla-impronta.mjs` confronta tre elenchi:

| | |
|---|---|
| `js/ORDINE.txt` | la **fonte** dell'ordine di caricamento |
| `index.html` | i 60 `<script src="…">` |
| `sw.js` | i 60 percorsi messi in cache |

Tre errori distinti, con tre conseguenze distinte:

- **in `ORDINE.txt` ma non in `index.html`**: il modulo non viene caricato,
  e tutto ciò che lo usa fallisce;
- **in `ORDINE.txt` ma non in `sw.js`**: funziona in locale e **si rompe
  offline**. È il tipo di disallineamento che nessuno nota fino al primo
  utente senza rete;
- **in `index.html` ma non in `ORDINE.txt`**: il modulo è caricato e la
  fonte dell'ordine non lo sa. Al prossimo riordino sparisce.

Stato attuale: **60 moduli, allineati in tutti e tre**.

## 6. La configurazione Firebase

`js/config-firebase.js` è **generato**, non scritto:

```bash
node strumenti/genera-config-firebase.mjs
```

Legge le variabili d'ambiente e produce il file. **Nel repository resta la
versione `non-configurato`**: la configurazione di produzione entra
nell'artefatto durante il deploy e non viene mai committata.

Non perché la `apiKey` sia un segreto — non lo è, ed è pubblica per
costruzione: `SECURITY-REPORT.md` SEC-002. Perché un progetto reale
committato viene usato per sbaglio da un collaudo, e i collaudi scrivono.

`vietaProduzioneNeiTest()` è la seconda difesa, indipendente dalla prima.

## 7. Ordine delle operazioni

1. `node strumenti/genera-config-firebase.mjs` — se serve una
   configurazione (in CI: dai segreti del repository);
2. `node strumenti/build.mjs` — impronta e stampigliatura;
3. `node strumenti/controlla-impronta.mjs` — coerenza;
4. `node strumenti/controlla-segreti.mjs` — nessun segreto nei file
   serviti;
5. `node strumenti/backlog.mjs` — la matrice e il documento coincidono;
6. le prove — `RUN-CI.md`.

Il passo 2 **prima** del 3: il controllo verifica ciò che il build ha
scritto. Il passo 4 **dopo** il 2: `build.json` viene riscritto, e va
controllato anche quello.

## 8. Se Node non c'è

`_pt_build.ps1` fa i passi 2 e la sincronizzazione col repository, in
PowerShell. **Non è nel repository** e non fa parte della release: è uno
strumento di lavoro, e resta tale perché duplicare la logica del build in
due linguaggi è già costato un difetto (§2).

Non fa i passi 3, 4, 5 e non esegue nessuna prova. Chi lo usa deve saperlo.

## 9. Che cosa NON fa il build

| | |
|---|---|
| non minifica | i sorgenti sono ciò che gira, e leggibili |
| non impacchetta | il pannello deve funzionare da `file://` |
| non tocca `js/ORDINE.txt` | è la fonte: la genera una persona, non uno strumento |
| non aggiorna il changelog | lo scrive chi sa perché ha cambiato qualcosa |
| non aggiorna i ticket | `BACKLOG-COVERAGE.md` §«Come si chiude un PARZIALE» |
| non pubblica niente | il deploy è un passo separato: `DEPLOYMENT-REPORT.md` |
