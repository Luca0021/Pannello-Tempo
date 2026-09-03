# RUN-CI.md

**Come avviare la verifica, come leggerla, e che cosa restituire perché il
backlog possa essere aggiornato con esiti veri.**

---

## 1. Avviare a mano dall'interfaccia di GitHub

1. apri il repository su GitHub;
2. scheda **Actions**;
3. nella colonna a sinistra scegli **Verifica**;
4. pulsante **Run workflow**, in alto a destra;
5. **Branch**: lascia `main`, o scegli il ramo da provare;
6. **Ambiente**: lascia `emulatore`. È il valore predefinito, e il progetto
   di produzione non è raggiungibile da qui per costruzione;
7. **Rigenera gli scatti di riferimento**: lascia **spento**. Serve solo la
   prima volta o dopo un cambiamento voluto dell'aspetto — vedi §5;
8. **Run workflow**.

`workflow_dispatch` è dichiarato in `.github/workflows/verifica.yml`, quindi
il pulsante c'è. Parte anche da sola su ogni push su `main` e su ogni pull
request.

## 2. Avviare in locale

```bash
# una volta sola
npm install
npx playwright install --with-deps chromium firefox
cp .env.example .env          # e compila, vedi FIREBASE-SETUP.md

# la sequenza breve: segreti, build, coerenza, unit, integrazione, avvio
npm run verifica

# le regole Firestore (serve Java 17+)
npm run test:regole

# i collaudi in browser (avvia il server da sé)
npm run test:browser
```

Il comando esatto per le sole regole, quello da incollare se qualcosa non
torna:

```bash
npx firebase emulators:exec --only firestore,auth \
  --project demo-pannello "node tests/security/regole.test.js"
```

## 3. I tre lavori, e cosa fa ognuno

| Lavoro | Che cosa esegue |
|---|---|
| **build** | Node 20, Python 3.12, Java 17, Firebase CLI · genera la configurazione · **cerca segreti nell'albero** · build · **doppia build deterministica** · coerenza dell'impronta nei quattro punti · **backlog coerente con la matrice** · unit · integrazione · avvio · **regole Firestore su Emulator** |
| **browser** (× chromium, firefox) | terminologia · indicatore Lavoro/Vita e regressione visiva · sentinelle dei segreti · cancellazione · CSP, PWA, offline, responsive · accessibilità |
| **verdetto** | riepilogo unico, e fallisce se uno dei due è rosso |

Il controllo dei segreti gira **prima di tutto**: se un segreto è entrato nel
repository, tutto il resto è secondario.

## 4. Leggere gli esiti

Apri la run e guarda **Summary**: il lavoro *verdetto* scrive una tabella
con l'esito di ciascun lavoro e l'impronta della build.

Per il dettaglio di una prova fallita: clicca il lavoro, apri il passo
rosso. Playwright stampa il nome della prova, l'asserzione e il valore
ottenuto.

### Artefatti da scaricare

In fondo alla pagina della run, sezione **Artifacts**:

| Artefatto | Contiene | Quando serve |
|---|---|---|
| `build` | `build.json`, le due impronte | per verificare il determinismo |
| `playwright-chromium` | rapporto HTML, tracce, scatti, riferimenti visivi | ogni fallimento in browser |
| `playwright-firefox` | idem | idem |

Il rapporto HTML si apre in un browser: `playwright-report/index.html`.
Contiene, per ogni prova fallita, lo scatto del momento e la traccia
navigabile passo per passo.

## 5. La prima volta: la regressione visiva fallisce di proposito

Non esistendo riferimenti, Playwright li crea e il passo esce in errore. **È
voluto:** uno scatto appena generato non dimostra che l'aspetto sia giusto,
dimostra com'era in quel momento.

Cosa fare:

1. scarica l'artefatto `playwright-chromium`;
2. apri `tests/ui/ui006.spec.js-snapshots/` e **guarda gli scatti**. In
   particolare: la barra colorata accanto alla casella non deve esserci, il
   badge d'area deve avere il punto **e** la parola, le azioni non devono
   sovrapporsi;
3. se ti convincono, aggiungili al repository:

```bash
git add tests/ui/ui006.spec.js-snapshots
git commit -m "riferimenti visivi UI-006 approvati"
```

Dalla run successiva il passo è verde, e da quel momento un cambiamento
d'aspetto non voluto lo fa tornare rosso.

**Non** usare l'input *Rigenera gli scatti di riferimento* per far passare
una prova rossa: quello sovrascrive i riferimenti con lo stato attuale, cioè
approva il cambiamento senza guardarlo. Si usa solo dopo aver deciso che
l'aspetto nuovo è quello giusto.

## 6. Che cosa fa fallire la pipeline, di proposito

Oltre ai collaudi, questi controlli sono progettati per bloccare:

