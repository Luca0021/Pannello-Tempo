# PROFILI-REPORT.md

Profili, modalità e personalizzazione dei moduli: che cosa esisteva già, i
quattro difetti misurati, le correzioni e le prove che li tengono chiusi.

Questo documento nasce da un'analisi del codice eseguita prima di toccarlo, ed
è il seguito di `SET-002` — il ticket che aveva separato i tre concetti nei
testi dell'interfaccia senza che il codice li tenesse separati davvero.

---

## 1. L'architettura, così com'era già

Non è stata riscritta, e non doveva esserlo. Va però scritta, perché metà
delle cose che sembravano da aggiungere c'erano già.

### I tre profili

Definiti in `js/modules.js`. **Nomi e identificativi non sono cambiati.**

| id | nome | moduli accesi |
|---|---|---|
| `essenziale` | Essenziale | `note` (1) |
| `pianificatore` | Pianificatore | `routine, note, bloccati, modelli, coach` (5) |
| `completo` | Completo | gli 11 opzionali |

I tre insiemi crescono l'uno dentro l'altro — Essenziale ⊂ Pianificatore ⊂
Completo — e c'è una prova che lo verifica, perché un profilo «intermedio» che
spegne qualcosa che il profilo «minimo» accende sarebbe incomprensibile da
spiegare.

### I quattordici moduli, e chi vince

`moduloAttivo(id)` è l'unica fonte di verità, e risolve in quest'ordine:

1. il modulo è `core` → sempre attivo (`oggi`, `agenda`, `rituale`);
2. esiste una scelta esplicita in `settings.moduli[id]` → **vince sul profilo**;
3. il profilo attivo elenca il modulo → attivo;
4. c'è un profilo e non lo elenca → spento;
5. nessun profilo → decide il `predefinito` del modulo; quelli marcati
   `"avanzato"` seguono la modalità, **e solo in questo caso**.

Dipendenze dichiarate: `energia → agenda`, `coach → rituale`. `attivaModulo`
le propaga nei due versi.

### Dove vivono i dati

`pref()` e `setImp()` scrivono in `S.data.settings`, quindi profilo e moduli
sono dati **sincronizzati**, non preferenze di dispositivo. Nello schema
predefinito: `profilo: null`, `moduli: {}`. Dati più vecchi che non hanno
quelle chiavi passano dal ramo 5, quindi la compatibilità retroattiva non
richiede migrazione — e ora una prova lo verifica cancellando le due chiavi.

### La personalizzazione, che esisteva

`anteprimaProfilo(id)`, `conseguenzeSpegnimento(id)`, `ripristinaPreset()` e
`sceltePersonali()` erano già lì, e l'interfaccia già mostrava l'anteprima di
un profilo prima di applicarlo e le conseguenze dello spegnimento di una parte
con il conto delle voci vere. Nulla di questo è stato duplicato.

### Profili e piani commerciali

`PROFILI` sta in `js/modules.js`, `PIANI` in `js/plans.js`, nessun punto del
codice li collega, e nell'interfaccia stanno in due cassetti diversi. Una
prova lo blocca: nessun id, nome, «per chi è» o beneficio di un profilo può
contenere una parola commerciale o un prezzo.

---

## 2. I quattro difetti, misurati

### 2.1 Il profilo cambiava la modalità, e il codice diceva il contrario

`applicaProfilo` eseguiva:

```js
setImp("modo", id === "completo" ? "avanzata" : "semplice");
```

Diciassette righe più sotto, il blocco `SET-002` dello stesso file dichiara la
regola opposta: **«il profilo tocca i moduli, la modalità no»**.

La conseguenza non era teorica. Chi lavorava in modalità avanzata e scegliesse
«Pianificatore» per spegnere due sezioni si ritrovava anche con meno dettaglio
dentro quelle rimaste, e l'anteprima del profilo — che elenca parti accese,
parti spente e scelte dimenticate — **non nominava la modalità**. Va contro il
principio «le personalizzazioni dell'utente devono essere preservate».

