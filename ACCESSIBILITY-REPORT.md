# ACCESSIBILITY-REPORT.md

**Che cosa è stato misurato, con quali numeri, e che cosa resta fuori.**

Build di riferimento: vedi `build.json`, campo `sorgenti`. Riferimento
normativo: WCAG 2.1 livello AA, più il criterio 2.5.8 di WCAG 2.2.

Una premessa che vale per tutto il documento: **«nessuna violazione axe»
non significa «accessibile»**. axe trova circa un terzo dei problemi reali,
e il terzo che trova è quello meccanico. Le misure qui sotto sono state
scritte per coprire tre cose che axe non fa — il contrasto composto sui
gradienti, il contrasto dei comandi, la dimensione dei bersagli con
l'eccezione di spaziatura — e sono proprio quelle che hanno trovato i
difetti.

---

## 1. Che cosa è stato eseguito, e in quante condizioni

Le misure girano nel browser sulla build servita su `http://localhost`, non
da `file://`, dove la Content Security Policy non si applica. Lo strumento è
`_collaudo.js`, che **non fa parte della release**: è escluso dall'impronta
della build in `strumenti/build.mjs` e in `_pt_build.ps1`.

Cinque viste — home essenziale, modulo di aggiunta in modalità avanzata,
dettaglio di un task con tutti i campi aperti, impostazioni con tutte le
schede aperte, densità compatta — per **quattro condizioni** di tema e
larghezza, più due condizioni ulteriori sul solo contrasto:

| Condizione | Testi | Comandi | Bersagli |
|---|---|---|---|
| chiaro 375px | 422 – 516 | 108 – 161 | 160 – 222 |
| chiaro 1280px | 451 – 545 | 110 – 163 | 163 – 225 |
| scuro 375px | 422 – 516 | 108 – 161 | 160 – 222 |
| scuro 1280px | 484 – 545 | 135 – 163 | 191 – 225 |
| auto con sistema scuro, 375px | 422 – 516 | — | — |
| chiaro 640×450 (zoom 200%) | 455 – 516 | — | — |

**Esito in tutte le condizioni: 0 fallimenti** su contrasto del testo,
contrasto dei comandi, dimensione dei bersagli, nomi accessibili, id
duplicati, riferimenti ARIA rotti, salti di livello nelle intestazioni e
scorrimento orizzontale.

### La controprova

Un auditor che non trova niente può essere corretto oppure rotto, e senza
sporcare di proposito i due casi non si distinguono. `PTCollaudo.controprova()`
assegna tre colori sotto soglia — un grigio chiaro, un nero al 18% di
opacità, un grigio medio su fondo scuro — misura, e ripristina.

Esito: **0 → 3 → 0**, in entrambi i temi. Il caso al 18% di opacità serve a
verificare che la composizione alpha funzioni: senza di quella, un testo
semitrasparente passerebbe sempre.

---

## 2. I difetti trovati misurando

Nessuno di questi si vede leggendo il codice. Tutti sono stati trovati
eseguendo una misura, e per ognuno la correzione è nel sorgente con il
motivo scritto accanto.

### Contrasto dei comandi (1.4.11) — il più diffuso

**31 campi e ogni pulsante contornato erano sotto soglia, in entrambi i
temi.** Il bordo usava `--line2`, che è un colore da separatore: 1,50:1 sul
fondo delle schede in tema chiaro, 1,70:1 in tema scuro. Per un campo di
testo bianco dentro una scheda bianca il bordo è **l'unica cosa che dice che
lì c'è un campo**: senza contrasto, il campo non si vede che esiste.

La correzione non è stata scurire `--line2` — quello avrebbe appesantito
tutti i separatori senza alcun guadagno, perché la 1.4.11 non si applica a
ciò che è decorativo. È stato introdotto `--bordo-campo`, usato **solo** per
i contorni dei comandi:

| | Valore | Peggior fondo | Rapporto |
|---|---|---|---|
| chiaro | `#677983` | griglia sopra la tappa scura della pagina, rgb(206,213,217) | 3,05:1 |
| scuro | `#728B9A` | pannello di modifica, rgb(49,60,68) | 3,16:1 |

Il «peggior fondo» è stato **misurato**, non ipotizzato: la prima scelta
(`#7E9099` in chiaro, `#607888` in scuro) copriva il fondo delle schede e
cadeva a 2,44 – 2,50:1 dove i comandi stanno davvero.

### Testo secondario sotto soglia — e una correzione della correzione

`--muted` era già stato corretto una volta, da `#78888F` a `#55646D`,
dichiarando come caso peggiore il punto più scuro dello sfondo di pagina
(`#DAE1E4`, 4,63:1).

**Quel caso peggiore era sbagliato.** Sopra quella tappa passa anche la riga
della griglia, e il composito dei due livelli scende a rgb(206,213,217),
dove `#55646D` dà **4,13:1**. Tredici testi erano sotto soglia — l'occhiello
dell'intestazione, i suggerimenti, i titoli di sezione — e la misura
precedente non li vedeva perché non componeva i livelli di sfondo.

