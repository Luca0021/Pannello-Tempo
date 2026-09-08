/* tests/ui/primo-accesso.spec.js — il primo accesso, misurato.
 *
 * Nasce da un'osservazione eseguita in un browser: la home di chi apre il
 * pannello per la prima volta mostra 595 parole e 119 comandi, e — se salta
 * l'ingresso guidato — non contiene in nessun punto una frase che dica che
 * cosa fa il prodotto. Da lì il tour, le spiegazioni di sezione, la modalità
 * scoperta e le domande rapide della guida.
 *
 * Queste prove non controllano che «esista un onboarding»: controllano le
 * quattro promesse che si possono rompere senza accorgersene.
 *
 *   1. COMPARE UNA VOLTA. Un percorso guidato che ricompare è un difetto,
 *      e il modo più facile di introdurlo è dimenticare dove si scrive
 *      «visto».
 *   2. SI SALTA SEMPRE. Ogni cosa guidata ha una via d'uscita, e la via
 *      d'uscita vale come «l'ho visto»: non deve tornare per punizione.
 *   3. SPENTA NON SI VEDE. La modalità scoperta, a interruttore spento, non
 *      deve aggiungere UN nodo al documento.
 *   4. NON SI PRENDE MERITI. La checklist di attivazione contava come fatte
 *      due voci che il pannello aveva fatto da sé — le voci iniziali di
 *      `seed()` — e diceva «2 di 6» prima che l'utente toccasse niente.
 *
 * E una promessa sulla memoria: queste preferenze stanno nel dispositivo,
 * non nei dati sincronizzati. Se finissero nei dati, un telefono nuovo
 * erediterebbe «già visto» da un altro schermo, e chi legge la propria
 * copia di sicurezza troverebbe dentro le tracce di un tutorial.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';
const DESKTOP = { width: 1280, height: 800 };
const TELEFONO = { width: 375, height: 812 };

/* Utente NUOVO: nessuna preferenza, nessun dato, ora fissa. Il ricarico
   dopo la pulizia serve perché l'ingresso guidato viene deciso all'avvio. */
async function nuovo(page) {
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate(() => { S.now = new Date(2026, 8, 8, 9, 12, 0); render(); });
  await page.waitForTimeout(250);
}

/* Utente che ha già l'ingresso alle spalle, senza aver visto il tour: è il
   caso di chi usa il pannello da prima che il tour esistesse. */
async function giaDentro(page) {
  await nuovo(page);
  await page.evaluate(() => { saltaOnboarding(); });
  await page.waitForTimeout(300);
}

/* Preme il comando visibile: la navigazione primaria è disegnata due volte
   e a ogni larghezza una delle due è nascosta (NAV-001). */
async function premi(page, sel) {
  const t = page.locator(sel);
  const n = await t.count();
  for (let i = 0; i < n; i++) {
    if (await t.nth(i).isVisible()) { await t.nth(i).click(); await page.waitForTimeout(300); return true; }
  }
  return false;
}

