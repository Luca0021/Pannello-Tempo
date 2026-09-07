# UI-LAYOUT-REPORT.md

**Che cosa è stato misurato dell'impaginazione, che cosa è stato corretto, e
che cosa è stato esaminato e lasciato com'era.**

Questo documento riguarda **UI-007**. Non è una revisione estetica: non c'è
una riga qui dentro che dica «più bello». Ogni voce nasce da una misura presa
in un browser vero, ha un numero prima e un numero dopo, e una prova che
fallisce se il numero torna indietro.

Il criterio con cui una voce entra: **si può contare.** Un pixel di
disallineamento si conta, un bersaglio troppo piccolo si conta, un testo
tagliato si conta. «Sembra disordinato» no, e quando l'unica cosa che avevo
era quella, l'ho scritto nella sezione degli allarmi esaminati e non
corretti.

---

## 1. Come è stato misurato

Un browser vero — Edge di sistema, tramite `PT_CANALE=msedge` — su
**26 condizioni**:

| | |
|---|---|
| Larghezze | 320, 375, 768, 1280, 1920 px, più **zoom 200%** (640×450, come nella suite esistente) |
| Temi | chiaro e scuro |
| Sezioni | Oggi, Agenda, Riepilogo, Nuovo, Filtri |

E dodici misure per condizione: scorrimento orizzontale del documento,
elementi che sporgono dal proprio contenitore, testo tagliato, bersagli sotto
24×24 e sotto 44×44, testo sotto 12px, contrasto del testo, gerarchia dei
titoli, comandi con lo stesso nome accessibile, colonne degli allineamenti,
vuoti verticali oltre 48px, sovrapposizioni fra fratelli in flusso normale,
densità della prima schermata.

Non tutte hanno trovato qualcosa, ed è un risultato anche quello:

| Misura | Esito |
|---|---|
| scorrimento orizzontale | **0 su 26** — nessuna larghezza produce trascinamento laterale |
| testo tagliato in verticale (elementi con testo proprio) | **0 su 26** |
| contrasto sotto soglia | **0 su 26**, nei due temi |
| livelli di titolo saltati | **0 su 26** |
| più di un `h1` | **0 su 26** |
| vuoti verticali ingiustificati | **0 su 26** — il massimo misurato è 20px, che è il passo della griglia |
| sovrapposizioni | **0 su 26** |
| errori in console | **1 solo**, quello noto e documentato: `frame-ancestors` ignorato in un `<meta>` |

---

## 2. I cinque difetti veri, con la misura

### 2.1 Un blocco da mezz'ora tagliava il proprio nome

**Misurato.** Nell'agenda del giorno, alla scala di 38px per ora, un blocco
da trenta minuti riceveva 19px meno 2 di margine: 17, sotto il minimo di 18
scritto in `agenda-ui.js`. Il suo contenuto ne chiede **23** — nome
dell'attività a 13px più orario a 11px, dentro 3px di riempimento sopra e
sotto — e il blocco ha `overflow:hidden`.

Un contenuto più alto del riquadro, con `overflow:hidden`, non sborda:
**sparisce**. Cinque blocchi su otto stavano così, col nome tagliato a metà
glifo. Non è una cosa che si veda leggendo il codice: si vede confrontando
`scrollHeight` con `clientHeight`, o guardando lo scatto.

**Correzione.** `HPX` da 38 a 52. La mezz'ora vale ora 26px: 24 di blocco più
il pixel di margine sopra e sotto.

**Perché non alzare soltanto il minimo a 24.** Perché i blocchi sono
posizionati in assoluto sull'ora: un minimo più alto della durata sconfina
nella fascia successiva. Alzando la scala il minimo interviene in meno casi,
invece che in più.

**La scheda non diventa più alta.** `.agscroll` ha `max-height:440px`: cambia
quanto si scorre dentro il riquadro, non quanto occupa nella pagina.
Verificato: la scheda dell'agenda misura 630px prima e 630px dopo.

