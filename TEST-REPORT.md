# TEST-REPORT.md

**Che cosa è stato eseguito davvero, che cosa è scritto e non eseguito, e
che cosa non è nemmeno stato scritto.**

Le tre categorie sono tenute separate di proposito. Un rapporto che le
mescola trasforma «abbiamo un collaudo» in «funziona», e sono due
affermazioni diverse.

| | |
|---|---|
| Build | vedi `build.json`, campo `sorgenti` |
| Schema | 6 |
| Ambiente di lavoro | Windows, browser incorporato. **Assenti: Node, npm, Java, Python** (verificato: `node` assente, `npm` assente, `java` assente, `python` è lo stub del Microsoft Store) |
| Limiti del browser incorporato | **il service worker non si registra**: `sw.js` viene servito con codice 200 e `Content-Type` corretto, ma `navigator.serviceWorker.register()` rifiuta con «unknown error when fetching the script». Quindi cache, funzionamento offline e aggiornamento non sono verificabili qui (MOB-001). Inoltre il pannello riporta `visibilityState: "hidden"`, il che **congela le transizioni CSS**: vedi `ACCESSIBILITY-REPORT.md` §3 |

---

## 1. Eseguito davvero

Prove eseguite nel browser sulla build servita su `http://localhost`, non da
`file://`. La distinzione conta: da `file://` la Content Security Policy non
si applica e i service worker non si registrano.

### Sicurezza delle credenziali

| Prova | Esito |
|---|---|
| una sessione viva non scrive segreti su disco | **passata** — su disco solo `provider`, `auto`, `rev`, `dirty`, `gist.id`, `gist.file`, `fb.email`, `fb.uid` |
| un token GitHub in memoria non raggiunge il disco | **passata** |
| un blocco «sporco» di una versione precedente viene ripulito | **passata** — 7 elementi rimossi, nessuna stringa segreta sopravvive, provider riportato a `locale` |
| verifica indipendente per stringhe dopo la pulizia | **passata** — vuota |
| l'uscita non lascia residui | **passata** — provider `locale`, `syncReady()` falso |
| l'export JSON e CSV non contiene credenziali | **passata** |
| audit su sei meccanismi di persistenza | **passata** — `localStorage`, `sessionStorage`, URL, cookie, Cache API, IndexedDB |
| **controprova**: l'audit trova davvero i segreti | **passata** — cinque tipi di sentinella rilevati |

La controprova merita una nota: un controllo che non trova niente può essere
corretto oppure rotto, e senza sporcare di proposito i due casi non si
distinguono.

### Difetti trovati eseguendo, non leggendo

| Difetto | Come è stato trovato |
|---|---|
| `saveSync()` scriveva `fb.refresh`, `fb.idToken` e `gist.token` in chiaro | tre valori sentinella scritti e riletti dal disco |
| `ripulisciTokenPersistenti()` ne toglieva uno su tre | eseguita su un disco sporco |
| `controllaCampiGist` chiamata con gli argomenti invertiti | confronto delle due chiamate con una coppia valida |
| il diffing del DOM non sincronizzava la proprietà `checked` | stato cambiato dal codice, casella rimasta vuota |
| la casella dell'agenda in elenco era a destra | asserzione sulla distanza casella-contenuto |
| quattro caselle delle impostazioni erano 13×13 | misura di tutti i bersagli |
| `.profilo` non dichiarava un fondo: 1,03:1 in tema scuro | audit di contrasto |
| il riquadro di attivazione non compariva mai | dentro il ramo `!syncReady()` |
| l'elenco delle esclusioni dell'impronta divergeva dal build canonico | conteggio dei file |
| `id="annunci"` esisteva **due volte**, e la copia dentro `#app` veniva ricreata a ogni ridisegno | conteggio degli id duplicati |
| `annunciaMirato()` non aveva un solo chiamante e duplicava `annuncia()` | ricerca dei chiamanti, partendo dall'id duplicato |
| **31 campi e ogni pulsante contornato** avevano il bordo a 1,50:1 (chiaro) e 1,70:1 (scuro): sotto il 3:1 della 1.4.11 | contrasto dei comandi, che axe non misura |
| **13 testi** a 4,13:1: il caso peggiore non era la tappa scura dello sfondo ma la griglia **sopra** quella tappa | composizione dei due livelli di sfondo |
| **7 campi senza nome accessibile**, e uno col solo `placeholder` | nome calcolato senza contare il contenuto dell'elemento |
| **31 `<label>` che non etichettavano niente** | verifica di `for` e di associazione implicita |
| i **7 pulsanti dei giorni** larghi 9px e attaccati, con la sola iniziale come nome («M» due volte) e lo stato nel solo colore | misura dei bersagli con l'eccezione di spaziatura |
| la stella delle priorità a **1,03:1** sullo sfondo di pagina | contrasto dei comandi |
| `.dayb` selezionato: bianco su azzurro chiaro, **3,08:1** in tema scuro | contrasto del testo in tema scuro |

