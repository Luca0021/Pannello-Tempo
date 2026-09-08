# UX-PRIMO-ACCESSO.md

**Che cosa vede chi apre il pannello per la prima volta, misurato — e che
cosa è stato aggiunto perché capisca in meno di un minuto.**

Riguarda **UI-008**. Come per UI-007, il criterio per entrare qui è che si
possa contare: parole a schermo, comandi, traguardi spuntati, nodi aggiunti
da una modalità. Dove l'unica cosa che avevo era un'impressione, l'ho messa
fra le cose non toccate, al §6.

---

## 1. L'osservazione, prima di ogni modifica

Il pannello è stato aperto in un browser vero (Edge di sistema) con
`localStorage` vuoto, ora fissa alle 09:12 dell'8 settembre, in tre
condizioni diverse — l'ingresso guidato, la home di chi l'ha **saltato**, la
home di chi ha caricato i dati di esempio — su desktop (1280) e telefono
(375).

### 1.1 L'ingresso guidato: funziona, ed è breve

| Passo | Titolo | Parole | Comandi |
|---|---|---|---|
| 1 | «Non un'altra lista di cose da fare» | 50 | 3 |
| 2 | «Quanto vuoi vedere all'inizio?» | 55 | 5 |
| 3 | «Da che ora a che ora conta il tuo tempo?» | 50 | 4 |
| 4 | «Qual è la cosa che conta oggi?» | 34 | 6 |
| 5 | «Aggiungi una cosa da fare» | 39 | 6 |

Cinque schermate, mai più di 55 parole, mai più di 6 comandi, tutte
saltabili. **Questa parte non aveva bisogno di essere rifatta.**

### 1.2 La home, subito dopo: qui stava il problema

| | desktop | telefono |
|---|---|---|
| parole a schermo | **595** | 560 |
| comandi | **119** | 140 |
| di cui nella prima schermata | 30 | 28 |
| schede visibili | 9 | 9 |
| comandi senza alcuna spiegazione (`title`) | **70** | 84 |
| altezza del documento | 4558px | 6523px |

Con i dati di esempio: 723 parole e **159 comandi**.

### 1.3 I cinque difetti veri

**a) Il pannello non dice che cosa fa.** Chi **salta** l'ingresso non trova,
in nessun punto della home, una frase che dica a cosa serve il prodotto. La
promessa esisteva già come testo (`PROMESSA` in `promessa.js`) e viveva in
cinque posti: la landing, il primo passo dell'ingresso, le informazioni, le
modalità, i piani. Nessuno dei cinque è il primo posto che un utente nuovo
guardi.

**b) Diciassette voci che non ha scritto lui.** `seed()` popola il pannello
con «Finestra email», «Blocco focus», «Chiudi la giornata: prepara domani» e
altre quattordici. La prima schermata di un utente appena arrivato dice
**«0/9 da fare»** e **«giornata piena · 5h 45»**, e propone come priorità
«Finestra email» — due volte, con la stessa motivazione. Non c'era una riga
che dicesse da dove venissero quelle voci.

**c) «Come prendere la mano: 2 di 6» prima di aver toccato niente.** La
checklist di attivazione contava `items.length > 0` e «qualcuna ha un
orario»: entrambe vere al primo secondo, per merito di `seed()`. Una barra di
avanzamento che si spunta da sola non misura più niente.

**d) Nessuna spiegazione contestuale.** Le sezioni portano nomi
sensati — Priorità, Agenda, Routine, Posta in arrivo, Da riprogrammare — ma
nessuna dice a cosa serve, e 70 comandi su 119 non hanno nemmeno una
didascalia al passaggio del mouse. Il vocabolario da spiegare presente sulla
prima schermata: `fascia`, `posta in arrivo`, `routine`, `priorità` (8
volte), `riprogrammare`, `in attesa`, `compatta`, `arretrati`.

**e) La guida risponde a un indice, non a una domanda.** Esisteva — quindici
sezioni, con ricerca, raggiungibile dalle impostazioni — ma organizzata per
argomento. Chi non capisce qualcosa non cerca la sezione giusta: formula una
domanda.

E un difetto minore, misurato: **una scheda della home era senza titolo**
(l'invito a installare l'app), quindi nella mappa delle intestazioni c'era un
buco.

### 1.4 Che cosa esisteva già, e non è stato rifatto