| | prima | dopo |
|---|---|---|
| altezza dei blocchi | 18–55px | **24–76px** |
| blocchi sotto 24×24 | **5 su 8** | **0** |
| blocchi che tagliano il testo | 5 (contenuto 23 in riquadro 18) | **0** (contenuto 24 in riquadro 24) |

### 2.2 Nel blocco da mezz'ora la maniglia copriva il 72% della superficie

**Misurato.** `.grip` — la maniglia per allungare un blocco trascinando il
bordo inferiore — era alta **13px fisse**. In un blocco alto 18 ne copriva
13. Toccare il blocco significava quasi sempre iniziare un
ridimensionamento invece di aprire l'attività, e restavano 5px in cima per
il gesto che uno voleva fare.

Questo difetto è invisibile in ogni altro modo. Non produce un errore, non
rompe il layout, non fallisce un controllo di accessibilità: sono due
rettangoli, e va confrontata l'altezza dell'uno con quella dell'altro.

**Correzione.** `height:30%` con `min-height:6px` e `max-height:13px`: nei
blocchi lunghi la maniglia resta com'era, nei corti diventa una frazione.

### 2.3 I titoli di sezione stavano su quattro colonne diverse

**Misurato**, su 1280px:

| Bordo sinistro | Quanti | Chi |
|---|---|---|
| 120px | 4 | l'`h1` della data, e i titoli delle schede terziarie, che non hanno riempimento |
| **138px** | 10 | le schede normali: bordo 1px più riempimento 17px |
| **140px** | 1 | «Come prendere la mano» — scheda con accento da 3px |
| **141px** | 1 | «Da riprogrammare» — avviso con accento da 4px |
| 145px | 1 | l'occhiello «Pannello tempo», che segue il marchio |

Su telefono: 22, **37**, **39**, **43**, 47.

**La causa non è il caso.** Il bordo sinistro d'accento sta **fuori** dal
riempimento, quindi ogni pixel di accento sposta a destra tutto il contenuto
della scheda. Due o tre pixel non si leggono come una scelta: si leggono come
una colonna che non tiene. È il genere di difetto che si vede senza saper
dire che cosa si è visto.

**Correzione.** Il riempimento compensa l'accento, così il contenuto parte
sempre a `1px + var(--cardpad)` dal bordo della scheda. E `--cardpad` si è
spostata dalla scheda alla **radice**: `.alert` non è una `.card` e non
poteva leggerla, motivo per cui aveva un riempimento scritto a mano — che è
esattamente come nasce uno scarto del genere.

**Dopo:** una sola colonna, 138px, per tutte e dodici le intestazioni con
riempimento. I 120 e i 145 restano, e sono giusti: il primo è il bordo delle
schede senza riempimento, il secondo è l'occhiello dopo il marchio.

### 2.4 Cinque comandi autonomi sotto il bersaglio minimo

**Misurato.** WCAG 2.5.8 (AA) chiede 24×24 CSS px.

| Comando | prima | dopo |
|---|---|---|
| `.link` — «Ripristina», «Scegli più voci», «Non propormi niente» | 18–19px di altezza | **24** |
| `.foldbtn` — apre e chiude una sezione intera | 20px | **24** |
| `.oradesso` — riporta l'agenda all'ora attuale | 22px | **24** |
| `.tot .tiny` — la fascia oraria e «vista compatta», sotto l'agenda | 23px | **24** |
| `.agblk` — un blocco dell'agenda | 18px | **24** (§2.1) |

`mobile.css` alzava già `.tiny`, `.del`, `.box`, `.toolsedit` e `.star` per
il dito: **questi erano semplicemente rimasti fuori dall'elenco.** Sono
difetti del **solo desktop**, ed è il motivo per cui non erano mai emersi da
un collaudo responsive. La larghezza non cambia — il riempimento aggiunto è
verticale.