const STATO = function () {
  function vis(el) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }
  const app = document.getElementById('app');
  const de = document.documentElement;
  const velo = document.getElementById('tourvelo');
  const prefs = JSON.parse(localStorage.getItem('pannello-tempo:prefs') || '{}');
  const dati = JSON.parse(localStorage.getItem('pannello-tempo:v1') || '{}');
  return {
    tourPasso: window.S.tour ? window.S.tour.passo : null,
    tourCard: !!document.querySelector('.tourcard'),
    tourTitolo: (document.querySelector('#tourtit') || {}).textContent || null,
    veloPieno: velo ? velo.classList.contains('pieno') : null,
    veloRett: velo ? (function () {
      const r = velo.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    })() : null,
    spiegazioni: [...app.querySelectorAll('.spiegazione')].filter(vis).length,
    spiegazioneTitolo: (document.querySelector('.spiegazione') || {}).getAttribute
      ? document.querySelector('.spiegazione').getAttribute('aria-label') : null,
    benvenuto: [...app.querySelectorAll('.benvenuto')].filter(vis).length,
    iniziali: [...app.querySelectorAll('.hint.avviso.iniziali')].filter(vis).length,
    badge: [...app.querySelectorAll('.badge-nuovo')].length,
    schedaScoperta: app.querySelectorAll('[data-sez="scoperta"]').length,
    faq: app.querySelectorAll('ul.faq li').length,
    guidaAperta: typeof window.S.guidaAperta === 'string',
    attivazione: (function () {
      const a = statoAttivazione();
      return { fatti: a.fatti, totale: a.totale };
    })(),
    /* dove finiscono le preferenze: locali sì, nei dati no */
    prefsVisti: Object.keys(prefs.visti || {}),
    prefsSpiegazioni: prefs.spiegazioni,
    prefsScoperta: prefs.scoperta,
    impostazioniDati: Object.keys((dati.settings) || {}),
    scorrimento: Math.max(0, de.scrollWidth - de.clientWidth),
    bersagliPiccoli: [...document.querySelectorAll('.tourcard button,.spiegazione button,.benvenuto button,ul.faq button')]
      .filter(vis)
      .map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim().slice(0, 20), h: Math.round(r.height) }; })
      .filter(x => x.h < 24)
  };
};

/* ─────────────────────────────────────────────────────────────────────────
   1. IL TOUR
   ───────────────────────────────────────────────────────────────────────── */