**Corretto**: `applicaProfilo` tocca soltanto `profilo` e `moduli`. La
modalità coerente col profilo resta una proposta e vive dove una proposta si
può vedere e rifiutare — l'ingresso guidato — attraverso `modoSuggerito(id)`,
che *restituisce* un valore e non scrive niente.

### 2.2 La modalità non aveva un comando

Questo difetto è emerso correggendo il primo, ed è il più grave dei quattro:

`data-act="modo"` esiste in `js/events.js` dal ticket che l'ha introdotto, con
il commento «resta raggiungibile: i profili la impostano, e il comando serve a
chi arriva da dati vecchi o dalle scorciatoie». **Nessuna schermata disegnava
quel comando, e nessuna scorciatoia lo invocava.** Verificato cercando
`data-act="modo"` in tutti i moduli: un solo risultato, il gestore.

Quindi l'unico modo di cambiare modalità *era* scegliere un profilo. Togliere
l'accoppiamento senza aggiungere il comando avrebbe reso la modalità
irraggiungibile — una regressione peggiore del difetto di partenza.

**Corretto**: il comando c'è, nella scheda «Come vuoi usare il pannello»,
accanto al profilo, perché le due domande sono vicine e diverse: *quali parti
vedo* e *quanto dettaglio dentro quelle parti*.

### 2.3 Il ritorno al preset si eseguiva subito

`preset-ripristina` chiamava `ripristinaPreset()` e mostrava un toast.
L'utente leggeva un conteggio prima («3 parti sono diverse dal profilo
scelto») e un altro conteggio dopo: **quali** tre parti stessero tornando
indietro non lo sapeva in nessuno dei due momenti.

**Corretto**: il comando apre la stessa scheda di conferma delle altre azioni
che togliono qualcosa — `role="alertdialog"`, nome accessibile, due vie — e la
conferma elenca **i nomi** delle parti che tornano attive e di quelle che
tornano spente, dichiara che i dati restano dove sono, che la modalità non
viene toccata e che si potrà annullare. L'annullamento è vero: prima
dell'azione viene scattata la fotografia dei dati con `snapshot()`.

Il ritorno al preset **non è** in `AZIONI_DISTRUTTIVE`, e non doveva esserlo:
quelle sono azioni sui dati, e questa tocca soltanto `settings.moduli`. Riusa
la scheda di conferma, non il registro delle azioni distruttive — così non
compare in due posti per la stessa cosa.

### 2.4 La provenienza di una parte non era visibile

L'elenco delle quattordici parti diceva «attiva» o «spenta». Che quello stato
venisse dal profilo o da una scelta fatta a mano si poteva dedurre soltanto
dal conteggio aggregato in cima.

**Corretto**: `provenienzaModulo(id)` restituisce una delle quattro origini
che sono esattamente i rami di `moduloAttivo` — `core`, `personale`,
`profilo`, `predefinito` — più un flag `diverge` che dice se una scelta
esplicita si discosta da quello che il profilo avrebbe deciso. Ogni riga porta
l'etichetta corta corrispondente, e «scelta tua» si distingue visivamente solo
quando diverge davvero.

### 2.5 Una frase che contava la cosa sbagliata

Nel correggere 2.4 è venuto fuori che «*N* parti sono **diverse** dal profilo
scelto» contava `Object.keys(settings.moduli).length`, cioè tutte le scelte
esplicite: una parte accesa a mano che il profilo accende comunque veniva
contata come «diversa». La frase ora dice quello che il numero è davvero —
«*N* parti seguono una tua scelta invece del profilo».

---

## 3. La comunicazione dei profili

Il campo `per` dice **a chi somiglia** il profilo, in prima persona, ed è la
risposta alla domanda dell'ingresso guidato («quanto vuoi vedere all'inizio?»).
Non dice che cosa ci si guadagna, e un elenco di parti accese non lo spiega.

È stato **aggiunto** un campo `beneficio`, non sostituito `per`: i nomi e i
testi esistenti che funzionavano restano.