`.tot .tiny` non l'ha trovato il censimento: l'ha trovato la **prova**, la
prima volta che è girata. Vedi §5.

### 2.5 Sei classi di testo informativo sotto i 12px

**Misurato**, escludendo il testo dentro gli SVG (vedi §3.1):

| Classe | Che cosa dice | prima | dopo |
|---|---|---|---|
| `.prosslab` | «adesso», sull'appuntamento in corso | **10px** | 12 |
| `.late2` | «in ritardo di 3h 30» | 11px | 12 |
| `.agora-lab` | l'ora corrente nell'elenco del telefono | 11px | 12 |
| `.avanzalab` | gli estremi della striscia della giornata: le etichette dell'asse | 11,5px | 12 |
| `.areachip` | «Lavoro» / «Vita» — il modo **non cromatico** di leggere l'area (A11Y-006) | 11,5px | 12 |
| `.navprim.basso button` | le quattro voci della navigazione del telefono | 11px | 12 |

E altre sette classi, trovate dalla **prova** e non dal censimento — quasi
tutte etichette di un grafico, che è la parte del pannello che il censimento
guardava con meno attenzione:

| Classe | Che cosa dice | prima | dopo |
|---|---|---|---|
| `.agblk em` | l'orario e la durata **dentro** il blocco dell'agenda. Il commento nel CSS la chiama «l'informazione più densa del blocco» — e stava a 11px | 11px | 12 |
| `.hr span` | le ore nella colonna dell'agenda: l'asse verticale | 11px | 12 |
| `.gap` | «07 – 09», la fascia compressa | 11px | 12 |
| `.wkhead div` | i giorni nella vista settimanale: l'asse orizzontale | 11px | 12 |
| `.alert .late` | «era alle 09:30» | 11px | 12 |
| `.dignow`, `.digmark` | «adesso» e il numero della priorità, nel Riepilogo | 11px | 12 |

**La regola, scritta perché non diventi arbitrio:** 12px è il minimo per il
testo che porta un'informazione — un orario, un ritardo, uno stato, il nome
di una sezione dove si va. **Le etichette degli assi di un grafico sono
informazione:** senza di loro il grafico non si legge.

**Le due eccezioni, dichiarate:** `.eyebrow` («PANNELLO TEMPO») e `.proptit`
(«SE NON SAI DA DOVE COMINCIARE») restano a 11px. Sono etichette in
maiuscoletto spaziato che **nominano un posto**, non riportano un valore.
Ingrandirle sposterebbe peso visivo su ciò che non va letto per primo, che è
il difetto opposto. `tests/ui/impaginazione.spec.js` conosce l'elenco delle
eccezioni: se qualcuno ne aggiunge una terza, la prova lo fa notare.

### 2.6 La vista Riepilogo non aveva un titolo di primo livello

**Misurato.** Zero `h1` su quella schermata, in tutte le larghezze. La vista
sostituisce l'intero pannello, quindi la testata con l'`h1` della data non
viene disegnata e la struttura cominciava da un `h2`: chi naviga per titoli
non trovava il livello da cui partire.

**Correzione.** `aria-level="1"` sul titolo del riepilogo.

**Perché non cambiare il tag.** L'aspetto dei titoli di sezione pende da
**41 regole** scritte su `h2` — icona, righello, contatore, varianti per
avviso e per scheda in evidenza. Spostare un tag per far coincidere una
regola avrebbe portato più rischio del difetto che corregge. La gerarchia
*visiva* qui è già giusta: quello **è** il titolo della schermata. Mancava
solo che fosse dichiarato.

---

## 3. Due allarmi che erano miei, non del pannello

Vale la pena scriverli: sono i due modi tipici di sbagliare una misura di
impaginazione, e senza il controllo sarebbero diventati due «correzioni» a
un prodotto che non aveva niente da correggere.

### 3.1 «Il numero dentro l'anello è alto 11px»