| Controllo | Fallisce se |
|---|---|
| segreti nell'albero | un token, una chiave, una private key o un service account è versionato |
| doppia build | due build consecutive danno impronte diverse |
| coerenza dell'impronta | `build.json`, `js/versione.js`, `sw.js` e `index.html` non coincidono |
| moduli allineati | un modulo è in `ORDINE.txt` ma non in `index.html`, o non in `sw.js` (si romperebbe offline) |
| sentinelle | un token finisce in `localStorage`, `sessionStorage`, IndexedDB, Cache API, URL o cookie |
| export | un'esportazione contiene credenziali |
| terminologia | l'interfaccia consumer mostra Firebase, Firestore, Gist, PAT, UID, API key o «provider» |
| aree separate | una parola dell'Account compare nella sezione Calendario, o viceversa |
| trasparenza | manca una delle tre affermazioni su ciò che **non** è protetto |
| Gist | risulta selezionabile, o accetta una scrittura |
| regole cross-user | un utente accede ai dati di un altro |
| cancellazione | dichiara successo lasciando il documento leggibile |
| UI-006 | la barra d'area ricompare accanto alla casella |
| UI-006 | l'area è comunicata dal solo colore (badge senza testo) |
| bersagli | un comando è sotto 24×24 |
| contrasto | un testo è sotto 4,5:1, o il punto d'area sotto 3:1 |
| scorrimento | la pagina eccede la larghezza della finestra |
| backlog | un conteggio di BACKLOG-COVERAGE.md non coincide con backlog.json, o un ticket COMPLETATO si appoggia a una verifica dichiarata non eseguita |

## 7. Riprovare

- **una singola prova**: `npx playwright test -g "parte del nome"`;
- **un solo lavoro**: nella pagina della run, *Re-run jobs → Re-run failed
  jobs*;
- **tutto**: *Re-run all jobs*.

Attenzione: `Re-run failed jobs` riusa gli artefatti dei lavori riusciti. Se
hai cambiato il codice, serve una run nuova.

## 8. Che cosa restituire per aggiornare il backlog

Gli stati dei ticket in `BACKLOG-COVERAGE.md` **non** si aggiornano sulla
sola esistenza della pipeline. Servono esiti reali. Per ognuno:

| Ticket | Passa a COMPLETATO solo se | Cosa serve |
|---|---|---|
| **SEC-002** | il passo *Regole Firestore su Emulator* riporta `falliti: 0` | l'output completo del passo, 14 righe `ok` |
| **UI-006** | la regressione visiva è verde **con riferimenti approvati** | l'esito del passo e il commit che ha approvato gli scatti |
| **PRV-002** | il passo *Cancellazione* è verde su entrambi i browser | l'output del passo |
| **TST-003/004/005/006** | i rispettivi passi sono verdi | l'esito per browser |
| **MOB-001/002** | i passi responsive e PWA sono verdi | l'esito, e su quali viewport |
| **A11Y-\*** | il passo *Accessibilità* è verde | l'output di axe, comprese le violazioni ignorate e il perché |
| **SEC-003** | il passo *CSP* è verde | l'output, e la conferma che l'agenda si disegna |

In pratica, incolla o allega:

1. l'**URL della run** (o il suo numero);
2. il **commit** su cui è girata;
3. lo **stato dei tre lavori**;
4. per ogni passo rilevante: **passati, falliti, saltati**;
5. i **nomi** delle prove fallite, se ce ne sono;
6. gli **artefatti** prodotti.

Bastano anche solo i nomi delle prove fallite: da quelli si capisce se il
difetto è nella prova o nel prodotto.

## 9. Che cosa aspettarsi la prima volta

Non che passi tutto. Le prove in browser non sono mai girate: è probabile
che due o tre falliscano per attese troppo brevi o per selettori che si
aspettano dati diversi da quelli che trovano.

**Quello che conta è la natura dei fallimenti.**

Se sono di quel tipo, sono difetti delle prove e si correggono in
un'iterazione. Se invece:

- una regola cross-user lascia passare un accesso,
- un token compare fra le sentinelle,
- la cancellazione dichiara successo lasciando il documento leggibile,
- la CSP blocca una risorsa necessaria,

quelli sono difetti veri del pannello, ed è esattamente per trovarli che la
pipeline esiste.

## 10. Finché non gira

Restano **PARZIALE**, e non vanno dichiarati altrimenti: SEC-002, SEC-003,
SEC-009, PRV-002, UI-006, TST-003, TST-004, TST-005, TST-006, TST-007,
MOB-001, MOB-002, A11Y-004, A11Y-005, A11Y-006.

`TEST-REPORT.md` elenca, per ognuno, che cosa è stato eseguito davvero e
che cosa no.
