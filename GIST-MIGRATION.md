# GIST-MIGRATION.md

**Deprecazione di GitHub Gist e percorso di uscita per chi lo usa.**

Ticket: MIG-001. Decisione: `SYNC-DECISION.md`, opzione A.

---

## 1. Perché è stato deprecato

Non per preferenza architetturale. Due ragioni dimostrate leggendo il codice:

### Il token non è conservabile in sicurezza

Il collegamento richiedeva un *personal access token* di GitHub, che **non
ha scadenza**. Finiva in `localStorage`, in chiaro. Verificato sulla build
`035c16ab8a8f`:

```
sync.gist.token = 'ghp_TOKEN_DI_PROVA_123'
saveSync()
localStorage['pannello-tempo:sync'] → gist.token = "ghp_TOKEN_DI_PROVA_123"
```

E la funzione che doveva ripulire i token persistenti ne toglieva uno su
tre: lasciava indietro l'`idToken` di Firebase e proprio questo token
GitHub.

È lo stesso limite che ha portato a rimuovere «Resta collegato»
(`SECURITY-REPORT.md`, SEC-001): **in un'applicazione senza server non
esiste un posto sicuro dove tenere una credenziale riutilizzabile.**
Qualunque cosa raggiungibile da JavaScript nella pagina è raggiungibile da
JavaScript ostile nella stessa pagina. Cifrarlo con una chiave che sta nella
stessa pagina non aiuta: sposta il problema di una riga.

Tenere Gist come «provider per utenti tecnici» avrebbe significato
continuare a scrivere un segreto senza scadenza su disco, dopo averlo
dichiarato inaccettabile per l'account. Sarebbe stata un'incoerenza, e un
falso senso di sicurezza.

### Non sapeva cancellare

```js
GistProvider.deleteRemote()  →  { ok: false, parziale: true, motivo: "…" }
```

Il contenuto veniva svuotato, non eliminato. Un prodotto destinato al
mercato non può offrire «Elimina i miei dati» e poi lasciare il file dov'è.

---

## 2. Cosa non è più possibile

| Operazione | Stato |
|---|---|
| Selezionare Gist come provider | **rimossa** — nessun comando nell'interfaccia; il selettore fra fornitori non esiste più |
| Collegare un nuovo Gist | **rifiutata** — `GistProvider.login()` restituisce sempre un errore che spiega perché |
| Scrivere su Gist | **rimossa** — la funzione `gistWrite()` è stata **cancellata**, non disattivata con un `if`. Una funzione che esiste può essere richiamata per sbaglio |
| Comparire nell'onboarding | **rimossa** |
| Comparire come alternativa consumer | **rimossa** |
| Comparire nella sezione Calendario | **mai stata lì**, e ora c'è un collaudo che lo verifica |
| Creare nuovi Gist | **mai esistita** — nessuna riga ha mai creato un gist |
| Gist pubblici come destinazione | non esiste destinazione: non si scrive |

`GistProvider.isConfigured()` restituisce **sempre `false`**: così
`provider()` ricade su `LocalOnlyProvider` e nessun percorso automatico può
tentare di scrivere.

---

## 3. Dati legacy riconosciuti

All'avvio, `ripulisciTokenPersistenti()` cerca nel blocco
`pannello-tempo:sync`:

| Trovato | Azione |
|---|---|
| `gist.token` | **rimosso** da memoria e da disco |
| `gist.id` | **conservato**: è un identificativo, non un segreto, e serve a proporre il recupero |
| `provider: "gist"` | portato a `"locale"` |
| `fb.refresh`, `fb.idToken`, `fb.apiKey`, `fb.projectId` | rimossi |
| `ricordami` | rimosso |

Restituisce `serveRicollegare: true` quando trova un collegamento Gist, così
l'interfaccia può avvisare invece di lasciare l'utente a chiedersi perché
non si sincronizza più.

Il percorso di recupero compare solo se: esiste `gist.id` **e**
`settings.gistMigrato` è `false`. Chi non ha mai usato Gist non vede nulla.

---

## 4. Il flusso di recupero

1. L'interfaccia dichiara che il servizio non è più supportato e **perché**.
2. Dice che **il file remoto non è stato toccato**: è dell'utente e resta
   dov'è.
3. Chiede l'identificativo (precompilato, se salvato) e il token.
4. Dichiara che il token **non viene salvato** e che verrà dimenticato
   appena finito.