Metà di ciò che serviva **c'era**, e riscriverlo avrebbe peggiorato le cose:
due percorsi guidati che si sovrappongono sono peggio di uno.

| Richiesto | Stato trovato |
|---|---|
| onboarding al primo accesso, saltabile, rilanciabile | **c'era**: `onboarding.js`, 5 passi, «Rivedi la presentazione» nelle impostazioni |
| percorso del primo giorno con avanzamento | **c'era**: `attivazione.js`, sei traguardi che si spuntano **da soli**, con «perché» e «dove», e che sparisce quando è completa |
| guida integrata con ricerca | **c'era**: 15 sezioni, campo di ricerca, generata dagli stessi elenchi che governano il pannello |
| tour visuale con riflettore sulla UI vera | **mancava** |
| spiegazioni contestuali al primo uso | **mancavano** |
| modalità «scopri funzionalità» con badge | **mancava** |
| domande rapide e salti diretti nella guida | **mancavano** |

---

## 2. Che cosa è stato aggiunto

Tre moduli nuovi (`js/primo-uso.js`, `js/tour.js`, `js/scoperta.js`), un
foglio di stile (`css/primo-uso.css`), e modifiche mirate a otto file
esistenti. **Nessuna funzione rimossa, nessun modulo tolto, nessuna
impostazione utente perduta.**

### 2.1 Il tour con il riflettore — cinque tappe

| | |
|---|---|
| Tappe | benvenuto e promessa · le tre priorità · l'agenda · come si aggiunge · profili e personalizzazione |
| Quando | **solo dopo aver portato a termine** l'ingresso guidato, e su richiesta dalle impostazioni |
| Uscite | «Salta», la ×, `Esc` — e chiuderlo **vale come averlo visto** |
| Tastiera | `←` e `→` sfogliano, il fuoco entra nel riquadro |
| Telefono | il riquadro si ancora in basso, sopra la barra di navigazione |

**Perché non al caricamento.** Se dipendesse solo da «non l'ho mai visto»,
ogni installazione esistente se lo vedrebbe comparire addosso una volta,
dopo un aggiornamento. E chi ha **saltato** l'ingresso ha detto «fammi
entrare»: aprirgli un secondo percorso guidato è non aver ascoltato.

**Come è fatto il buio.** Una dichiarazione: un'ombra dal raggio enorme
attorno a un rettangolo trasparente oscura tutto ciò che gli sta fuori.
L'alternativa — quattro pannelli attorno al bersaglio — richiede quattro
calcoli che si disallineano al primo ridisegno. Il rettangolo non intercetta
i clic: il tour racconta, non sequestra.

**Un bersaglio nominato da più selettori**, perché la stessa funzione vive in
due posti fra telefono e computer (NAV-001) e una delle due è sempre
nascosta: vale il primo **visibile**. Una tappa senza bersaglio visibile non
viene saltata in silenzio — resta, centrata, senza riflettore — perché
altrimenti «2 di 5» cambierebbe significato in base ai dati.

### 2.2 Le spiegazioni di sezione — una per volta

Otto sezioni hanno una spiegazione di **due righe**: `scopo` («a che serve»)
e `esempio` («quando la uso»). Compare **una sola**, la prima non ancora
vista nell'ordine in cui la home si legge, e solo se la sua sezione è
davvero disegnata in quel momento.

**Nove fumetti aperti insieme sarebbero peggio di nessuno**: la schermata
diventerebbe un modulo da compilare. E una spiegazione mostrata su una
sezione che l'utente non ha davanti brucia l'unica volta in cui poteva
servire.

Due comandi: «Ho capito» (passa alla successiva) e «Non mostrarmele più»
(le spegne tutte, e si riaccendono dalle impostazioni).

### 2.3 La modalità scoperta — spenta di suo

| Interruttore | Che cosa aggiunge |
|---|---|
| **spento** (predefinito) | **niente**: zero badge, zero schede, zero nodi nel documento |
| acceso | un segno «Nuovo» sulle sezioni che ospitano qualcosa di non ancora provato, e una scheda «Da provare» con **tre** funzioni per volta, ognuna con dove, perché e le funzioni correlate |

**«Non ancora usata» si deduce dai dati**, non da un contatore nuovo. Hai una
voce con un'etichetta? Allora le etichette le hai usate. Hai chiuso una
giornata? Il rituale l'hai visto.