`getComputedStyle` su un `<text>` dentro un SVG restituisce la dimensione in
**unità del viewBox**, non in pixel di schermo. L'anello è un riquadro di
62px per un viewBox di 44: la scala è 1,41, e quel numero sullo schermo
misura **15,5px**. Era il più grande fra i «minuscoli» della mia prima
lista.

Il grafico ad anelli, guardato per davvero, è in buone condizioni: due archi
concentrici, il valore scritto al centro, e un'etichetta accessibile che dice
la stessa cosa a parole — «Completate 0 attività su 10. Lavoro 0 su 6, vita
0 su 2.» Niente che dipenda dal solo colore.

### 3.2 «La barra degli strumenti è tagliata: a 320px si vede un collegamento su otto»

Misura giusta, conclusione sbagliata. A 320px la striscia mostra 1 elemento
intero su 8 (466px di contenuto in 127 di larghezza) — ma **scorre di
proposito**, e la sfumatura che lo segnala sta in `css/base.css` con il
commento che la spiega. Il mio rilevatore leggeva la proprietà sbagliata e
concludeva «nessuna affordance».

Farla andare a capo su schermo stretto avrebbe aggiunto due righe di
intestazione sopra il contenuto principale — che su telefono comincia già a
330px di 812 — per risolvere un problema che ha già una soluzione dichiarata.

**Un difetto va confrontato con le intenzioni scritte prima di chiamarlo
difetto.**

---

## 4. Esaminato e lasciato com'era, con la ragione

| Osservazione | Misura | Perché non è stata toccata |
|---|---|---|
| bersagli di **testo in linea** sotto 24px: il titolo di un'attività (22px), il nome nell'elenco dell'agenda (22px), «ogni giorno · lavoro cambia» (17px) | 22px di altezza | WCAG 2.5.8 prevede l'eccezione **inline** per i bersagli dentro un blocco di testo, e ingrandirli significa rifare la riga delle attività — che è UI-006, appena stabilizzato con 61 asserzioni. Un rischio maggiore del difetto |
| comandi con lo **stesso nome accessibile** ripetuto: «Ripianifica» ×3, «Anticipa di 15 minuti» ×8 | 12 nomi ripetuti | sono comandi **per riga**: la ripetizione è la struttura, non un doppione. Il contesto lo dà la riga che li contiene. Resta vero che il nome non nomina l'attività, ed è un miglioramento possibile — ma è un intervento sui nomi accessibili, non sull'impaginazione |
| la **navigazione primaria disegnata due volte** (in alto e in basso) | 2 nel DOM | mai visibili insieme: a ogni larghezza misurata una delle due è nascosta. NAV-001 funziona come dichiarato |
| il contenuto principale comincia a **354px** su 800 (desktop) e a **330** su 812 (telefono) | 44% e 41% | sopra non c'è spazio sprecato: 129px di testata e strumenti, e una fascia con data, contatore e anello che **è** informazione di primo livello. Il massimo vuoto misurato è 20px, cioè il passo della griglia |
| `.barrabasso` — 27 righe di CSS per una barra che nessun modulo disegna più | 0 occorrenze nel markup | è **codice morto** servito a ogni utente, e va rimosso; ma non è un difetto di impaginazione e non entra in un commit che ne corregge uno |

---

## 5. Le prove

`tests/ui/impaginazione.spec.js` — **10 prove e 63 asserzioni**: otto
combinazioni di larghezza e tema, più l'agenda e il Riepilogo.

**La prova ha trovato più del censimento**, ed è il motivo per cui vale
averla scritta invece di limitarsi a correggere. Il censimento guardava
cinque sezioni e riportava i casi peggiori; la prova applica la regola a
**ogni** elemento visibile di ogni condizione, e alla prima esecuzione ha
fatto cadere otto casi che io non avevo elencato: `.tot .tiny` a 23px, e le
sette classi di etichette a 11px del §2.5. Un difetto per volta, con la
misura in chiaro nel messaggio di errore.