`#4B5861` dà 4,94:1 su quel composito e 7,19:1 sulle schede. In tema scuro
lo stesso problema si presentava sul pannello di modifica, che è più chiaro
delle schede: `#93A5B0` dava 4,43:1, ora `#9AABB5` dà 4,77:1.

### Regione di annuncio duplicata

`id="annunci"` esisteva **due volte**: una in `index.html`, fuori da `#app`,
e una creata dal diffing dentro `#app`. Due difetti in una riga:

1. un id duplicato, e `document.getElementById` restituiva sempre la prima,
   quindi la seconda non veniva mai usata;
2. e il motivo per cui la versione buona è quella fuori da `#app`: **una
   regione viva ricreata da `innerHTML` viene sostituita nello stesso momento
   in cui il testo cambia**, e un lettore di schermo può non annunciare
   nulla.

Insieme è stata rimossa `annunciaMirato()`, che non aveva un solo chiamante
in tutto il progetto e faceva riga per riga la stessa cosa di `annuncia()`.

### Sette campi senza nome accessibile

Due selettori di mese e anno, due campi data della pausa, due menù della
pausa, una casella di testo in sola lettura. Più uno il cui unico nome era
il `placeholder`, che sparisce appena si scrive: chi torna sul campo con un
lettore di schermo non sente più di che campo si tratti.

Il difetto era invisibile alla mia prima misura perché trattavo il
**contenuto** dell'elemento come nome: per un `<select>` il testo delle
opzioni non dice di che campo si tratta, e «casella combinata, settembre»
non è un nome.

Correzione: `for`/`id` dove l'etichetta è unica nella pagina, `aria-label`
dove il blocco si ripete e gli id si ripeterebbero.

### 31 etichette che non etichettavano niente

`<label class="lbl">` messi davanti a un comando senza `for` e senza
racchiuderlo. Si vedevano, e per chi non le vede non esistevano.

Non si potevano associare con `for`: quei blocchi compaiono più volte nella
stessa pagina — un editor per ogni task aperto — e gli id si ripeterebbero.
La scelta è stata: il **nome** va sul comando, con un `aria-label` che
**contiene** il testo visibile come chiede la 2.5.3, e la didascalia diventa
uno `<span class="lbl">`. Nessuna regola CSS puntava all'elemento `label`,
quindi l'aspetto non cambia.

Dove la didascalia vale per un insieme e non per un campo — «Collegamento
(documento, cartella, riunione)» sopra un menù e un campo, «Passi (n di m)»
sopra un elenco e un campo — l'insieme è diventato un `role="group"` con
`aria-labelledby`.

Tre nomi sono stati estesi perché non contenevano il testo visibile:
«Scadenza» → «Scadenza (facoltativa)», e altri due così.

### I sette pulsanti dei giorni: 9×36 px, attaccati

`.dayb` era `flex:1` senza minimo, e `.dayset` aveva `style="flex:1"` **in
linea**, che vinceva sul foglio di stile e imponeva `flex-basis:0`.
Condividendo la riga con un'etichetta e un menù, a 375px ogni pulsante
restava larga **9 pixel**.

Nove pixel non si centrano col dito, e non passano né per dimensione né per
spaziatura: i cerchi da 24px dei bersagli adiacenti si sovrapponevano. Ora
lo stile in linea è rimosso, `.dayb` ha un minimo di 30px, `.dayset` va a
capo invece di strizzarsi e su schermo piccolo prende la riga intera.
Risultato: 31×32 px a 320px di larghezza, 39×32 a 375px, 115×36 a 1280px.

Nello stesso blocco altri due difetti:

- il nome di ogni pulsante era **la sola iniziale**, e «M» compariva due
  volte: chi ascolta sentiva «M, M» senza sapere quale fosse mercoledì. I
  nomi pieni erano già in `DAYNAMES`, la stessa fonte usata altrove;
- lo stato scelto/non scelto stava **solo nel colore**. Ora c'è
  `aria-pressed`, che è anche il ruolo giusto per un pulsante che resta
  premuto.

### Stati comunicati dal solo colore

`.tiny[data-on="1"]` segnava la scelta attiva con un bordo `--brass`: 2,02:1
sul punto peggiore dello sfondo di pagina. La 1.4.11 vale anche per gli
**stati**, e lì lo stato era tutto in quel bordo. Ora usa `--brass-testo`,
la variante dello stesso ottone tarata per il contrasto: 4,37:1.

Stessa correzione per i chip colorati (`.tiny.pos`, `.tiny.warn2`,
`.tiny.danger`) e per la stella delle priorità, che era `--line2`: **1,03:1
sullo sfondo di pagina**, cioè un comando che non si vedeva.

### Testo bianco su azzurro chiaro