### Interfaccia e terminologia

| Prova | Esito |
|---|---|
| nessuna parola vietata nel testo visibile | **passata** — 21 modelli su 23.303 caratteri, compresi `aria-label`, `placeholder`, `title` |
| nessuna frase ambigua su calendario e sincronizzazione | **passata** — 10 frasi |
| le tre affermazioni di trasparenza sono presenti | **passata** |
| nessuna parola dell'Account nella sezione Calendario, e viceversa | **passata** |
| sei stati espliciti presenti | **passata** |
| nessun selettore di fornitore | **passata** |
| il predefinito è «locale» | **passata** |

### UI-006 · indicatore Lavoro/Vita

14 asserzioni strutturali sul DOM disegnato, in **sette** condizioni:
530px auto, 1280px chiaro comoda, 1280px chiaro compatta, 1280px chiaro con
task completato/in attesa/titolo lungo, 1280px scuro, 375px scuro, 640×450
(zoom 200%) chiaro.

**Esito: 14/14 in tutte e sette.**

Nessuno scorrimento orizzontale a nessuna larghezza, anche con un titolo di
70 caratteri senza spazi. Contrasto del punto d'area: 7,81:1 chiaro,
5,06:1 scuro, contro un minimo di 3:1.

### Contrasto e accessibilità

Audit su cinque viste — home, modulo di aggiunta, dettaglio di un task,
impostazioni con tutte le schede aperte, densità compatta — in quattro
combinazioni di tema e larghezza, più due condizioni ulteriori sul solo
contrasto (auto con sistema scuro; zoom 200%).

| | Esito |
|---|---|
| contrasto del testo (1.4.3), 422–545 testi per vista | **0 fallimenti** |
| contrasto dei comandi (1.4.11), 108–163 comandi per vista | **0 fallimenti** |
| dimensione dei bersagli (2.5.8), 160–225 bersagli per vista | **0 fallimenti** |
| nomi accessibili dei campi | **0 senza nome**, 0 col solo segnaposto |
| id duplicati · riferimenti ARIA rotti · salti di intestazione | **0 · 0 · 0** |
| scorrimento orizzontale | **nessuno**, da 320 a 1280px |

**Controprova eseguita: 0 → 3 → 0**, in entrambi i temi. Compreso un colore
al 18% di opacità, per verificare che la composizione alpha funzioni.

Partenza: 24 gruppi e 90 testi sotto soglia sul contrasto del testo; poi 31
campi, 13 testi, 7 campi senza nome, 31 etichette scoperte e 7 pulsanti da
9px trovati dalle misure aggiunte in questa fase.
`ACCESSIBILITY-REPORT.md` riporta i numeri per condizione, i valori scelti
con il fondo peggiore misurato, e gli **otto falsi allarmi** da cui gli
auditor sono nati.

### Migrazioni

| Prova | Esito |
|---|---|
| 5 → 6 con dati reali di schema 5 | **passata** — 2 voci conservate con etichette, `tipo` e `versioni` intatti, impostazioni preservate |
| copia di sicurezza creata e contenente i dati v5 | **passata** |
| idempotenza | **passata** |
| schema 99 lasciato intatto | **passata** — esito `troppo-recente` |
| 1 → 6 completa | **passata** — nessun dato perduto |

### Gist, deprecazione e migrazione

17 casi: sette di contenuto con messaggi distinti, cinque di validazione dei
campi, rifiuto di scrittura, rifiuto di collegamento, cancellazione che
dichiara di non poter cancellare, interruttore di rimozione presente,
`gistWrite` assente dal codice, token dimenticato dopo un errore.
**Tutti passati.**

