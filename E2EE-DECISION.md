# E2EE-DECISION.md

**Cifratura dei dati sincronizzati: che cosa è attivo, che cosa no, e
perché la cifratura end-to-end non è in questa versione.**

Ticket: PRV-001, SEC-006.

---

## 1. Sette cose diverse che si chiamano tutte «sicurezza»

Vengono confuse continuamente, anche nella documentazione dei fornitori, e
la confusione serve a chi vende. Sono livelli distinti, e ognuno protegge da
una minaccia diversa.

| | Che cos'è | Da che cosa protegge | Attivo? |
|---|---|---|---|
| **1. TLS** | i dati sono cifrati mentre viaggiano fra dispositivo e servizio | chi intercetta la rete: wifi pubblico, provider, chi sta in mezzo | **sì** |
| **2. Cifratura a riposo** | il servizio cifra i dischi su cui i dati sono scritti | chi ruba fisicamente un disco dal centro dati | **sì**, da Google |
| **3. Authentication** | stabilisce chi è l'utente | chi si presenta senza essere nessuno | **sì** |
| **4. Security Rules** | stabiliscono a che cosa quell'utente può accedere | un altro utente autenticato che tenta di leggere i tuoi dati | **sì**, scritte; **verifica non eseguita** |
| **5. App Check** | verifica che la richiesta arrivi dall'app vera | uso automatizzato dell'API, consumo di quota | **no**, predisposto |
| **6. Cifratura client-side** | i dati vengono cifrati sul dispositivo prima di partire | chi ha accesso al database, compreso chi lo gestisce | **no** |
| **7. End-to-end** | 6, più la garanzia che la chiave non passi mai dal servizio | chiunque tranne l'utente, compreso chi scrive il software | **no** |

I punti 1–4 riguardano **chi può accedere**. I punti 6–7 riguardano **chi
può leggere anche avendo accesso**. Sono domande diverse, e la seconda è
quella che la maggior parte dei prodotti evita di affrontare mentre usa la
parola «cifrato» per far credere di averla affrontata.

### La differenza fra 2 e 6, che è quella che conta

La cifratura a riposo di Firestore protegge dal furto di un disco. **Non**
protegge da chi ha le credenziali per interrogare il database: per lui i
dati arrivano decifrati, perché è il servizio stesso a decifrarli.

Presentare la cifratura a riposo come se fosse la 6 è la scorrettezza più
comune in questo campo. Non la faremo.

---

## 2. Che cosa è attivo, in concreto

```
dispositivo  ──TLS──▶  Google Identity Toolkit   (accesso)
dispositivo  ──TLS──▶  Firestore                 (dati)
                        │
                        ├─ Authentication: chi sei
                        ├─ Security Rules: users/{uid}/… solo il proprietario
                        └─ cifratura a riposo: dischi cifrati da Google
```

- **In transito**: TLS, imposto dagli endpoint `https://` e da
  `upgrade-insecure-requests` nella CSP.
- **A riposo**: cifratura gestita da Google, con chiavi di Google.
- **Isolamento**: `firebase/firestore.rules`, UID nel percorso, clausola di
  chiusura negativa, 14 collaudi **scritti e non eseguiti** (SEC-002
  PARZIALE).
- **Minimizzazione**: sincronizziamo attività, note, priorità, collegamenti
  e modelli. Non raccogliamo posizione, contatti, rubrica, dispositivi,
  indirizzi IP a fini analitici, e non c'è telemetria.
- **Sessione**: nessun token conservato sul dispositivo. Finisce con la
  scheda.

### Che cosa NON è attivo, detto senza giri

**Chi gestisce il progetto Firebase può tecnicamente leggere i dati di
qualunque utente.** Non attraverso l'applicazione — le regole lo
impediscono — ma dalla console del progetto o con un service account, che
scavalcano le regole per costruzione.

In questa installazione «chi gestisce il progetto» è il proprietario di
Pannello Tempo. Non c'è modo di rendere quella frase falsa senza la
cifratura client-side.

---

## 3. Minacce coperte e non coperte