`.dayb[data-on="1"]` scriveva `color:#fff` fisso. In tema chiaro `--pen` è
blu scuro e va bene; in tema scuro `--pen` diventa azzurro chiaro e il
bianco sopra dà **3,08:1**, sotto il minimo per un testo di 12px. Ora usa
`--btnfg`, il token che si ribalta col tema esattamente come `--pen`:
5,73:1.

---

## 3. I falsi allarmi, e perché sono utili da raccontare

Ogni riga degli auditor in `_collaudo.js` è nata da un falso allarme. Li
elenco perché chiunque riscriva quelle misure ci ricadrà, e perché mostrano
quanto è facile pubblicare un numero sbagliato con l'aria di un numero
giusto.

| Falso allarme | Causa | Correzione |
|---|---|---|
| 17 testi chiari «su fondo bianco» | il bianco era fra i **candidati** di fondo, non solo il punto di partenza dell'accumulo | il bianco è solo la base |
| il riquadro Focus, chiaro su chiaro | «opaco» non comprendeva un gradiente le cui tappe sono tutte opache | ora sì |
| **tutto** il tema scuro chiaro su chiaro | i livelli di `background-image` erano composti nell'ordine diretto: il fondo pagina è l'**ultimo** livello, e prendevo il primo — una griglia al 3,5% | composizione dal basso |
| ogni campo «invisibile» | prendevo il **minimo** fra bordo e riempimento: un campo bianco su scheda bianca con bordo perfettamente visibile risultava rotto | il massimo dei due |
| 10 comandi «sotto misura» | mancava l'eccezione di spaziatura della 2.5.8, che fa parte del criterio | cerchio da 24px |
| un pulsante primario a 1,00:1 | **transizione CSS congelata**: a pannello nascosto il renderer sospende le animazioni e la transizione resta sul valore di partenza, quindi fondo vecchio e colore nuovo | transizioni azzerate prima di misurare |
| 15 phantom sovrapposizioni | non consideravo `overflow:hidden` su un antenato di altezza zero | ora sì |
| contrasti assurdi | misuravo dentro sottoalberi `display:none` | filtro di visibilità |

L'ultima riga della tabella merita una nota. Ho passato mezz'ora a cercare
un difetto che non c'era: un pulsante che riportava testo quasi bianco su
fondo trasparente, che ignorava perfino un `background` in linea con
`!important`. La prova decisiva è stata togliere la transizione: il valore
saltava subito a quello giusto. Un auditor che non sa questo, su una scheda
in secondo piano, produce fallimenti inventati.

---

## 4. Che cosa NON è stato verificato

In ordine di importanza.

| Che cosa | Perché no |
|---|---|
| **un lettore di schermo reale** (NVDA, VoiceOver, TalkBack) | non automatizzabile, e nessuno dei tre è disponibile qui. Le misure verificano che i nomi e gli stati **esistano**, non come vengono letti |
| **axe-core** | scritto in `tests/a11y/accessibilita.spec.js`, mai eseguito: non c'è Node |
| **navigazione con la sola tastiera**, end-to-end | scritta, mai eseguita. Il confinamento del fuoco nelle schermate modali è stato verificato a mano |
| **un dispositivo fisico** | l'emulazione di viewport non è un telefono: tocco, tastiera virtuale e prestazioni sono diversi |
| **`forced-colors`** (alto contrasto di Windows) | le regole `@media (forced-colors:active)` esistono per il punto d'area e le caselle, ma non sono state provate in quella modalità |
| **ingrandimento del testo al 200%** senza zoom della pagina | verificato lo zoom (640×450), non l'ingrandimento del solo testo |
| **`prefers-reduced-motion`** | la regola esiste; l'effetto non è stato provato |
| **contrasto in movimento** | uno stato transitorio può scendere sotto soglia per una frazione di secondo, e le misure girano a transizioni azzerate — di proposito, §3 |

---

## 5. Stato dei ticket

Gli stati vivono in `backlog.json` e sono riassunti in
`BACKLOG-COVERAGE.md`. Per l'accessibilità:

| Ticket | Stato | Che cosa serve |
|---|---|---|
| A11Y-001 gerarchia delle intestazioni | **COMPLETATO** | verificato: 1 `h1`, nessun salto di livello, in 4 condizioni |
| A11Y-002 annunci per i lettori di schermo | **COMPLETATO** | verificato: una sola regione, fuori da `#app`, che sopravvive al ridisegno |
| A11Y-004 tastiera e fuoco visibile | **PARZIALE** | il passo Accessibilità verde, e una prova con un lettore di schermo reale |
| A11Y-005 campi con un nome, bersagli conformi | **PARZIALE** | il passo Accessibilità verde |
| A11Y-006 nessuna informazione dal solo colore | **PARZIALE** | il passo Accessibilità verde su tutta la pagina |

Nessuno passa a COMPLETATO sulla base di una misura fatta a mano una volta:
ciò che non è ripetibile non protegge dalla prossima modifica. Le prove che
lo renderebbero ripetibile sono scritte in
`tests/a11y/accessibilita.spec.js` — comprese le tre che hanno trovato i
difetti di §2 — e non sono mai state eseguite.