### Attivazione della sincronizzazione

Sei casi con `readRemote` sostituito: locale pieno/remoto vuoto, locale
vuoto/remoto pieno, entrambi pieni disgiunti, entrambi pieni sovrapposti,
riquadro visibile con le quattro scelte, schema 99 rifiutato.
**Tutti passati.** Verificato anche che i titoli delle attività **non**
compaiano nel riepilogo.

### Cancellazione

Quattro casi: solo locali, solo cloud (dati del dispositivo intatti), cloud
che rifiuta (esito parziale, locale procede), documento ancora leggibile
dopo un `DELETE` riuscito (verifica fallita, nessuna falsa conferma).
**Tutti passati.**

### Limiti e ritmo

Otto meccanismi: curva del backoff con tetto (5→300 s), sospensione dopo sei
errori, rispetto del 429 con almeno 60 s, deduplicazione entro 3 s,
riconoscimento del ciclo dopo dieci alternanze, dataset normale accettato,
5100 voci rifiutate, 950 000 caratteri rifiutati. **Tutti passati.**

### Build

| Prova | Esito |
|---|---|
| due calcoli consecutivi dell'impronta identici | **passata**, a ogni fase |
| identità coerente nei quattro punti | **passata** |
| sintassi dei 16 file nuovi | **passata** — caricati come moduli, scope isolato |
| YAML della workflow | **passata** — 0 tabulazioni, 3 lavori, 33 passi, `workflow_dispatch` |
| JSON validi | **passata** — 4 file |
| i 15 file invocati dalla workflow esistono | **passata** |
| regole Firestore: forma | **passata** — graffe bilanciate 29/29, `rules_version`, clausola di chiusura, nessun `if true`, nessun `allow` senza condizione, proprietà dal percorso, 10 percorsi coperti |

---

## 2. Scritto e NON eseguito

Nessuno di questi è mai stato eseguito. La sintassi è corretta; che cosa
faranno non si sa.

| File | Prove | Richiede |
|---|---|---|
| `tests/security/regole.test.js` | 14 | Node + Java + `@firebase/rules-unit-testing` + emulatore |
| `tests/security/sentinelle.test.js` | 11 | Node + Playwright |
| `tests/e2e/cancellazione.spec.js` | 10 | Node + Playwright |
| `tests/e2e/piattaforma.spec.js` | 17 | Node + Playwright |
| `tests/a11y/accessibilita.spec.js` | 14 | Node + Playwright + axe-core |
| `tests/ui/ui006.spec.js` | 60 + regressione visiva | Node + Playwright |
| `tests/ui/terminologia.spec.js` | 8 | Node + Playwright |
| `tests/unit/migrazioni.test.js` | 15 | Node |
| `tests/integration/gist-migrazione.test.js` | 20 | Node |
| `tests/avvio.test.js` | 60 | Node |

**Totale scritto e non eseguito: circa 230 asserzioni.**

Le prove di `migrazioni`, `gist-migrazione` e `avvio` verificano
comportamenti che ho **già verificato a mano nel browser**: il valore
aggiunto dell'esecuzione è la ripetibilità, non la scoperta. Le altre
verificano cose che **non ho potuto verificare in nessun modo**, e sono
quelle che contano.

### La regressione visiva fallirà, di proposito

Non esistendo riferimenti, Playwright li crea e il passo esce in errore. È
voluto: uno scatto appena generato non dimostra che l'aspetto sia giusto,
dimostra com'era in quel momento. Vedi `RUN-CI.md` §5.

---

## 3. Non scritto

| Che cosa | Perché |
|---|---|
| collaudo del percorso account end-to-end | richiede un progetto Firebase reale, che non esiste. `FIREBASE_CONFIG` è vuoto |
| collaudo di App Check | non è attivo: `appCheckSiteKey` è vuota |
| collaudo del recupero password e verifica email | richiedono una casella di posta e un progetto reale |
| collaudo di due dispositivi contemporanei | richiede due sessioni reali |
| collaudo di Gist contro l'API di GitHub | richiede un token vero. I codici HTTP sono coperti con risposte finte |
| collaudo su lettore di schermo reale | non automatizzabile: `ACCESSIBILITY-REPORT.md` §prove manuali |
| collaudo su dispositivo fisico | non disponibile |
| collaudo di carico | fuori scopo |