Le asserzioni:

| | |
|---|---|
| 01 | nessuno scorrimento orizzontale |
| 02 | i titoli delle schede stanno su **una** colonna |
| 03 | i comandi autonomi arrivano a 24px |
| 04 | nessun testo informativo sotto 12px, con l'elenco delle eccezioni |
| 05-07 | i titoli esistono, uno solo di primo livello, nessun livello saltato |
| 08 | nessun blocco d'agenda sotto 24px |
| 09 | nessun blocco taglia il proprio testo |
| 10 | la maniglia non copre più del 45% del blocco |
| 11 | un titolo di primo livello anche nel Riepilogo |
| 12 | nessuno scorrimento orizzontale nel Riepilogo |

Le prove misurano il **livello effettivo** dei titoli, cioè quello
annunciato: `aria-level` ha la precedenza sul nome del tag. Un controllo che
guardasse solo i tag avrebbe dichiarato ancora rotto il §2.6 dopo la
correzione.

**Regressione.** Le suite esistenti sono state rieseguite dopo le
correzioni, su Chromium (canale Edge di sistema):

| Suite | Esito |
|---|---|
| `ui006.spec.js` — l'indicatore Lavoro/Vita | **61 su 61** |
| `terminologia.spec.js` e `sentinelle.test.js` | **19 su 19** |
| `cancellazione.spec.js` e `piattaforma.spec.js` — CSP, PWA, offline, responsive | **29 su 29** |
| `a11y/` — axe-core, contrasto, bersagli, nomi accessibili | **22 su 22** |
| `impaginazione.spec.js` — nuova | **10 su 10** |

Con una nota sull'ambiente, perché senza di essa il numero sarebbe
fuorviante: **a quattro esecutori in parallelo due o tre prove cadono per
timeout**, in punti diversi a ogni giro, e il messaggio è sempre
`Test timeout of 30000ms exceeded while setting up "page"` — cioè
l'avviamento del browser, non un'asserzione. Con `--workers=2`, che è quello
che usa la pipeline, non cade niente. È il limite di questa macchina già
descritto in `TEST-REPORT.md` §5, e **il tempo limite non è stato alzato**:
alzarlo avrebbe nascosto il problema invece di dichiararlo.

Una premessa di un'altra prova è cambiata, e la prova lo dice ora:
`a11y/accessibilita.spec.js` esentava i blocchi dell'agenda dal bersaglio
minimo «per altezza», perché a 18px l'altezza codifica la durata.
L'esenzione ora copre soltanto le durate **sotto** la mezz'ora.

**Una nota su un'asserzione esistente.** `ui006.spec.js` n. 13 si intitolava
«nessun bersaglio sotto 24x24» ma misura `width < 24 **&&** height < 24`:
cioè intercetta solo ciò che è piccolo in **entrambe** le dimensioni, e
lascia passare un pulsante di 112×18. È il motivo per cui i difetti del §2.4
non erano stati trovati prima. L'etichetta ora dice quello che la misura fa;
il controllo per l'altezza sta nella prova nuova, dove può essere applicato
ai comandi autonomi senza toccare i bersagli in linea.

---

## 6. Che cosa questo documento non dice

- **Non dice che l'impaginazione è finita.** Dice che nove misure su dodici
  non trovano più niente, e che le tre che trovano ancora qualcosa sono
  documentate al §4 con la ragione.
- **Non dice niente sull'aspetto.** Nessuno ha guardato questi scatti e
  approvato l'insieme: la regressione visiva ha zero riferimenti approvati
  (TST-006), quindi ciò che è verde qui è la **struttura**, non la resa.
- **Non sostituisce una prova su un dispositivo fisico** (MOB-001, MOB-002)
  né con un lettore di schermo (A11Y-004). L'emulazione di una larghezza non
  è un telefono, e axe trova circa un terzo dei problemi di accessibilità.