test.describe('primo accesso · il tour', () => {
  test.use({ viewport: DESKTOP });

  test('non compare da solo a chi è già dentro', async ({ page }) => {
    await giaDentro(page);
    let s = await page.evaluate(STATO);
    expect(s.tourPasso, '01 — nessun tour a chi ha saltato l\'ingresso').toBe(null);
    /* e nemmeno dopo un ricarico: è il caso di chi usa il pannello da mesi
       e riceve una versione nuova */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
    await page.waitForTimeout(300);
    s = await page.evaluate(STATO);
    expect(s.tourPasso, '02 — nessun tour dopo un ricarico').toBe(null);
  });

  test('si apre completando l\'ingresso, e illumina il bersaglio di ogni tappa', async ({ page }) => {
    await nuovo(page);
    await page.evaluate(() => passoOnboarding(5));
    await page.waitForTimeout(200);
    expect(await premi(page, '[data-act="onb-fine"]'), 'il comando finale dell\'ingresso').toBe(true);

    let s = await page.evaluate(STATO);
    expect(s.tourPasso, '03 — il tour parte dalla prima tappa').toBe(1);
    expect(s.tourCard, '04 — il riquadro del tour è disegnato').toBe(true);
    expect(s.veloPieno, '05 — la prima tappa non illumina niente: velo pieno').toBe(true);

    /* le quattro tappe con bersaglio: il riflettore deve avere una
       superficie, e deve stare DENTRO la finestra — un riflettore fuori
       schermo illumina il buio */
    for (let n = 2; n <= 5; n++) {
      expect(await premi(page, '[data-act="tour-avanti"]'), 'avanti alla tappa ' + n).toBe(true);
      s = await page.evaluate(STATO);
      expect(s.tourPasso, '06.' + n + ' — la tappa avanza').toBe(n);
      expect(s.veloPieno, '07.' + n + ' — questa tappa ha un bersaglio').toBe(false);
      expect(s.veloRett.w, '08.' + n + ' — il riflettore ha una larghezza').toBeGreaterThan(20);
      expect(s.veloRett.h, '09.' + n + ' — il riflettore ha un\'altezza').toBeGreaterThan(20);
      expect(s.veloRett.y, '10.' + n + ' — il riflettore comincia dentro la finestra').toBeLessThan(800);
      expect(s.scorrimento, '11.' + n + ' — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
      expect(s.bersagliPiccoli, '12.' + n + ' — comandi del tour a 24px').toEqual([]);
    }

    /* l'ultima tappa chiude, e non torna */
    expect(await premi(page, '[data-act="tour-avanti"]'), 'l\'ultimo comando chiude').toBe(true);
    s = await page.evaluate(STATO);
    expect(s.tourPasso, '13 — dopo l\'ultima tappa il tour è chiuso').toBe(null);
    expect(s.prefsVisti, '14 — «visto» sta fra le preferenze locali').toContain('tour:fatto');
    expect(s.impostazioniDati, '15 — e NON fra i dati sincronizzati').not.toContain('tour:fatto');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
    await page.waitForTimeout(300);
    s = await page.evaluate(STATO);
    expect(s.tourPasso, '16 — e non torna al ricarico').toBe(null);
  });

  test('si chiude con Esc, e chiuderlo vale come averlo visto', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => apriTour(1));
    await page.waitForTimeout(300);
    expect((await page.evaluate(STATO)).tourCard, '17 — aperto a richiesta').toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const s = await page.evaluate(STATO);
    expect(s.tourPasso, '18 — Esc lo chiude').toBe(null);
    expect(s.prefsVisti, '19 — saltarlo non è un errore da ripetere').toContain('tour:fatto');
  });

  test('non si dichiara modale, perché non trattiene il fuoco', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => apriTour(2));
    await page.waitForTimeout(350);
    const aria = await page.evaluate(() => {
      const c = document.querySelector('.tourcard');
      return { modale: c.getAttribute('aria-modal'), ruolo: c.getAttribute('role'),
               etichetta: c.getAttribute('aria-labelledby') };
    });
    /* Qui c'era `aria-modal="true"`, e contraddiceva il comportamento:
       misurato, tre Tab portavano il fuoco fuori dal riquadro. Peggio,
       `aria-modal` nasconde alle tecnologie assistive tutto il resto della
       pagina — cioè la parte che il riflettore sta illuminando. */
    expect(aria.modale, '24a — nessun aria-modal su un dialogo che non trattiene il fuoco').toBe(null);
    expect(aria.ruolo, '24b — resta un dialogo').toBe('dialog');
    expect(aria.etichetta, '24c — con un nome').toBe('tourtit');
  });

  test('le frecce sfogliano le tappe', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => apriTour(1));
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    expect((await page.evaluate(STATO)).tourPasso, '20 — freccia destra: avanti').toBe(2);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    expect((await page.evaluate(STATO)).tourPasso, '21 — freccia sinistra: indietro').toBe(1);
  });

  test('si rilancia dalle impostazioni', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => { if (!P.fold) P.fold = {}; P.fold.settings = false; savePrefs(); render(); });
    await page.waitForTimeout(300);
    const c = await page.locator('[data-act="tour-apri"]').count();
    expect(c, '22 — il comando per rivedere il tour esiste nella pagina').toBeGreaterThan(0);
    expect(await premi(page, '[data-act="tour-apri"]'), '23 — e funziona').toBe(true);
    expect((await page.evaluate(STATO)).tourCard, '24 — il tour si riapre').toBe(true);
  });
});