---

## 4. Stato dei ticket collegati ai collaudi

Nessun ticket è stato dichiarato COMPLETATO sulla base di un collaudo non
eseguito.

| Ticket | Stato | Che cosa serve per chiuderlo |
|---|---|---|
| SEC-001 credenziali | **COMPLETATO** | verificato eseguendo, sei meccanismi |
| SEC-002 isolamento per utente | **PARZIALE** | output di `regole.test.js` con `falliti: 0` |
| SEC-003 CSP | **PARZIALE** | il passo CSP verde, con l'agenda che si disegna |
| SEC-008 rate limit | **COMPLETATO** per la parte applicativa | la limitazione dei tentativi di accesso è di Firebase, non nostra |
| SEC-009 App Check | **PARZIALE** | App Check è predisposto e non attivo |
| PRV-001 trasparenza | **COMPLETATO** | verificato eseguendo |
| PRV-002 cancellazione | **PARZIALE** | `cancellazione.spec.js` verde su entrambi i browser |
| PRV-003 esportazione | **COMPLETATO** | verificato, senza credenziali |
| SYN-001 contratto | **COMPLETATO** | tre adattatori al contratto |
| SYN-004 per record | **COMPLETATO** per il confronto client-side | il documento per record non è implementato: `ARCHITECTURE.md` §3 |
| SYN-006 esperienza consumer | **COMPLETATO** per la logica | il percorso account non è eseguibile senza configurazione |
| MIG-001 migrazione Gist | **COMPLETATO** per la parte nel browser | i codici HTTP non sono provati contro GitHub |
| CAL-001 esportazione ICS | **COMPLETATO** | verificato col pannello aperto |
| CAL-002 importazione ICS | **COMPLETATO** | idem |
| CAL-003 integrazione automatica | **NON INIZIATO** | richiede OAuth e un servizio: `CALENDAR-SYNC.md` §6 |
| CPY-002 terminologia | **COMPLETATO** | verificato eseguendo |
| UI-006 indicatore area | **PARZIALE** | regressione visiva verde con riferimenti approvati |
| A11Y-004/005/006 | **PARZIALE** | il passo accessibilità verde |
| TST-003/004/005/006/007 | **PARZIALE** | i rispettivi passi verdi |
| MOB-001/002 | **PARZIALE** | i passi PWA e responsive verdi |

---

## 5. Rischi residui

In ordine di gravità.

1. **L'isolamento fra utenti non è verificato.** È la protezione su cui si
   regge tutto il modello a account, e finché `regole.test.js` non gira è
   una promessa fondata su una lettura del codice. Se una regola avesse un
   difetto, un utente autenticato potrebbe leggere i dati di un altro.
2. **La cancellazione remota non è stata vista avvenire.** Il passo di
   verifica c'è e nei collaudi con risposte finte funziona. Contro un
   servizio reale, no.
3. **Il percorso account non è mai stato eseguito end-to-end.** Registrazione,
   accesso, prima sincronizzazione, conflitto, disconnessione: tutto scritto,
   niente provato contro Firebase.
4. **App Check non è attivo**, quindi la quota è esposta all'uso
   automatizzato, con le conseguenze di costo descritte in
   `FIREBASE-SETUP.md` §12.
5. **`style-src` ammette `'unsafe-inline'`** per gli attributi `style`: chi
   riuscisse a iniettare HTML potrebbe iniettare CSS. Si chiude togliendo i
   141 stili inline.
6. **`frame-ancestors` non ha effetto** in un `<meta>`: la protezione da
   clickjacking è in JavaScript e vale finché il JavaScript gira.
7. **Non esiste un backup del database.** L'unica copia ripristinabile dei
   dati di un utente è quella che ha esportato lui.
8. **La regressione visiva non ha riferimenti approvati**, quindi un
   cambiamento d'aspetto non voluto non verrebbe intercettato.
9. **Nessuna prova su lettore di schermo reale.** axe trova circa un terzo
   dei problemi di accessibilità.
10. **Nessuna prova su dispositivo fisico.** L'emulazione di viewport non è
    un telefono: tocco, tastiera virtuale e prestazioni sono diversi.
