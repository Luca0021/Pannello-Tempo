# UI-BEFORE-AFTER.md

**UI-006 — L'indicatore dell'area Lavoro/Vita nelle righe dei task.**

| | |
|---|---|
| Build | `3322a15e59a2` → nuova build della fase |
| Ticket | UI-006 (nuovo), A11Y-002, A11Y-004 |
| Verifiche | 14 scenari strutturali eseguiti in 6 combinazioni di larghezza e tema |

---

## 1. Il problema

La riga di un task portava l'area su una **barra verticale di 4 pixel** sul
bordo sinistro, appoggiata al bordo della scheda:

```css
.pt li[data-area]{border-left:4px solid transparent;padding-left:11px;margin-left:-13px;}
.pt li[data-area="lavoro"]{border-left-color:var(--pen);}   /* blu */
.pt li[data-area="vita"]{border-left-color:var(--sage);}     /* verde */
```

E colorava anche la casella di completamento:

```css
.pt li[data-area="lavoro"] .box{border-color:var(--pen);}
.pt li[data-area="lavoro"] .box.on{background:var(--pen);border-color:var(--pen);}
```

Il commento nel codice diceva: *«La distinzione lavoro/vita è la
caratteristica del prodotto: deve vedersi prima di leggere qualsiasi
parola.»* L'intenzione era giusta, l'esecuzione no. Quattro difetti:

1. **Significato ambiguo.** Una striscia di 4px a 2px dalla casella può
   essere: il bordo della scheda, un indicatore di selezione, parte della
   casella, o l'area. Quattro letture, una sola corretta, nessun modo di
   sapere quale.
2. **Il colore era l'unico portatore dell'informazione.** Chi non distingue
   il blu dal verde — circa un uomo su dodici — non vedeva l'area affatto.
   Viola WCAG 1.4.1 (*Use of Color*).
3. **Il controllo cambiava aspetto per un dato che non lo riguarda.** La
   casella di completamento si tingeva dell'area: una casella verde e una
   blu nella stessa lista suggeriscono due stati diversi, e non lo sono.
4. **Nessun testo alternativo.** Il nome accessibile della casella era
   «Completa Finestra email»: l'area non c'era. Chi usa uno screen reader
   non aveva accesso alla caratteristica principale del prodotto.

---

## 2. Le tre alternative valutate

| | Alternativa | Pro | Contro | Scelta |
|---|---|---|---|---|
| **A** | Badge testuale «Lavoro»/«Vita» nella riga dei metadati | inequivocabile, accessibile | occupa larghezza; ripetitivo in liste già raggruppate | parziale |
| **B** | Punto colorato **più** etichetta testuale | inequivocabile, accessibile, compatto, conserva il riconoscimento a colpo d'occhio | occupa larghezza | **scelta** |
| **C** | Accento colorato sul contenitore della riga, staccato dalla casella | discreto | resta solo-colore, e sposta l'ambiguità invece di toglierla | no |

**Scelta: B.** È la sola che soddisfa insieme le due esigenze in tensione —
riconoscere l'area senza leggere (il punto) e non dipendere dal colore (la
parola). C non risolve il difetto 2, che è il più grave perché esclude
persone. A da sola perde la lettura immediata che il prodotto usa come
proprio tratto distintivo.

Con una correzione a B, richiesta dal mandato e sensata: **se la lista è già
raggruppata per area, il badge non si ripete**, perché l'intestazione del
gruppo lo ha appena detto.

---

## 3. Markup: prima e dopo

### Prima

```html
<li data-id="demo-0" data-area="lavoro">
  <button class="box" data-act="toggle" data-id="demo-0"
          role="checkbox" aria-checked="false"
          aria-label="Completa Preparare la riunione con il cliente"></button>
  <span class="txt" role="button" tabindex="0" data-act="open">
    Preparare la riunione con il cliente
    <span class="sub">in ritardo di 2h 30</span>
  </span>
  <span class="acts">…</span>
</li>
```

Note: l'area compare **solo** come `data-area`, usato dal CSS per la barra.
Nessun testo, nessun elemento visibile, niente per lo screen reader.

### Dopo