Il prezzo è dichiarato **dentro la scheda stessa**: ricerca, filtri ed
esportazioni non compaiono in elenco, perché non lasciano traccia nei dati.
Inventare un registro «funzione X aperta» significherebbe scrivere nei dati
dell'utente per far funzionare un suggerimento, ed è un prezzo che questa
funzione non vale.

### 2.4 La guida: undici domande, e i salti

Undici domande rapide in cima alla guida, **prima** delle quindici sezioni,
ognuna con due righe di risposta e — dove esiste un posto in cui andare — un
comando che **ci porta** e chiude la guida.

Non un rimando: un pulsante. «Ho scritto una cosa e non la trovo più» apre
la ricerca; «Voglio vedere meno cose» apre le impostazioni **alla sezione
giusta**, perché arrivarci in cima a otto sezioni è arrivare a metà.

La ricerca della guida ora filtra anche le domande. E il messaggio «nessuna
sezione parla di…» compare solo se non ha trovato **niente**: prima contava
le sole sezioni, e con una domanda corrispondente la guida mostrava insieme
la risposta e «non ho trovato nulla».

### 2.5 La promessa in cima, una volta

Una riga con la promessa del prodotto e due comandi: «Fammi vedere come»
(apre il tour) e «Ho capito, chiudi». Non torna più.

### 2.6 Le voci di partenza, dichiarate

Una riga dentro «Da fare oggi», una volta, con **il conto esatto delle voci
di quella sezione** — non di tutte e diciassette: un avviso che dice
diciassette dentro una sezione che ne mostra nove è esso stesso una cosa da
spiegare. Le voci **restano**: sono una proposta ragionata, e cancellarle
d'ufficio toglierebbe al pannello il suo scheletro.

### 2.7 L'attivazione non si prende meriti

Le due voci «Aggiungi qualcosa da fare» e «Dai un orario a una cosa» ora
chiedono qualcosa che **tu** hai fatto: si distingue per identificativo,
confrontando con `seed()`, che è l'unica definizione delle voci iniziali. I
dati di esempio portano il marchio `demo-` e non contano nemmeno loro.

Un limite dichiarato: se rinomini «Blocco focus» quella resta, per questa
misura, una voce iniziale — l'hai modificata, non aggiunta. L'orario è più
preciso: se lo cambi rispetto a quello di partenza, l'hai dato tu.

**E un traguardo nuovo, il settimo:** «Completa una cosa che si ripete».
Era la voce chiesta e mancante, ed è quella che chiude il ciclo: la spunta di
oggi si azzera domani, e quello è il punto del pannello.

| | prima | dopo |
|---|---|---|
| avanzamento di un utente appena arrivato | **2 di 6** | **0 di 7** |

### 2.8 Dove vivono queste preferenze

In `P` (`pannello-tempo:prefs`), le preferenze **del dispositivo**, non in
`S.data.settings`. La differenza il repository l'ha già pagata una volta:
tema, densità e sezioni chiuse viaggiavano coi dati e un dispositivo imponeva
le sue scelte all'altro (vedi `migratePrefs` in `sync.js`).

«Questa spiegazione l'ho già letta» è un fatto di questo schermo. Su un
telefono nuovo le spiegazioni ricompaiono, perché là non le hai lette.

Conseguenza voluta: **nessun campo nuovo nel documento sincronizzato, nessuna
migrazione di schema, nessun dato dell'utente toccato.** Le prove lo
verificano: `tour:fatto` deve stare fra le preferenze locali e **non** fra le
impostazioni nei dati.

---

## 3. Le prove

`tests/ui/primo-accesso.spec.js` — **17 prove, 80 asserzioni**, su desktop e
telefono:

| | |
|---|---|
| 01-02 | il tour **non** compare a chi è già dentro, nemmeno dopo un ricarico |
| 03-12 | si apre completando l'ingresso; ogni tappa illumina un bersaglio con una superficie, dentro la finestra; nessuno scorrimento orizzontale; comandi a 24px |
| 13-16 | l'ultima tappa chiude, «visto» sta fra le preferenze **locali** e non nei dati, e non torna al ricarico |
| 17-19 | `Esc` chiude, e chiudere vale come aver visto |
| 20-21 | le frecce sfogliano |
| 22-24 | si rilancia dalle impostazioni |
| 25-28 | sul telefono il riquadro non ha geometria in linea, sta dentro la finestra, non si stira |
| 29-35 | **una** spiegazione a schermo; «Ho capito» passa alla successiva; spegnerle è definitivo e locale |
| 36-39 | la promessa compare una volta e non torna |
| 40-42 | le voci di partenza sono dichiarate **col conto della sezione** |
| 43-50 | modalità scoperta: spenta zero nodi, accesa badge e scheda, al massimo tre proposte |
| 51-52 | «non ancora usata» cambia **con i dati**: aggiungo una nota e la voce sparisce dall'elenco |
| 53-57 | le domande rapide ci sono, la ricerca le filtra, e il salto chiude la guida |
| 58-61 | l'attivazione parte da **0 di 7**, e si spunta quando l'azione è dell'utente |

**Regressione**, tutta la suite in browser su Chromium (canale Edge di
sistema), `--workers=2`: **158 prove su 158**, exit 0 — 22 di accessibilità,
10 di cancellazione, 19 di piattaforma, 11 di sentinelle, 10 di impaginazione,
17 di primo accesso, 8 di terminologia, 61 di UI-006.

La regressione visiva **non** è coperta: 60 comparazioni saltate, nessun
riferimento approvato. Queste modifiche cambiano l'aspetto della prima
schermata, quindi quando i riferimenti verranno approvati andranno approvati
guardando anche questa.

`npm run verifica`: exit 0 — segreti, 63 moduli senza collisioni fra nomi
globali, impronta coerente nei quattro punti, 63 js e 7 css allineati fra
`ORDINE.txt`, `index.html` e `sw.js`, backlog coerente, 29 unitarie, 19
d'integrazione, 117 di avvio.

---

## 3-bis. Che cosa ha trovato la revisione

Il lavoro è stato riletto misurando invece di rileggere, e ha trovato quattro
difetti nel codice appena scritto. Tutti e quattro corretti, tutti e quattro
con una prova che li tiene.

**a) Il riquadro del tour si dichiarava modale e non lo era.** Misurato: col
tour aperto, tre `Tab` portavano il fuoco fuori dal riquadro, sui
collegamenti della pagina. `aria-modal="true"` su un dialogo che non
trattiene il fuoco mente a chi lo ascolta — e nasconde alle tecnologie
assistive **tutto il resto della pagina**, cioè proprio la parte che il
riflettore sta illuminando. Un tour che dice «guarda qui» e rende
irraggiungibile il «qui» non serve a niente. Attributo rimosso: resta un
dialogo non modale, con tre vie d'uscita.

**b) Il fuoco andava perduto premendo «Ho capito».** Misurato:
`document.activeElement` diventava `BODY`. Il fumetto non sta nell'HTML
disegnato — viene montato dopo — quindi il ripristino del fuoco di `render()`
non lo trovava. Ora il fuoco segue il fumetto successivo, e **solo** se era
davvero dentro il fumetto: rubarlo a chi stava altrove sarebbe stato un
difetto peggiore, e c'è un'asserzione per entrambe le direzioni.

**c) La modalità scoperta proponeva funzioni dentro parti spente.** Il
filtro era scritto a mano su due id — `routine` e `note` — e lasciava fuori
etichette, modelli, «in attesa» e i due rituali, che si spengono allo stesso
modo. Conseguenza misurata: con le etichette spente (il predefinito, in
modalità semplice) il pannello proponeva di usare le etichette. Ora ogni voce
dichiara il proprio `modulo` e la regola è una.
Nello stesso punto è caduto un ramo su `i.tags`, un campo che in questo
schema non esiste: dava l'impressione di coprire un caso in più senza
coprire niente.

**d) Tre avvisi della stessa famiglia, tre regole diverse.** «Non mostrarmele
più» spegneva i fumetti di sezione e l'avviso sulle voci iniziali, ma non la
riga della promessa. Ora l'interruttore vale per tutti e tre.

E una cosa **verificata e lasciata com'era**: la home di chi torna, con tutto
già visto, contiene **zero** elementi aggiunti da questo lavoro — misurato
contando i nodi di ognuna delle sei classi introdotte. Il peso è solo per chi
arriva.

## 4. Due allarmi esaminati e respinti

