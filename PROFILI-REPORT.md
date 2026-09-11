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
| `tests/ui/profili.spec.js` | 18 | che il comando della modalità esista nella pagina, che il profilo non la muova, che l'ingresso la mostri e la applichi, che la conferma preceda l'azione e nomini le parti, che annullare non cambi niente, che la provenienza si legga |

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
- **Nessuna verifica su telefono fisico** per questo intervento: le modifiche
  visibili sono due gruppi di comandi e una scheda di conferma, tutti già
  coperti dalle prove di impaginazione e accessibilità alle larghezze da 320px
  in su, ma una pipeline verde non è una verifica su un telefono vero.