```html
<li data-id="demo-0" data-area="lavoro" class="taskriga">
  <input type="checkbox" class="box" data-act="toggle" data-id="demo-0"
         aria-label="Lavoro, Preparare la riunione con il cliente, in ritardo di 2h 30">
  <div class="taskcont">
    <span class="txt" role="button" tabindex="0" data-act="open" data-ctx="ritardo">
      Preparare la riunione con il cliente
    </span>
    <div class="metariga">
      <span class="areachip" data-area="lavoro">
        <span class="areapunto" aria-hidden="true"></span>Lavoro
      </span>
      <span class="sub late2">in ritardo di 2h 30</span>
    </div>
  </div>
  <span class="acts">…</span>
</li>
```

Tre cambiamenti di sostanza:

- **`<button role="checkbox">` → `<input type="checkbox">`.** Una casella
  vera: annunciata come casella, comandata dalla barra spaziatrice, senza
  che dobbiamo reimplementare né il ruolo né la tastiera.
- **Colonna di contenuto (`.taskcont`).** Titolo e metadati sono impilati e
  allineati fra loro; prima erano elementi in linea la cui posizione
  dipendeva dall'ordine in cui capitavano.
- **`aria-label` che comincia dall'area.** «Lavoro, Preparare la riunione
  con il cliente, in ritardo di 2h 30» — la forma richiesta dal mandato.
  L'area c'è **anche quando il badge visivo è nascosto** perché la lista è
  raggruppata: chi salta di riga in riga con uno screen reader non ha
  l'intestazione sotto gli occhi.

---

## 4. Token