Vale scriverli: sono i due modi in cui questo lavoro poteva peggiorare il
prodotto invece di migliorarlo.

**«L'ingresso guidato va rifatto come tour.»** No: le sue cinque schermate
raccolgono **scelte** — profilo, fascia oraria, prima priorità — e un tour
sopra la pagina non può raccogliere niente. Sono due cose complementari, e
sostituire l'una con l'altra avrebbe perso le scelte. Il tour arriva **dopo**,
e mostra dove stanno le cose che quelle domande hanno configurato.

**«La checklist di attivazione va sostituita con i cinque passi richiesti.»**
I sei traguardi esistenti si spuntano **da soli**, dichiarano il perché e il
dove, e spariscono quando hanno finito: sostituirli con un elenco diverso
avrebbe toccato due voci per aggiungerne due, cioè avrebbe **rimosso**
funzionalità. È stato aggiunto il traguardo mancante — «completa una cosa che
si ripete» — e corretto il conteggio bugiardo.

---

## 5. Verifica su desktop e su telefono

| | desktop 1280 | telefono 375 |
|---|---|---|
| l'ingresso compare da solo | sì | sì |
| il tour dopo l'ingresso | sì, 5 tappe | sì, 5 tappe |
| riflettore sul bersaglio giusto | 4 tappe su 4 | 4 su 4 |
| posizione del riquadro | sotto/sopra il bersaglio secondo lo spazio | sempre in basso, sopra la barra |
| scorrimento orizzontale | **0** | **0** |
| la promessa in cima | sì | sì |
| avviso sulle voci di partenza | sì, col conto della sezione | sì |
| spiegazioni a schermo insieme | **1** | **1** |
| badge a modalità spenta | **0** | **0** |
| errori in console | **nessuno** oltre a quello noto e documentato | idem |
| contrasto | 0 testi sotto soglia nei due temi (axe + misura composita) | idem |
| bersagli dei comandi nuovi | tutti ≥ 24px | tutti ≥ 24px |

Zoom al 200% (640×450) compreso nelle 26 condizioni del censimento di
impaginazione, rieseguito dopo queste modifiche: 0 scorrimenti orizzontali,
0 sovrapposizioni, 0 contrasti sotto soglia, **una** colonna per i titoli.

---

## 6. Che cosa resta migliorabile

| | Perché non è stato fatto |
|---|---|
| **la suite è dichiarata in pipeline ma non ci ha ancora girato** | il passo «Primo accesso (UI-008)» è ora in `.github/workflows/verifica.yml`, fra UI-007 e le sentinelle, su entrambi i browser. Ma la pipeline si avvia con un push, e il push non è stato fatto: quindi **l'esito in pipeline non esiste ancora**. Dichiarato non è eseguito, e l'unico modo di saperlo è guardare l'esecuzione |
| **119 comandi sulla home restano 119** | ridurli significa spegnere parti, e spegnere parti a nome dell'utente è esattamente ciò che questa iterazione non doveva fare. La leva esiste già e ora è spiegata: profilo e parti, con «Voglio vedere meno cose» fra le domande rapide che ci porta |
| **la striscia degli strumenti resta la prima cosa in pagina** | otto collegamenti che portano **fuori** dal pannello, prima di qualunque contenuto. Ha ora un nome per i lettori di schermo, ma la gerarchia non è stata cambiata: spostarla è una decisione di prodotto, non un difetto misurabile |
| **il riquadro del tour può coprire il fondo del bersaglio** | quando il bersaglio è più alto dello spazio libero non esiste una posizione che non ne copra una parte. Misurato sulla scheda delle priorità, alta 511px su 800 |
| **le spiegazioni non coprono tutte le sezioni** | otto su una dozzina. Mancano quelle delle sezioni che compaiono solo in modalità avanzata: vanno scritte guardandole, non a memoria |
| **nessuna prova con un lettore di schermo reale** | A11Y-004, invariato: axe trova circa un terzo dei problemi |
| **nessuna prova su dispositivo fisico** | MOB-001 e MOB-002, invariati: l'emulazione di una larghezza non è un telefono |
| **la regressione visiva resta a zero copertura** | TST-006, invariato: nessun riferimento approvato, e queste modifiche cambiano l'aspetto della prima schermata — quando i riferimenti verranno approvati, andranno approvati **dopo** aver guardato questa |