| profilo | beneficio |
|---|---|
| Essenziale | Ti concentri sull'essenziale: le tre cose di oggi, l'agenda e la chiusura di giornata. |
| Pianificatore | Organizzi anche la settimana: ciò che torna, ciò che aspetta una risposta e i modelli di giornata. |
| Completo | Usi tutti gli strumenti: etichette, obiettivi, energia, importi e le stesse giornate su più dispositivi. |

E le tre promesse che il brief chiede di comunicare **sempre** — si può
cambiare profilo, non si cancella niente, si può tornare alla configurazione
originale — ora stanno nella scheda a prescindere dal fatto che esista già una
personalizzazione da ripristinare. Prima la terza compariva solo quando c'era
già qualcosa da ripristinare, cioè proprio a chi sapeva già che si poteva.

---

## 4. L'ingresso guidato

Il passo 2 su 5 scegliva il profilo e, di conseguenza nascosta, la modalità.

Ora, **senza aggiungere un passo**, lo stesso schermo mostra la modalità che
verrà usata («Comincerai in modalità *semplice*»), la rende cambiabile con due
comandi, e dice che si potrà cambiare dalle impostazioni. La proposta segue il
profilo finché l'utente non sceglie: da quel momento `modoScelto` la protegge,
e cambiare profilo non la sovrascrive più.

Chi è **già configurato** e rivede la presentazione riprende la propria
modalità, e `modoScelto` parte già vero: rivedere una presentazione non deve
cambiare di nascosto una scelta fatta mesi prima.

La modalità viene applicata **soltanto** da `applicaScelteOnboarding()`. Il
cambio di profilo dalle impostazioni non la riapplica: è la richiesta, e c'è
una prova per verso.

---

## 5. Le prove

Prima di questo intervento la logica dei profili **non aveva un solo test**:
le uniche tracce in `tests/` erano quattro chiamate a `attivaModulo` dentro
`primo-accesso.spec.js`, usate per preparare lo stato di un'altra prova. Era
il buco di copertura più grande del pannello, perché `moduloAttivo` decide
quali sezioni esistono.

| file | prove | che cosa copre |
|---|---|---|
| `tests/unit/profili.test.js` | 33 | identità dei tre profili, i cinque rami di `moduloAttivo`, precedenza delle scelte esplicite, dipendenze, compatibilità con impostazioni senza le due chiavi, provenienza, anteprima del ripristino, ripristino che non tocca i dati, separazione dai piani |
| `tests/ui/profili.spec.js` | 30 | che il comando della modalità esista nella pagina, che il profilo non la muova, che l'ingresso la mostri e la applichi, che la conferma preceda l'azione e nomini le parti, che annullare non cambi niente, che la provenienza si legga — e le stesse cose **a 320, 375, 393px e a zoom 200%**, nei due temi (§7) |

### Controprova

Una prova che non fallisce sul difetto non prova niente. Entrambe le suite
sono state eseguite contro il codice difettoso:

- **unitarie**: rimettendo la riga `setImp("modo", …)` in `applicaProfilo`,
  **5 prove su 33 cadono** con i valori attesi al contrario
  («atteso "avanzata", ottenuto "semplice"»). Rimossa di nuovo: 33 su 33;
- **browser**: puntando la suite al **sito pubblicato** — commit `24b2d87`,
  che è il codice di prima — **16 prove su 18 cadono**. Le due che passano
  sono quelle che non dipendono dalle aggiunte.

### Regressione

`tests/runner.js` completo: 6 file su 6, 19 prove di sincronizzazione
comprese. Suite del browser al completo su chromium: **187 su 187**, che sono
le 169 di prima più le 18 nuove. Nessuna prova esistente è stata modificata.

`strumenti/controlla-globali.mjs`: 63 moduli, 636 nomi globali, nessuna
collisione. Nessun modulo JavaScript è stato aggiunto, quindi `js/ORDINE.txt`,
`index.html` e `sw.js` non cambiano numero di file.