| Minaccia | Coperta? | Da che cosa |
|---|---|---|
| intercettazione sulla rete | **sì** | TLS |
| wifi pubblico ostile | **sì** | TLS |
| furto di un disco dal centro dati | **sì** | cifratura a riposo |
| un altro utente che tenta di leggere i tuoi dati | **sì**, se le regole funzionano | Security Rules (da verificare) |
| accesso senza credenziali | **sì** | Authentication |
| uso automatizzato dell'API | **no** | App Check predisposto e non attivo |
| **chi gestisce il progetto Firebase** | **NO** | — richiederebbe cifratura client-side |
| **richiesta legale al fornitore** | **NO** | idem |
| dipendente del fornitore con accesso al database | **no** | idem |
| chi ha accesso fisico al dispositivo sbloccato | **no** | i dati locali non sono cifrati |
| script ostile eseguito nella pagina | parzialmente | CSP con `script-src 'self'`; nessun token da rubare |
| password dell'utente indovinata | **no** | è dell'utente |
| dispositivo perso senza backup | **no** | e va detto: non esiste un backup del database |

Le tre righe in maiuscolo sono quelle che la cifratura end-to-end
risolverebbe, e sono anche le tre che i prodotti concorrenti dichiarano di
risolvere usando la parola «cifrato» per il punto 2 di §1.

---

## 4. La gestione delle chiavi: il problema vero

La cifratura client-side non è difficile da scrivere. `crypto.subtle` è nel
browser, AES-GCM è una chiamata. Difficile è tutto il resto, e nessuno dei
problemi qui sotto ha una soluzione che non tolga qualcosa all'utente.

### Generazione e derivazione

La chiave si deriva dalla password con PBKDF2 o Argon2. Conseguenza
immediata: **il servizio non deve mai vedere la password**. Ma Firebase
Authentication la riceve — è così che autentica. Servirebbero due segreti
distinti: la password per entrare, e una passphrase separata per cifrare.
Due cose da ricordare invece di una, ed è la prima cosa che fa abbandonare
una funzione di sicurezza.

### Recupero dell'account

Il punto che decide da solo.

Oggi: password dimenticata → email → nuova password → i dati ci sono ancora.

Con E2EE: password dimenticata → email → nuova password → **i dati non si
aprono più**. La chiave era derivata da quella vecchia, e il servizio non ne
ha copia — se ne avesse copia non sarebbe end-to-end.

Le vie d'uscita sono tre, e nessuna è buona per un prodotto consumer:

1. **codice di recupero** da stampare e conservare. Chi lo perde perde
   tutto. Chi lo fotografa lo mette in cloud, e la garanzia decade.
2. **escrow** della chiave presso il servizio. Non è più end-to-end: è
   cifratura a riposo con passaggi in più.
3. **nessun recupero**. Onesto, e inaccettabile per un'app di
   produttività: si perdono mesi di lavoro per una password dimenticata.

### Cambio password

Va ricifrato tutto, sul dispositivo, con la chiave nuova. Con dataset
grandi è un'operazione lunga che non può essere interrotta: se il browser si
chiude a metà, una parte è cifrata con la chiave nuova e una con la vecchia.
Servirebbe una migrazione con doppia chiave e un punto di ripristino.

### Secondo dispositivo

Il nuovo dispositivo deve ottenere la chiave. Senza passare dal servizio, il
che significa: mostrare un QR sul primo e inquadrarlo col secondo, oppure
far digitare la passphrase separata. La prima richiede che i due dispositivi
siano nella stessa stanza, la seconda riporta al problema di sopra.

### Perdita della chiave

Nessun recupero possibile, per definizione. È la definizione stessa di
end-to-end, e va scritta prima che l'utente attivi la funzione, non dopo.

### Backup e portabilità

L'export diventa cifrato, quindi non più leggibile da altri programmi.
Oppure resta in chiaro, e allora il file esportato è il punto debole.
Servirebbero due formati e una scelta consapevole in più.

### Ricerca

**Il costo funzionale più grosso.** La ricerca del pannello cerca nei
titoli, nelle note, nelle etichette e nell'archivio. Su dati cifrati non si
cerca: bisogna scaricare e decifrare tutto sul dispositivo prima di poter
cercare. Con dataset grandi la ricerca diventa lenta, oppure serve un indice
cifrato — che è un progetto a sé, con le sue perdite di riservatezza.

### Conflitti