5. Legge una volta. In lettura, mai in scrittura.
6. **Dimentica il token**, sia in caso di successo sia in caso di errore
   (`finally`, non solo nel ramo felice: un errore di rete lo lascerebbe in
   memoria fino al ricaricamento).
7. Mostra un'anteprima con **conteggi, non titoli**.
8. Offre quattro vie: Unisci · Usa i dati recuperati · Scarica come file ·
   Annulla.
9. Prima di applicare: copia di sicurezza automatica **e** istantanea di
   annullamento.
10. I dati in arrivo passano dalla **migrazione dello schema** come qualunque
    dato letto da fuori, invece di essere innestati così come sono.
11. Registra nel diario tecnico **quante** voci, non quali.
12. Segna `gistMigrato: true`: la proposta non torna.
13. Mostra come revocare il token su GitHub, con collegamento diretto a
    `https://github.com/settings/tokens`.

### Perché anche «Scarica come file»

Chi vuole solo mettere al sicuro il file prima di eliminarlo su GitHub non
deve essere costretto a importarlo nel pannello. La busta scaricata passa da
`senzaSegreti()`, quindi non contiene credenziali per costruzione.

---

## 5. Trattamento del token

| | |
|---|---|
| Dove vive | **solo in memoria**, in `sync.gist.token`, per la durata della singola lettura |
| Su disco | **mai**: `saveSync()` scrive a lista chiusa e `token` è in `CAMPI_SEGRETI` |
| Nei backup | mai: i backup contengono `S.data`, e il token non è in `S.data` |
| Negli export | mai: l'export passa da `senzaSegreti()` |
| Nei log | mai: il diario registra «recupero dal servizio precedente, modo unisci, 26 voci in arrivo» |
| Negli errori | mai: i messaggi parlano del campo, non del valore |
| Nell'URL | mai: nessun parametro di query, nessun frammento |
| Dopo un errore | dimenticato: verificato |
| Dopo l'annullamento | dimenticato, insieme ai dati letti |
| Permessi richiesti | il solo `gist`. La guida non chiede `repo` né altro |

---

## 6. Revoca manuale

Il pannello **non può** revocare il token: servirebbe un permesso di
amministrazione dell'account che non chiede e non deve chiedere. La revoca è
un gesto dell'utente:

1. `https://github.com/settings/tokens`
2. trovare il token usato per Pannello Tempo;
3. *Delete*.

Il collegamento è nell'interfaccia, accanto al comando «Dimentica questo
collegamento». Sono due cose diverse e vengono presentate come tali:
dimenticare toglie il riferimento **da questo dispositivo**; revocare
disattiva il token **su GitHub**. Chi fa solo la prima ha ancora un token
valido in giro.

---

## 7. Casi d'errore, e cosa dice ognuno

Ogni caso ha un messaggio proprio. «Non è un JSON valido» e «è un JSON ma
non è un backup» sono problemi diversi e portano ad azioni diverse.

| Caso | Titolo mostrato | Verificato |
|---|---|---|
| token vuoto | «Manca il token di GitHub» | ✔ |
| token di formato sbagliato | «Il token non ha il formato atteso…» | ✔ |
| identificativo vuoto | «Manca l'identificativo del gist» | ✔ |
| identificativo di formato sbagliato | «L'identificativo del gist è la parte finale dell'indirizzo…» | ✔ |
| token rifiutato (401) | «Token rifiutato» | codice |
| permesso mancante o limite (403) | «Permesso mancante o limite raggiunto» | codice |
| gist inesistente (404) | «Non trovato» | codice |
| nessun file dentro | «Nessun file dentro» | codice |
| più file, nessuno riconosciuto | «Più file, nessuno riconosciuto» | codice |
| file vuoto | «File vuoto» | ✔ |
| JSON non valido | «Contenuto illeggibile» | ✔ |
| JSON ma non un backup | «Non è un backup di Pannello Tempo» | ✔ |
| schema più recente del codice | «Dati di una versione più recente» | ✔ |
| rete assente | «Nessuna connessione» (da `dettaglioErrore`) | codice |
| migrazione dello schema fallita | «Recupero non riuscito», e i dati locali non vengono toccati | codice |

E tre **avvisi**, che non bloccano ma vanno detti:

| Situazione | Avviso | Verificato |
|---|---|---|
| gist **pubblico** | «Il file su GitHub è PUBBLICO: chiunque ne conosca l'indirizzo ha potuto leggere i tuoi dati. Dopo il recupero conviene eliminarlo.» | ✔ |
| contenuto **troncato** da GitHub | «Il file era troppo grande e GitHub l'ha troncato: il contenuto è stato recuperato per intero da un indirizzo a parte.» | ✔ |
| file con **nome diverso** | «Il file dentro si chiama «altro.json» e non «pannello.json»: ho usato quello, essendo l'unico.» | ✔ |
| **schema precedente** | «I dati sono di uno schema precedente (v3): verranno aggiornati durante l'importazione, con una copia di sicurezza prima.» | ✔ |

Il troncamento merita una nota: GitHub tronca i file grandi e mette il resto
a un indirizzo a parte. Senza il secondo scaricamento si sarebbe migrato
**metà dataset in silenzio**, che è il tipo di difetto peggiore.

### Conflitti

| Con | Come viene gestito |
|---|---|
| dati locali | l'anteprima conta le voci presenti in entrambi confrontando gli id, e dichiara che con «Unisci» vince la versione modificata più di recente e con «Usa i dati recuperati» vince il file |
| un account attivo | l'anteprima avvisa: «Sei collegato a un account. Quello che scegli qui verrà sincronizzato anche là alla prossima occasione.» |
| nessuna sovrapposizione | l'anteprima lo dice: «Nessuna voce risulta presente in entrambi: unire non produrrà conflitti» |

### Rollback

Due livelli, entrambi automatici:

1. **Annulla** subito dopo l'operazione: `snapshot()` prima di applicare.
2. **Copie di sicurezza**: `salvaBackupAutomatico()` prima di applicare, con
   la propria etichetta («prima del recupero dei dati dal servizio
   precedente»). Ne vengono conservate cinque.

Se la migrazione dello schema dei dati in arrivo fallisce, **non viene
applicato niente**: i dati locali restano intatti e l'errore lo dichiara.

---

## 8. Rimozione futura del lettore

```js
/* js/sync.js */
var LETTORE_GIST_ATTIVO = true;
```

Portandolo a `false`:

- il percorso di recupero sparisce dall'interfaccia;
- `gistLeggiConDiagnosi()` rifiuta con un messaggio che indirizza
  all'esportazione manuale da GitHub;
- **la scrittura non torna**, perché non esiste.

Non c'è una data. Una data commerciale inventata è una promessa che non
possiamo mantenere: la leva si tira quando il proprietario del prodotto
guarda quanti utenti hanno ancora un identificativo salvato e decide. Il
criterio ragionevole è: quando quel numero è zero, o quando i pochi rimasti
sono stati avvisati direttamente.

---

## 9. Problemi noti

1. **Il contenuto remoto resta su GitHub.** Di proposito: è dell'utente e il
   pannello non chiede il permesso di cancellarlo. Chi vuole eliminarlo lo fa
   dall'interfaccia di GitHub. L'interfaccia lo dice.
2. **Il token va revocato a mano.** Non c'è modo di revocarlo dal pannello, e
   dimenticarlo qui non lo disattiva là. Detto esplicitamente accanto al
   comando.
3. **Un gist pubblico è già stato letto da chiunque.** L'avviso arriva al
   momento del recupero, cioè tardi. Non c'era modo di accorgersene prima,
   perché la versione precedente non guardava il campo `public`.
4. **Se il file è stato modificato a mano** il recupero fallisce con
   «Contenuto illeggibile». L'unica via è scaricarlo e correggerlo.
5. **Il recupero è una tantum per scelta.** Dopo `gistMigrato: true` la
   proposta non torna. Chi ne ha bisogno di nuovo può rimettere
   l'identificativo, ma deve saperlo: non è scritto nell'interfaccia.

---

## 10. Stato del ticket

**MIG-001: COMPLETATO.**

Non dipende da strumenti assenti: è tutto codice che gira nel browser, e le
verifiche sono state eseguite. Diciassette casi provati — sette di contenuto,
cinque di validazione dei campi, rifiuto di scrittura, rifiuto di
collegamento, cancellazione che dichiara di non poter cancellare,
interruttore presente, `gistWrite` assente dal codice, token dimenticato dopo
un errore.

Resta **PARZIALE** la parte che richiede rete reale: i codici 401, 403, 404 e
l'assenza di connessione sono gestiti nel codice ma non provati contro
l'API di GitHub, perché farlo richiederebbe un token vero. Il collaudo
`tests/integration/gist-migrazione.test.js` li copre con risposte finte e va
eseguito nella pipeline.