---

## 6. Che cosa NON è stato fatto, e perché

- **Nessuna rinomina**, nessun identificativo cambiato, nessun quarto profilo,
  nessuna modifica a quali moduli appartengono a quale profilo.
- **`backlog.json` non è stato toccato.** Ci sono tre ticket — `SET-001`,
  `SET-002`, `SET-003` — citati nel codice e assenti dalla matrice. Aggiungerne
  uno solo farebbe diventare «SET» un'area nota, e allora
  `strumenti/backlog.mjs` segnalerebbe gli altri due come citati-e-assenti:
  o si aggiungono tutti tre con una descrizione della verifica che per due di
  essi non posso eseguire, o nessuno. È un buco reale e precedente a questo
  intervento, e resta dichiarato qui invece di essere riempito con
  affermazioni non verificate.
- **Il ritorno al profilo precedente non riporta le personalizzazioni**, perché
  erano già state dimenticate al primo cambio. Il comportamento non è
  cambiato: è dichiarato in anticipo dall'anteprima («Dimentica *N* scelte
  fatte a mano»), e ora anche da una prova.
- **Nessuna verifica su telefono fisico** per questo intervento, e una
  pipeline verde non è una verifica su un telefono vero.

> **AFFERMAZIONE CORRETTA.** La prima versione di questo elenco diceva che le
> modifiche visibili erano «tutti già coperti dalle prove di impaginazione e
> accessibilità alle larghezze da 320px in su». **Non era vero**, e il §7
> racconta che cosa si è trovato andando a guardare: quelle suite spazzano la
> pagina *a riposo*, e i tre stati introdotti qui non esistono a riposo.

---

## 7. Gli stessi stati, su uno schermo da telefono

`tests/ui/profili.spec.js` girava soltanto a 1280×900. Non era una
dimenticanza innocua: i tre stati che il commit ha introdotto **non esistono
nella pagina a riposo** — il comando della modalità sta in fondo a otto
sezioni di impostazioni, il badge «scelta tua» compare solo con una
personalizzazione, la scheda di conferma solo dopo un clic. Nessuna delle
suite che misurano a 320, 375 e 393px li aveva quindi mai visti, e la loro
verdura non diceva niente su di essi.

Il censimento — cinque larghezze per due temi, più il passo dell'ingresso
guidato — ha prodotto 45 segnalazioni. Vagliate: **due difetti veri, un
allarme del mio strumento di misura, e una crescita dichiarata.**

### 7.1 La conferma nasceva fuori dallo schermo

La scheda dei profili sta in fondo alle impostazioni, quindi al momento del
clic la pagina è scorsa di quasi settemila pixel; la scheda di conferma viene
però disegnata in cima, nella zona «priorità».

Misurato a 393×852: dialogo a **5618 pixel sopra il bordo della vista**, fuoco
rimasto sul pulsante premuto. Premere «Torna al preset» non produceva niente
di visibile. Lo stesso a 1280×900 (−3387px): non era un problema di telefono,
era un problema che solo una prova *non* fatta a pagina ferma poteva trovare.

`S.inCima` non bastava — riporta a zero, e il dialogo sta a y 1636 — quindi si
usa l'ancora, che nel pannello esiste proprio per questo: `riporta()` scorre
finché l'elemento non ha il `top` richiesto nella vista. Il fuoco entra nel
dialogo, che ha ricevuto `tabindex="-1"`: un `role="alertdialog"` che non
riceve il fuoco viene annunciato a metà.

Dopo: dialogo a `top = 12` a 320, 375, 393, 412 e 1280px, «Torna al preset»
visibile senza scorrere, fuoco sul dialogo, zero scorrimento orizzontale.

### 7.2 Il bordo del badge «scelta tua» era sotto la soglia