test.describe('primo accesso · il tour sul telefono', () => {
  test.use({ viewport: TELEFONO });

  test('il riquadro sta in basso e non produce scorrimento', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => apriTour(2));
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const c = document.querySelector('.tourcard');
      const r = c.getBoundingClientRect();
      /* con `top` e `bottom` imposti insieme un elemento si stira fra i
         due: qui `top` non deve essere scritto in linea */
      return { topInLinea: (c.getAttribute('style') || '').indexOf('top') >= 0,
               dentro: r.right <= innerWidth + 1 && r.left >= -1,
               alto: Math.round(r.height),
               scorrimento: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(m.topInLinea, '25 — su schermo stretto la geometria la decide il CSS').toBe(false);
    expect(m.dentro, '26 — il riquadro sta dentro la finestra').toBe(true);
    expect(m.alto, '27 — e ha un\'altezza propria, non stirata').toBeLessThan(500);
    expect(m.scorrimento, '28 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   2. LE SPIEGAZIONI DI SEZIONE
   ───────────────────────────────────────────────────────────────────────── */

test.describe('primo accesso · le spiegazioni', () => {
  test.use({ viewport: DESKTOP });

  test('una per volta, e si spengono per sempre in un gesto', async ({ page }) => {
    await giaDentro(page);
    let s = await page.evaluate(STATO);
    expect(s.spiegazioni, '29 — UNA spiegazione a schermo, non nove').toBe(1);
    const prima = s.spiegazioneTitolo;

    expect(await premi(page, '[data-act="spieg-ok"]'), 'il comando «Ho capito»').toBe(true);
    s = await page.evaluate(STATO);
    expect(s.spiegazioni, '30 — dopo «Ho capito» compare la successiva').toBe(1);
    expect(s.spiegazioneTitolo, '31 — ed è un\'altra sezione').not.toBe(prima);
    expect(s.prefsVisti.some(k => k.indexOf('spieg:') === 0), '32 — la prima è segnata come vista').toBe(true);

    expect(await premi(page, '[data-act="spieg-mai"]'), 'il comando per spegnerle').toBe(true);
    s = await page.evaluate(STATO);
    expect(s.spiegazioni, '33 — spente: nessun fumetto').toBe(0);
    expect(s.prefsSpiegazioni, '34 — e la scelta è registrata sul dispositivo').toBe(false);
    expect(s.impostazioniDati, '35 — non nei dati').not.toContain('spiegazioni');
    /* l'interruttore vale per tutta la famiglia, non solo per i fumetti:
       tre avvisi con tre regole diverse sarebbero tre cose da capire */
    expect(s.benvenuto, '35d — spegne anche la riga della promessa').toBe(0);
    expect(s.iniziali, '35e — e l\'avviso sulle voci di partenza').toBe(0);
  });

  test('il fuoco segue il fumetto, e non viene rubato a chi sta altrove', async ({ page }) => {
    await giaDentro(page);
    /* Il fumetto non sta nell'HTML disegnato — viene montato dopo — quindi
       il ripristino del fuoco di render() non lo trova: premendo «Ho capito»
       il fuoco finiva su BODY, e chi usa la tastiera tornava in cima
       all'ordine di tabulazione proprio mentre compariva il fumetto nuovo. */
    await page.locator('[data-act="spieg-ok"]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const dopo = await page.evaluate(() => {
      const a = document.activeElement;
      return { act: (a.getAttribute && a.getAttribute('data-act')) || a.tagName,
               dentro: !!(a.closest && a.closest('.spiegazione')) };
    });
    expect(dopo.dentro, '35a — il fuoco resta nel fumetto successivo').toBe(true);
    expect(dopo.act, '35b — e sul comando che serve').toBe('spieg-ok');

    /* e il contrario: chi ha il fuoco altrove non se lo vede portare via */
    await page.evaluate(() => { document.querySelector('#app button').focus(); });
    const prima = await page.evaluate(() => document.activeElement.getAttribute('data-act'));
    await page.evaluate(() => render());
    await page.waitForTimeout(350);
    const poi = await page.evaluate(() => document.activeElement.getAttribute('data-act'));
    expect(poi, '35c — il fuoco non viene rubato').toBe(prima);
  });

  test('la promessa del prodotto è in cima, una volta sola', async ({ page }) => {
    await giaDentro(page);
    let s = await page.evaluate(STATO);
    /* è il difetto da cui è partito tutto: chi salta l'ingresso non trovava
       da nessuna parte che cosa fa il pannello */
    expect(s.benvenuto, '36 — la promessa compare a chi arriva').toBe(1);
    const testo = await page.locator('.benvenuto').first().innerText();
    expect(testo.length, '37 — e dice qualcosa').toBeGreaterThan(40);
    expect(await premi(page, '[data-act="benv-chiudi"]'), 'il comando di chiusura').toBe(true);
    s = await page.evaluate(STATO);
    expect(s.benvenuto, '38 — chiusa, non torna').toBe(0);
    expect(s.prefsVisti, '39 — segnata fra le viste').toContain('promessa:vista');
  });

  test('le voci di partenza vengono dichiarate, e contate bene', async ({ page }) => {
    await giaDentro(page);
    const s = await page.evaluate(STATO);
    expect(s.iniziali, '40 — l\'avviso sulle voci iniziali c\'è').toBe(1);
    const t = await page.locator('.hint.avviso.iniziali').first().innerText();
    /* il numero deve essere quello delle voci di QUESTA sezione: dentro
       «Da fare oggi», che ne mostra nove, un avviso che dice diciassette
       è esso stesso una cosa da spiegare */
    const quante = await page.evaluate(() => {
      const mappa = vociIniziali();
      return dueOn(S.now).filter(i => i && mappa[i.id]).length;
    });
    expect(t, '41 — l\'avviso riporta il conto della sezione').toContain(String(quante));
    expect(await premi(page, '[data-act="iniziali-ok"]'), 'il comando «Ho capito»').toBe(true);
    expect((await page.evaluate(STATO)).iniziali, '42 — e poi non torna').toBe(0);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   3. LA MODALITÀ SCOPERTA
   ───────────────────────────────────────────────────────────────────────── */

test.describe('primo accesso · modalità scoperta', () => {
  test.use({ viewport: DESKTOP });

  test('spenta non aggiunge NIENTE, accesa segnala e propone', async ({ page }) => {
    await giaDentro(page);
    let s = await page.evaluate(STATO);
    expect(s.badge, '43 — spenta: nessun segno «Nuovo»').toBe(0);
    expect(s.schedaScoperta, '44 — spenta: nessuna scheda').toBe(0);

    await page.evaluate(() => { accendiScoperta(); render(); });
    await page.waitForTimeout(400);
    s = await page.evaluate(STATO);
    expect(s.badge, '45 — accesa: almeno un segno').toBeGreaterThan(0);
    expect(s.schedaScoperta, '46 — accesa: la scheda «Da provare»').toBe(1);
    expect(s.prefsScoperta, '47 — l\'interruttore è locale').toBe(true);

    /* tre per volta, non nove: un elenco completo sarebbe un menù */
    const righe = await page.locator('[data-sez="scoperta"] ul.scoperte li').count();
    expect(righe, '48 — al massimo tre proposte per volta').toBeLessThanOrEqual(3);

    expect(await premi(page, '[data-act="scoperta-spegni"]'), 'il comando per spegnerla').toBe(true);
    s = await page.evaluate(STATO);
    expect(s.badge, '49 — rispenta: zero segni').toBe(0);
    expect(s.schedaScoperta, '50 — rispenta: nessuna scheda').toBe(0);
  });

  test('«non ancora usata» si deduce dai dati, e cambia con i dati', async ({ page }) => {
    await giaDentro(page);
    const prima = await page.evaluate(() => {
      accendiScoperta();
      return funzioniDaScoprire().map(f => f.id);
    });
    expect(prima, '51 — con dati appena nati c\'è qualcosa da scoprire').toContain('note');
    /* aggiungo una nota: la funzione «Posta in arrivo» risulta usata, senza
       che nessun contatore l\'abbia registrata */
    await page.evaluate(() => {
      S.data.capture.push({ id: 'prova-1', area: 'vita', text: 'una nota', done: false, at: Date.now() });
      commit();
    });
    await page.waitForTimeout(300);
    const dopo = await page.evaluate(() => funzioniDaScoprire().map(f => f.id));
    expect(dopo, '52 — usata la funzione, sparisce dall\'elenco').not.toContain('note');
  });

  test('non propone funzioni che stanno in una parte spenta', async ({ page }) => {
    await giaDentro(page);
    /* Il filtro era scritto a mano su due id — routine e note — e lasciava
       fuori etichette, modelli, «in attesa» e i rituali, che si spengono
       allo stesso modo: con le etichette spente il pannello proponeva di
       usare le etichette. Ora la regola legge `modulo`. */
    const m = await page.evaluate(() => {
      accendiScoperta();
      attivaModulo('note', true);
      const acceso = funzioniDaScoprire().map(f => f.id);
      attivaModulo('note', false);
      const spento = funzioniDaScoprire().map(f => f.id);
      attivaModulo('note', true);
      return { acceso, spento };
    });
    expect(m.acceso, '52a — a parte accesa la funzione è proponibile').toContain('note');
    expect(m.spento, '52b — a parte spenta non viene proposta').not.toContain('note');
    /* e nessuna voce proposta appartiene a una parte spenta */
    const coerenti = await page.evaluate(() =>
      funzioniDaScoprire().every(f => !f.modulo || moduloAttivo(f.modulo)));
    expect(coerenti, '52c — nessuna proposta dentro una parte spenta').toBe(true);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   4. LA GUIDA: DOMANDE RAPIDE E SALTI
   ───────────────────────────────────────────────────────────────────────── */

test.describe('primo accesso · la guida', () => {
  test.use({ viewport: DESKTOP });

  test('le domande rapide ci sono, si cercano, e portano dove dicono', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => { S.guidaAperta = ''; render(); });
    await page.waitForTimeout(300);
    let s = await page.evaluate(STATO);
    expect(s.faq, '53 — le domande rapide sono in cima alla guida').toBeGreaterThan(5);

    /* la ricerca della guida deve filtrare anche le domande: prima cercava
       solo fra le sezioni */
    await page.evaluate(() => { S.guidaQuery = 'agenda'; render(); });
    await page.waitForTimeout(300);
    const filtrate = await page.locator('ul.faq li').count();
    expect(filtrate, '54 — la ricerca filtra le domande').toBeGreaterThan(0);
    expect(filtrate, '55 — e ne toglie qualcuna').toBeLessThan(s.faq);

    /* il salto: chiude la guida ED esegue l'azione */
    await page.evaluate(() => { S.guidaQuery = ''; render(); });
    await page.waitForTimeout(250);
    const vai = page.locator('ul.faq button[data-esce="1"]').first();
    expect(await vai.count(), '56 — almeno una domanda porta da qualche parte').toBeGreaterThan(0);
    await vai.click();
    await page.waitForTimeout(400);
    s = await page.evaluate(STATO);
    expect(s.guidaAperta, '57 — il salto chiude la guida').toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   5. LA CHECKLIST NON SI PRENDE MERITI
   ───────────────────────────────────────────────────────────────────────── */

test.describe('primo accesso · attivazione', () => {
  test.use({ viewport: DESKTOP });

  test('a utente nuovo l\'avanzamento è zero', async ({ page }) => {
    await giaDentro(page);
    const s = await page.evaluate(STATO);
    /* Diceva «2 di 6»: le voci iniziali di seed() hanno già un orario, e le
       due voci «aggiungi qualcosa» e «dai un orario» risultavano fatte per
       merito del pannello. Una barra che si spunta da sola non misura più
       niente. */
    expect(s.attivazione.fatti, '58 — nessun traguardo regalato').toBe(0);
    expect(s.attivazione.totale, '59 — i traguardi sono sette').toBe(7);
  });

  test('si spunta quando l\'utente fa la cosa, non quando la fa il pannello', async ({ page }) => {
    await giaDentro(page);
    await page.evaluate(() => {
      S.data.items.push({ id: 'mia-1', label: 'Una cosa mia', area: 'lavoro', freq: 'once', date: dk(), start: 11, dur: 1 });
      normalizeData();
      commit();
    });
    await page.waitForTimeout(300);
    const a = await page.evaluate(() => {
      const s = statoAttivazione();
      return s.voci.filter(v => v.fatto).map(v => v.id);
    });
    expect(a, '60 — una voce aggiunta da me spunta «task»').toContain('task');
    expect(a, '61 — e con un orario mio spunta «orario»').toContain('orario');
  });
});