Definiti una volta in `css/tokens.css`, usati da tutte le viste. Prima le
stesse misure erano scritte a mano in punti diversi e divergevano (lo spazio
fra controlli e contenuto era 10px nelle liste e 11px nell'agenda).

| Token | Valore (chiaro) | Valore (scuro) | Che cos'è |
|---|---|---|---|
| `--area-lavoro` | `#1F5673` | `#4A9BC9` | punto d'area, Lavoro |
| `--area-vita` | `#4C7C6C` | `#5FB395` | punto d'area, Vita |
| `--area-lavoro-testo` | `#1B4A63` | `#7FBEE0` | la parola «Lavoro» |
| `--area-vita-testo` | `#3D6659` | `#7FC9AE` | la parola «Vita» |
| `--area-indicator-size` | `9px` | = | diametro del punto |
| `--task-checkbox-size` | `24px` | = | lato della casella |
| `--task-control-gap` | `12px` | = | controlli ↔ contenuto |
| `--task-content-gap` | `10px` | = | titolo ↔ metadati |
| `--task-action-gap` | `6px` | = | fra le azioni |
| `--task-meta-gap` | `8px` | = | fra i metadati |

Le **misure non cambiano col tema**, quindi non sono ridichiarate nei blocchi
scuri: ridichiararle sarebbe l'inizio della prossima divergenza.

---

## 5. Viste modificate

| Vista | File | Fatto |
|---|---|---|
| Da riprogrammare | `js/features/riprogrammare-ui.js` | sì |
| Attività di oggi, routine, ricorrenti, in attesa, ricerca, raggruppate, completati | `js/features/task-list-ui.js` (`rowHtml`) | sì |
| Agenda in elenco | `js/features/agenda-ui.js` | sì — **e la casella è stata spostata a sinistra**: era in fondo alla riga, dentro le azioni |
| Riepilogo (con orario / senza orario) | `js/render.js` | sì |
| Scadenze entro sette giorni | `js/render.js` | sì |
| Posta in arrivo (note convertite) | `js/render.js` | sì |
| Passi di un task | `js/features/task-list-ui.js` | casella nativa (i passi non hanno area) |

---

## 6. Comportamento responsive

- **≥ 900px**: casella | contenuto | azioni sulla stessa riga, azioni a destra.
- **< 900px**: le azioni vanno a capo su una riga intera, **allineate al
  contenuto** (rientro pari a casella + spazio).

La soglia è 900px e non 640px per una ragione misurata: fra le due misure le
cinque azioni andavano comunque a capo, ma `margin-left:auto` le spingeva
contro il bordo destro, lontane dal contenuto a cui si riferiscono. Il
mandato chiede esplicitamente di evitarlo.

**Nessuna azione è stata nascosta dietro un menù e nessun pulsante è stato
rimpicciolito**: andare a capo basta a tenere tutte e cinque le azioni
visibili e alla loro dimensione. Se in futuro le azioni diventassero più di
cinque servirà un menù di eccedenza; oggi non serve, e aggiungerlo
introdurrebbe un gesto in più senza motivo.

Verificato: nessuno scorrimento orizzontale a 375px, 640px, 1100px e 1280px,
anche con un titolo di 70 caratteri senza spazi (`scrollWidth == clientWidth`).

---

## 7. Comportamento accessibile

| Requisito | Come |
|---|---|
| L'area nel nome accessibile | `aria-label="Lavoro, <titolo>, <dettaglio>"` su ogni casella di task |
| Nessun significato dal solo colore | punto **più** parola; verificato che tutti i badge contengano «Lavoro», «Vita» o «Area non indicata» |
| Punto decorativo | `aria-hidden="true"`, verificato su tutti i punti |
| Casella nativa | `<input type="checkbox">`, verificato che non resti nessun `<button class="box">` |
| Fuoco visibile | `outline:2px solid var(--pen); outline-offset:2px` |
| Bersaglio adeguato | 24×24 minimo (WCAG 2.2 §2.5.8), verificato su ogni casella |
| Contrasto del testo | 4,5:1, verificato: 0 fallimenti in 6 combinazioni |
| Contrasto del punto | ≥3:1 (WCAG 1.4.11): 7,81:1 chiaro, 5,06:1 scuro |
| Modalità a contrasto forzato | `@media (forced-colors:active)`: bordo e punto passano a `CanvasText` |
| Area assente o non valida | badge «Area non indicata», bordo tratteggiato, e `nomeAccessibile` restituisce «Area non indicata, …». **Non** si ricade in silenzio su «Lavoro** |

---

## 8. I 14 scenari, e come sono stati verificati

Verifiche **strutturali sul DOM disegnato**, non sulla presenza del CSS.
Sorgente: `tests/ui/ui006.spec.js` (per la pipeline) e `_collaudo.js` (lo
strumento usato in questa sessione, non incluso nella release).

| # | Scenario | Come si verifica |
|---|---|---|
| 1 | nessuna barra attaccata alla casella | per ogni `li[data-area]` visibile, `borderLeftWidth` == 0 o colore trasparente |
| 2 | casella nativa | ogni `.box` è `INPUT[type=checkbox]` |
| 3 | bersaglio ≥ 24 | `min(width,height)` di ogni casella |
| 4 | area non solo colore | ogni `.areachip` contiene «Lavoro», «Vita» o «Area non indicata» |
| 5 | punto decorativo nascosto | ogni `.areapunto` ha `aria-hidden="true"` |
| 6 | nome accessibile con area | ogni casella di task: `aria-label` inizia con l'area |
| 7 | spazio casella ↔ contenuto | distanza orizzontale ≥ 8px |
| 8 | separatore indipendente dall'area | dentro la stessa lista, `borderBottomColor` uguale per Lavoro e Vita |
| 9 | nessuna sovrapposizione | rettangoli visibili (ritagliati dai contenitori con `overflow`), esclusa la barra fissa |
| 10 | nessuno scorrimento orizzontale | `scrollWidth == clientWidth` |
| 11 | contrasto dei testi | 4,5:1 con composizione alpha e tappe dei gradienti, caso peggiore |
| 12 | contrasto del punto | 3:1 contro il proprio fondo |
| 13 | bersagli ≥ 24 | tutti i comandi della pagina |
| 14 | badge non ripetuto | `badgeArea(i,'gruppo-area')` restituisce stringa vuota |

### Esito

| Condizione | Esito |
|---|---|
| 530px, tema auto | **14/14** |
| 1280px chiaro, modalità comoda | **14/14** |
| 1280px chiaro, modalità compatta | **14/14** |
| 1280px chiaro, con task completato, in attesa e titolo lungo | **14/14** |
| 1280px scuro | **14/14** |
| 375px scuro | **14/14** |
| 640×450 (zoom 200%) chiaro | **14/14** |

### Difetti trovati DALLE verifiche, non prima

Tre scenari hanno inizialmente fallito, e due erano difetti veri:

1. **La casella dell'agenda in elenco era a destra**, dentro il gruppo delle
   azioni, mentre in ogni altra vista è il controllo autonomo a sinistra. Due
   posizioni per lo stesso gesto nella stessa schermata. Spostata.
2. **Quattro caselle delle impostazioni erano 13×13** — la dimensione
   predefinita del browser, sotto il minimo di 24. Erano `input[type=checkbox]`
   senza classe, quindi non toccate dalla regola di `.box`. Ora la misura
   minima è dichiarata su **tutte** le caselle native del pannello, così una
   casella aggiunta domani nasce già giusta.
3. **`.profilo` non dichiarava alcun fondo**: essendo un `<button>`, prendeva
   `ButtonFace` del browser, cioè `#F0F0F0`. In tema chiaro passava
   inosservato; in tema scuro era un rettangolo grigio chiaro con testo quasi
   bianco sopra — **1,03:1**, il nome del profilo illeggibile. Corretto con
   `background:var(--surface)`.

E un difetto che avrei introdotto io, trovato prima di consegnarlo:

4. **Il diffing del DOM sincronizzava solo gli attributi.** Per una casella
   nativa lo stato vero è la **proprietà** `checked`: appena l'utente clicca,
   il browser cambia la proprietà e l'attributo resta dov'era, quindi
   `setAttribute("checked", …)` non cambia più ciò che si vede. Il difetto si
   presenta quando lo stato cambia da qualcosa che non è il clic su quella
   casella — una voce completata su un altro dispositivo e arrivata con la
   sincronizzazione, un annullamento, un ripristino da copia: i dati dicono
   «fatto» e la casella resta vuota. Corretto in `js/rendering.js` con
   `sincronizzaProprieta()`, e verificato cambiando lo stato dal codice e
   controllando che la casella lo segua.

---

## 9. Screenshot

Gli screenshot **non sono inclusi come file** in questa consegna: l'ambiente
di questa sessione dispone di un browser per le misure ma non di un modo per
scrivere immagini nel repository, e inventare dei nomi di file sarebbe peggio
che non averli.

Il collaudo che li produrrà nella pipeline è scritto e versionato:
`tests/ui/ui006.spec.js`, passo *«regressione visiva delle righe
Lavoro/Vita»*. Genera, per ognuna delle 14 combinazioni:

```
tests/ui/ui006.spec.js-snapshots/
  riprogrammare-lavoro-{chiaro,scuro}-{desktop,mobile}.png
  riprogrammare-vita-{chiaro,scuro}-{desktop,mobile}.png
  lista-mista-{chiaro,scuro}-{desktop,mobile}.png
  lista-raggruppata-desktop.png
  titolo-lungo-desktop.png
  cinque-azioni-{desktop,mobile}.png
  compatta-desktop.png
  completato-desktop.png
  in-attesa-desktop.png
  area-assente-desktop.png
  zoom-200-desktop.png
```

Alla prima esecuzione il passo **fallisce di proposito**: i riferimenti non
esistono, Playwright li crea e si ferma. È voluto — uno scatto appena
generato non dimostra che l'aspetto sia giusto, dimostra com'era in quel
momento. Vanno guardati e poi approvati:

```bash
git add tests/ui/ui006.spec.js-snapshots
git commit -m "riferimenti visivi UI-006 approvati"
```

Il comando per eseguirlo è in `RUN-CI.md`.

---

## 10. Stato del ticket

**UI-006: PARZIALE.**

Completati e verificati: la rimozione della barra, l'indicatore accessibile,
i token, la casella nativa, le sette viste, il comportamento responsive, e i
14 scenari strutturali in 6 combinazioni.

Manca, e per questo non è COMPLETATO: la **regressione visiva** non è stata
eseguita, perché in questo ambiente non c'è Node e quindi non c'è Playwright.
Finché quel passo non produce un esito, l'aspetto è verificato per misura ma
non confrontato con un riferimento approvato.