Era `border-color: var(--brass)`, copiato da `.due-soon`, con un commento che
dichiarava il contrasto «già coperto dalla prova di accessibilità». Non era
vero: nessuna prova misura il bordo di uno `.slot`. Misurato: **2,95:1 in tema
chiaro** contro il 3:1 che il progetto si è dato per il non testuale, e 6,55:1
in tema scuro — ed è il motivo per cui guardando un tema solo non si vedeva.

Ora il bordo è `currentColor`, cioè lo stesso `--brass-testo` del testo: 7,02:1
in chiaro, 6,55:1 in scuro. Nessun colore nuovo. Lo stato resta identificato
dalla **parola** — «scelta tua» contro «dal profilo» — e il bordo è rinforzo.

### 7.3 Un allarme che era del mio strumento

Il censimento segnalava «il segmento non premuto della modalità è a 1,75:1»,
a tutte le larghezze e in tutti i temi. Era il calcolatore: raccoglieva i fondi
risalendo gli antenati e, se il primo era semitrasparente, lo usava così com'è
invece di comporlo su quello sotto. Il fondo `rgba(15,27,36,.07)` di `.seg`
finiva trattato come un quasi nero.

Composto bene: **8,51:1 in chiaro, 6,85:1 in scuro**. Nessun difetto. Il
modello `.seg` è quello che il pannello usa già per «Sfondo» e non è stato
toccato; la correzione sta nel calcolatore, che ora compone gli strati dal
basso ed è quello che le prove nuove usano.

### 7.4 Il passo del profilo è più alto di uno schermo da 320px

Misurato a 320×568, confrontando col sito pubblicato che è il codice di prima:

| | 24b2d87 | dopo il commit | adesso |
|---|---|---|---|
| altezza del passo | 762px | 1067px | **1028px** |
| «Avanti» | y 508, sopra la piega | y 813, sotto | y 774, sotto |

I 266 pixel di crescita si dividono così: **144** il beneficio dei tre profili
— contenuto approvato, che non si toglie —, **58** la riga della modalità, **39**
la sua didascalia, già accorciata da 78 togliendo la frase che ripeteva quello
che la riga in cima al passo dice da sempre.

«Avanti» sopra la piega a 320px **non è una regola che questo progetto si è
dato**, e riportarlo là vorrebbe dire togliere una delle due cose che il passo
deve dire. Non lo dichiaro corretto: lo dichiaro misurato. Quello che è una
regola, e che le prove nuove fissano, è che a quella larghezza non ci sia
scorrimento laterale, che niente sia tagliato, che il comando per andare
avanti sia raggiungibile, a misura piena, e funzionante.

### 7.5 Due difetti trovati e non corretti, dichiarati

Il censimento ne ha trovati altri due, **entrambi precedenti a questo lavoro**
e fuori dal perimetro di questa fase. Non li ho toccati, e non li dichiaro
corretti:

1. **Le conferme distruttive hanno lo stesso difetto della 7.1.** Misurato:
   premendo un'azione in «Backup e dati» il dialogo nasce a 10069 pixel sopra
   il bordo della vista. Vale per «Svuota le attività», «Cancella tutto» e le
   altre. La correzione è la stessa riga usata qui — impostare
   `S.ancora = { sel: '[role="alertdialog"]', top: 12 }` prima di `render()`
   nel ramo `distr` di `js/events.js` — ma il flusso delle azioni distruttive
   è il più delicato del pannello e non è ciò che questa fase autorizzava.
2. **`.pt ul.linklist .sub` dichiara `word-break: break-all`**
   (`css/components.css`), e le descrizioni delle parti si spezzano a metà
   parola: misurate «tor|nano», «Tem|po.», «Nes|sun» a 375 e 393px, con i due
   rettangoli del Range a prova. È il costrutto che un brief precedente ha
   escluso come soluzione generale. La correzione sarebbe togliere
   `word-break: break-all` lasciando `overflow-wrap`, che spezza una parola
   solo quando non c'è altro modo — ma quella regola vale per **ogni**
   `ul.linklist` del prodotto, e non è una riga da cambiare dentro una fase
   sui profili.