La fusione per record confronta i valori dei campi per capire che cosa è
cambiato. Su record cifrati si vede solo che due blob differiscono, non in
che cosa. La fusione automatica dei campi non in conflitto — la funzione che
evita di far scegliere all'utente quale copia buttare — smette di
funzionare, e si torna a «tieni questa o quella».

### Migrazione dei dati esistenti

Chi ha già dati sincronizzati va migrato: scaricare tutto, cifrare, ricaricare,
verificare, cancellare la versione in chiaro. Con una interruzione a metà si
resta con due copie parziali. Serve una procedura reversibile e provata.

### Collaudi

Ogni prova che oggi legge un dato remoto va ripensata: i collaudi devono
avere la chiave, e un collaudo che ha la chiave non prova che senza chiave i
dati siano illeggibili. Serve una seconda famiglia di prove.

---

## 5. La decisione

> **Per questa versione: nessuna cifratura client-side, e nessuna
> affermazione di cifratura end-to-end.**
>
> La protezione dei dati sincronizzati è: **TLS in transito**, **cifratura a
> riposo del servizio**, **isolamento per UID tramite Authentication e
> Security Rules**, **App Check quando verrà attivato**.
>
> L'interfaccia dichiara esplicitamente che i dati **non** sono cifrati
> end-to-end e che chi gestisce il servizio potrebbe tecnicamente leggerli.

### Perché questa e non l'altra

Non per difficoltà tecnica. Per tre ragioni, in ordine di peso:

1. **Il recupero dell'account.** Un'app di produttività che perde i dati per
   una password dimenticata non è utilizzabile, e le tre vie d'uscita
   possibili sono peggiori del problema.
2. **Implementarla a metà sarebbe peggio di non implementarla.** Una
   cifratura con la chiave in escrow, o con un recupero che passa dal
   servizio, si può chiamare end-to-end e non lo è. Chi la usa cambia
   comportamento credendo di essere protetto: è un danno, non una
   mitigazione.
3. **La ricerca e la fusione dei conflitti sono funzioni centrali** di
   questo prodotto, e la cifratura le romperebbe entrambe.

### Che cosa faremo invece, subito

- **dirlo.** L'interfaccia, `PRIVACY.md` e la pagina pubblica affermano che
  non c'è E2EE e che cosa questo comporta;
- **minimizzare.** Meno dati sincronizzati, meno esposizione;
- **non conservare token.** Già fatto (SEC-001);
- **eseguire i collaudi delle regole.** È la protezione su cui l'isolamento
  si regge, e finché non gira è una promessa;
- **attivare App Check** con il costo dichiarato in `FIREBASE-SETUP.md` §10.

---

## 6. Se in futuro

Le condizioni per riaprire la questione, in ordine:

1. **una risposta al recupero dell'account** che non sia «perdi tutto» né
   «ci fidiamo del servizio». Se non c'è questa, il resto non conta;
2. una decisione su ricerca e conflitti: indice cifrato, o accettare la
   perdita e dirla;
3. una procedura di migrazione reversibile e provata per chi ha già dati;
4. un modello di minaccia scritto: da chi si protegge, e a quale costo per
   l'utente.

Un'ipotesi di percorso, se un giorno servisse: **cifratura selettiva
facoltativa**. L'utente può marcare singole voci come «private»; solo quelle
vengono cifrate con una passphrase separata; quelle voci non compaiono nella
ricerca e non partecipano alla fusione automatica, e l'interfaccia lo dice.
Costo confinato a ciò che l'utente scegli di proteggere, e nessuna promessa
generale che non possiamo mantenere.

Non è pianificata. È scritta perché la prossima persona che si porrà la
domanda parta da qui invece che da zero.

---

## 7. Formule vietate

Nell'interfaccia, nella documentazione e nei materiali pubblici **non** si
scrive:

- ~~«i tuoi dati sono al sicuro»~~ — non è un'informazione;
- ~~«completamente sicuri»~~ — niente lo è;
- ~~«end-to-end encrypted»~~ — è falso;
- ~~«crittografia militare»~~ — non significa niente;
- ~~«nessuno può leggere i tuoi dati»~~ — è falso: chi gestisce il servizio
  può;
- ~~«privacy garantita»~~ — non si garantisce, si spiega.

Si scrive invece **quali protezioni sono attive e quali no**, come nella
tabella di §1. Un collaudo verifica che le frasi vietate non compaiano:
`tests/ui/terminologia.spec.js`.