*Il primo dei due è stato invece corretto subito dopo, perché la stessa riga
CSS che ha risolto il §7.6 copre anche il titolo di quella conferma.*

---

## 7.6 Il titolo della conferma sfondava la vista, e solo la CI lo vedeva

Il commit che ha portato le prove sul telefono ha fatto **fallire la
pipeline**: `Verifica` #8, passo «Profili, modalità e personalizzazione», su
**entrambi** i browser, asserzione 96 «nessuno scorrimento orizzontale» a
320px — `5` su chromium e `55` su firefox, **due volte su due**, anche al
retry. In locale la stessa prova dava 0.

### La causa, dimostrata

`css/components.css:257` dichiara `.pt h2 > span:first-of-type{flex:none;}`.
`flex:none` è `0 0 auto`: il titolo non si restringe e quindi non va a capo.
Per una scheda normale non si nota — i titoli sono corti — ma le due schede di
**conferma** hanno titoli lunghi quanto una frase:

```
span#ptit «Tornare al preset di «Essenziale»?»   largo 264,66
h2 che lo contiene                               largo    246   → sporge 18,66
margine residuo fino al bordo della vista a 320px         18,34 → overflow 0
```

Allungando il titolo a parità di viewport e di font, l'overflow del documento
è **esattamente** `span.right − clientWidth`:

| titolo | span largo | overflow |
|---|---|---|
| vero | 264,66 | 0 |
| +4 caratteri | 300,02 | 17 |
| +8 | 335,36 | 52 |
| +12 | 370,72 | 88 |
| +20 | 441,41 | 158 |

I 5px di chromium e i 55 di firefox stanno dentro questa curva: corrispondono
allo stesso titolo reso circa il 9% e il 28% più largo. La metrica tipografica
del runner è **la variabile**; la causa è il titolo che non può restringersi.
Senza `flex:none` un font più largo manderebbe semplicemente il titolo a capo.

### La correzione, e quella sbagliata scartata prima

La prima proposta — `min-width:0` — è stata **provata a runtime e bocciata**:
zero pixel di differenza, perché con `flex-shrink: 0` il minimo non viene mai
raggiunto. Le varianti, misurate a 320px:

| variante | titolo vero | +8 | +20 |
|---|---|---|---|
| `flex:none` (com'era) | 0 | 52 | 158 |
| `min-width:0` da solo | 0 | 52 | 158 |
| `flex:0 1 auto` | 0 | 0 | 0, ma sporge ancora 37,44 |
| **`flex:0 1 auto; min-width:0`** | **0** | **0** | **0**, sporge 0 |
| `+ overflow-wrap:anywhere` | 0 | 0 | 0, ma su tre righe |

Applicata: `.pt [role="alertdialog"] h2 > span:first-of-type{flex:0 1 auto;
min-width:0;}`. `flex-grow` resta 0 perché un titolo che si allarga
spingerebbe via la righetta `::after` sugli schermi larghi; niente
`overflow-wrap:anywhere` perché il titolo ha spazi e andare a capo fra le
parole basta. A 320px il titolo passa da una riga sfondata a due, e l'`h2` da
53 a 75 pixel. Nessun `!important`, nessun `overflow-x:hidden`, nessun testo
rimpicciolito, nessun troncamento.

### La misura che mancava

L'asserzione 96 guarda il **documento**: vede il difetto solo quando il titolo
supera il bordo della vista, quindi in locale taceva e in CI parlava. Accanto
c'è ora la **98**, che guarda il **contenimento** — `span.right ≤ h2.right` —
ed è vera o falsa a prescindere da quanto è largo un carattere. Controprova:
tolta la regola CSS, la 98 fallisce **in locale** con `Received: 18.66`.

E poiché di conferme ce ne sono due, due prove nuove aprono anche quella delle
azioni distruttive: senza la regola, l'asserzione 103 cade su entrambe con
`flex-shrink 0`. Il difetto latente del §7.5 è quindi chiuso per la parte
tipografica; resta aperta quella dello scorrimento.
