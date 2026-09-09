/* tests/ui/impaginazione.spec.js — le regole di impaginazione, misurate.
 *
 * Nasce da un censimento eseguito in un browser vero su 26 condizioni —
 * sei larghezze, due temi, cinque sezioni — che ha trovato sette difetti che
 * nessuna lettura del codice mostrava. Cinque erano veri, due erano falsi
 * allarmi del mio strumento di misura, e vale la pena che le prove
 * ricordino anche quelli: sono i due modi tipici di sbagliare una misura di
 * impaginazione.
 *
 *   FALSO ALLARME 1 — «il numero dentro l'anello è alto 11px».
 *   `font-size` dentro un SVG è in unità del viewBox: il riquadro è 62px per
 *   un viewBox di 44, quindi la scala è 1,41 e quel numero sullo schermo ne
 *   misura 15,5. Il testo SVG va escluso da qualunque soglia in pixel.
 *
 *   FALSO ALLARME 2 — «la barra degli strumenti è tagliata: a 320px si vede
 *   un collegamento su otto».
 *   È una striscia che scorre di proposito, e la sfumatura che lo segnala sta
 *   in css/base.css con il commento che la spiega. Il mio rilevatore
 *   dell'attributo `mask` leggeva la proprietà sbagliata. Un difetto va
 *   confrontato con le intenzioni scritte prima di chiamarlo difetto.
 *
 * Le soglie qui dentro non sono gusto:
 *   - 24x24 CSS px è il bersaglio minimo di WCAG 2.5.8 (AA);
 *   - 12px è la soglia che questo pannello si dà per il testo che porta
 *     un'informazione, con due eccezioni dichiarate ed elencate;
 *   - «una colonna» significa che i titoli di sezione partono tutti dallo
 *     stesso pixel: due di scarto non si leggono come una scelta.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

/* Le due eccezioni alla soglia dei 12px, dichiarate qui e in
   css/components.css: etichette in maiuscoletto spaziato che NOMINANO un
   posto invece di riportare un valore. Se qualcuno ne aggiunge una terza,
   questa prova lo fa notare — che è il punto. */
const SOTTO_12_AMMESSI = ['eyebrow', 'proptit', 'caret'];

const VIEWPORT = {
  telefono_piccolo: { width: 320, height: 568 },
  telefono: { width: 375, height: 812 },
  desktop: { width: 1280, height: 800 },
  zoom200: { width: 640, height: 450 }
};

/* Stato deterministico: i dati iniziali del pannello, onboarding già fatto,
   tema esplicito. Nessun «oggi» lasciato al caso nelle misure che dipendono
   dall'ora — l'agenda ne dipende, e un blocco «adesso» sposta la griglia. */
async function apri(page, tema) {
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate((t) => {
    localStorage.clear();
    setImp('onboardingFatto', true);
    setImp('modo', 'avanzata');
    S.onboarding = null;
    P.theme = t;
    savePrefs();
    S.now = new Date(2026, 8, 7, 15, 3, 0);
    commit();
  }, tema);
  await page.waitForTimeout(200);
}

/* Porta alla sezione premendo il comando VISIBILE: la navigazione primaria è
   disegnata due volte, in alto e in basso, e a ogni larghezza una delle due
   è nascosta (NAV-001). Prendere «la prima» significa premere quella
   invisibile. */
async function vaiA(page, azione) {
  const t = page.locator('[data-act="' + azione + '"]');
  const n = await t.count();
  for (let i = 0; i < n; i++) {
    if (await t.nth(i).isVisible()) { await t.nth(i).click(); await page.waitForTimeout(250); return true; }
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   Le misure, eseguite dentro la pagina.
   ───────────────────────────────────────────────────────────────────────── */
const MISURA = function (ammessi) {
  function vis(el) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    if (el.closest('.sr')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }
  function sel(el) {
    let s = el.tagName.toLowerCase();
    const c = (el.getAttribute('class') || '').trim();
    if (c) s += '.' + c.split(/\s+/).slice(0, 2).join('.');
    const a = el.getAttribute('data-act');
    if (a) s += '[' + a + ']';
    return s;
  }
  function testoProprio(el) {
    return [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
  }
  const app = document.getElementById('app');
  const de = document.documentElement;
  const out = {};

  /* 1 — il documento non scorre in orizzontale */
  out.scorrimento = Math.max(0, de.scrollWidth - de.clientWidth);

  /* 2 e 3 — i blocchi dell'agenda: alti almeno 24px, testo non tagliato,
     e la maniglia di ridimensionamento non li copre */
  out.blocchi = [...app.querySelectorAll('.agblk')].filter(vis).map(el => {
    const r = el.getBoundingClientRect();
    const g = el.querySelector('.grip');
    return {
      h: Math.round(r.height),
      tagliato: el.scrollHeight - el.clientHeight,
      grip: g ? Math.round(g.getBoundingClientRect().height) : 0,
      testo: (el.textContent || '').trim().slice(0, 30)
    };
  });

  /* 4 — una sola colonna per i titoli di sezione.
     Confronto solo i titoli dentro un contenitore CON riempimento: le schede
     terziarie non ne hanno e partono dal bordo, che è una scelta di
     gerarchia, non uno scarto. */
  out.colonne = {};
  for (const el of app.querySelectorAll('.card > h2, .alert > h2')) {
    if (!vis(el)) continue;
    const p = el.parentElement;
    if (parseFloat(getComputedStyle(p).paddingLeft) < 1) continue;
    const x = Math.round(el.getBoundingClientRect().left);
    out.colonne[x] = (out.colonne[x] || 0) + 1;
  }

  /* 5 — i comandi autonomi arrivano a 24px di altezza.
     Restano fuori i bersagli che sono TESTO IN LINEA dentro una riga — il
     titolo di un'attività, il nome nell'elenco dell'agenda — per i quali
     WCAG 2.5.8 prevede l'eccezione «inline», e che non si possono ingrandire
     senza rifare la riga. */
  const AUTONOMI = 'button.link,button.foldbtn,button.oradesso,.navprim button,button.tiny';
  out.comandiBassi = [...app.querySelectorAll(AUTONOMI)].filter(vis)
    .map(el => ({ sel: sel(el), h: Math.round(el.getBoundingClientRect().height),
                  nome: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28) }))
    .filter(x => x.h < 24);

  /* 6 — nessun testo HTML sotto 12px, salvo le eccezioni dichiarate.
     Il testo dentro un SVG è escluso: la sua dimensione è in unità del
     viewBox e va moltiplicata per la scala del riquadro. */
  out.minuscoli = [];
  for (const el of app.querySelectorAll('*')) {
    if (el.ownerSVGElement || el.tagName === 'svg') continue;
    if (!vis(el)) continue;
    const t = testoProprio(el);
    if (!t) continue;
    const cls = (el.getAttribute('class') || '');
    if (ammessi.some(a => cls.split(/\s+/).includes(a))) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 12) out.minuscoli.push({ sel: sel(el), px: Math.round(px * 10) / 10, testo: t.slice(0, 30) });
  }

  /* 7 — il livello dei titoli: `aria-level` ha la precedenza sul tag */
  out.titoli = [...app.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter(vis)
    .map(el => Number(el.getAttribute('aria-level')) || Number(el.tagName[1]) || 2);

  return out;
};

/* ─────────────────────────────────────────────────────────────────────────
   Le prove
   ───────────────────────────────────────────────────────────────────────── */

for (const [nomeVp, vp] of Object.entries(VIEWPORT)) {
  for (const tema of ['chiaro', 'scuro']) {
    test.describe(`impaginazione · ${nomeVp} · ${tema}`, () => {
      test.use({ viewport: vp, colorScheme: tema === 'scuro' ? 'dark' : 'light' });

      test('la home rispetta le regole di impaginazione', async ({ page }) => {
        await apri(page, tema);
        const m = await page.evaluate(MISURA, SOTTO_12_AMMESSI);

        expect(m.scorrimento, '01 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);

        /* 02 — la colonna dei titoli. Prima erano tre valori diversi a
           parità di riempimento: 138, 140 e 141px, perché l'accento sul
           bordo sinistro sta fuori dal riempimento e spostava il contenuto
           della scheda di due o tre pixel. */
        expect(Object.keys(m.colonne).length,
          '02 — i titoli delle schede stanno su UNA colonna, non su tre: ' +
          JSON.stringify(m.colonne)).toBeLessThanOrEqual(1);

        expect(m.comandiBassi,
          '03 — i comandi autonomi arrivano a 24px di altezza').toEqual([]);

        expect(m.minuscoli,
          '04 — nessun testo informativo sotto 12px (le eccezioni sono ' +
          SOTTO_12_AMMESSI.join(', ') + ')').toEqual([]);

        expect(m.titoli.length, '05 — la schermata ha dei titoli').toBeGreaterThan(0);
        expect(m.titoli.filter(l => l === 1).length,
          '06 — esattamente un titolo di primo livello').toBe(1);
        let salti = 0;
        for (let i = 1; i < m.titoli.length; i++) if (m.titoli[i] - m.titoli[i - 1] > 1) salti++;
        expect(salti, '07 — nessun livello di titolo saltato').toBe(0);
      });
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   LE INTESTAZIONI NON DIVENTANO UNA COLONNA DI LETTERE
   ─────────────────────────────────────────────────────────────────────────

   Questa prova nasce da cinque scatti fatti su un TELEFONO FISICO, ed è la
   misura che mancava: le prove qui sopra controllano che non ci sia
   scorrimento orizzontale, che i bersagli arrivino a 24px, che il testo non
   scenda sotto i 12px e che i titoli stiano su una colonna. Nessuna di
   queste si accorge di un titolo scritto **una lettera per riga**:
   «Sincronizzazione» su sedici righe non sborda, non è troppo piccolo, non è
   fuori colonna. È soltanto illeggibile.

   Due ragioni per cui non era emerso prima:
     1. la misura non esisteva — nessuno contava le righe di un titolo;
     2. le intestazioni peggiori stanno DENTRO le impostazioni, che sono
        chiuse per difetto: il censimento non le ha mai disegnate.

   Perciò qui si aprono tutte le sezioni, e si conta. */
test.describe('impaginazione · le intestazioni su schermo stretto', () => {
  for (const largo of [320, 375, 393]) {
    test(`a ${largo}px nessun titolo di sezione si spezza in colonna`, async ({ page }) => {
      await page.setViewportSize({ width: largo, height: 812 });
      await apri(page, 'chiaro');
      await page.evaluate(() => {
        /* tutte le sezioni aperte: i valori assenti valgono «chiusa» per
           alcune chiavi, ed è il motivo per cui non si vedevano */
        P.fold = {};
        ['settings', 'setrit', 'setcal', 'setsync', 'setpausa', 'setind', 'setmod',
         'setics', 'setpiano', 'setinfo', 'setpriv', 'setdati', 'setcopie',
         'routine', 'guidasync'].forEach(k => { P.fold[k] = false; });
        setImp('modo', 'avanzata');
        savePrefs();
        commit();
      });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        function vis(el) {
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') return false;
          const r = el.getBoundingClientRect();
          return r.width >= 1 && r.height >= 1;
        }
        const app = document.getElementById('app');
        const out = [];
        for (const h2 of app.querySelectorAll('h2')) {
          if (!vis(h2)) continue;
          const bottone = h2.querySelector('button.foldbtn');
          const titolo = (bottone || h2).querySelector('span');
          if (!titolo) continue;
          const tr = titolo.getBoundingClientRect();
          const lh = parseFloat(getComputedStyle(titolo).lineHeight) ||
                     parseFloat(getComputedStyle(titolo).fontSize) * 1.3;
          out.push({
            testo: (titolo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28),
            righe: Math.max(1, Math.round(tr.height / lh)),
            titoloW: Math.round(tr.width),
            h2W: Math.round(h2.getBoundingClientRect().width),
            quotaBottone: bottone
              ? Math.round(bottone.getBoundingClientRect().width * 100 / h2.getBoundingClientRect().width)
              : null
          });
        }
        return out;
      });

      expect(m.length, 'ci devono essere intestazioni da misurare').toBeGreaterThan(10);

      /* 13 — il difetto visto sul telefono: «La tua giornata» su tredici
         righe, «Sincronizzazione» su sedici. Due righe sono un titolo
         lungo che va a capo; tre o più sono una colonna di lettere. */
      const acolonna = m.filter(x => x.righe >= 3);
      expect(acolonna, '13 — nessun titolo di sezione su tre o più righe').toEqual([]);

      /* 14 — la causa, non solo il sintomo: il titolo cliccabile delle
         schede richiudibili si spartiva la riga in parti uguali con la
         righetta decorativa, perché entrambi avevano `flex:1`, cioè base
         zero. Misurato prima della correzione: 42% al titolo. */
      const strette = m.filter(x => x.quotaBottone !== null && x.quotaBottone < 60);
      expect(strette, '14 — al titolo di una scheda richiudibile almeno il 60% della riga').toEqual([]);
    });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   IL BANNER DELL'AGGIORNAMENTO, SU TELEFONO
   ─────────────────────────────────────────────────────────────────────────

   Da uno scatto su telefono: il titolo «C'è una versione nuova del pannello»
   in una colonna di 65px, su cinque righe, con la descrizione che continuava
   in verticale e finiva dietro la barra di navigazione.

   Tre cause misurate, una delle quali di cascata: `bottom:12px` dichiarato
   in accessibility.css vinceva sulle due regole di mobile.css, che si
   contraddicevano fra loro e non hanno mai avuto effetto; un
   `margin-right:66px` riservava spazio a un pulsante nascosto su telefono;
   e la riga desktop non andava a capo, con le azioni a `flex:none` che si
   prendevano 130px su 283. */
test.describe('impaginazione · il banner dell\'aggiornamento', () => {
  for (const largo of [320, 375, 393]) {
    test(`a ${largo}px il banner è leggibile e non copre la barra`, async ({ page }) => {
      await page.setViewportSize({ width: largo, height: 812 });
      await apri(page, 'chiaro');
      await page.evaluate(() => {
        /* lo stato che il service worker imposta quando trova una versione
           nuova: è l'unico modo di far comparire questo banner */
        S.aggiornamento = true;
        render();
      });
      await page.waitForTimeout(300);
      /* il banner è `sticky`: si aggancia in basso quando la pagina è in
         fondo, ed è là che va misurato */
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(350);

      const m = await page.evaluate(() => {
        const nota = document.querySelector('#app .note-undo');
        if (!nota) return { assente: true };
        const nav = document.querySelector('#app .navprim.basso');
        const r = nota.getBoundingClientRect();
        const nr = nav ? nav.getBoundingClientRect() : null;
        const tx = nota.querySelector('.notetx');
        const tit = tx ? tx.querySelector('b') : null;
        const sub = tx ? tx.querySelector('.sub') : null;
        const bot = nota.querySelector('.noteact .tiny');
        const chiudi = nota.querySelector('.noteact .chiudi');
        const lh = tit ? (parseFloat(getComputedStyle(tit).lineHeight) ||
                          parseFloat(getComputedStyle(tit).fontSize) * 1.35) : 0;
        return {
          larghezza: Math.round(r.width),
          basso: Math.round(r.bottom),
          navTop: nr ? Math.round(nr.top) : null,
          titoloRighe: (tit && lh) ? Math.round(tit.getBoundingClientRect().height / lh) : null,
          titoloW: tit ? Math.round(tit.getBoundingClientRect().width) : null,
          colonnaTesto: tx ? Math.round(tx.getBoundingClientRect().width) : null,
          descrizioneSopraLaBarra: (sub && nr) ? sub.getBoundingClientRect().bottom <= nr.top + 1 : null,
          pulsante: bot ? { w: Math.round(bot.getBoundingClientRect().width),
                            h: Math.round(bot.getBoundingClientRect().height),
                            testo: (bot.textContent || '').trim() } : null,
          chiudi: chiudi ? { w: Math.round(chiudi.getBoundingClientRect().width),
                             h: Math.round(chiudi.getBoundingClientRect().height) } : null,
          scorrimento: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      expect(m.assente, 'il banner deve comparire').toBeUndefined();
      /* 15 — il titolo. Cinque righe in una colonna di 65px era il difetto;
         due righe su schermo da 320px sono un titolo lungo che va a capo. */
      expect(m.titoloRighe, '15 — il titolo del banner sta in due righe al massimo').toBeLessThanOrEqual(2);
      /* 16 — la colonna del testo prende la maggior parte del banner: era
         il 23%, perché le azioni non andavano a capo */
      expect(Math.round(m.colonnaTesto * 100 / m.larghezza),
        '16 — al testo del banner almeno il 60% della larghezza').toBeGreaterThanOrEqual(60);
      /* 17 — la barra fissa non deve coprirlo: `bottom` era 12px contro una
         barra alta 68 */
      expect(m.basso, '17 — il banner sta sopra la barra di navigazione').toBeLessThanOrEqual(m.navTop);
      expect(m.descrizioneSopraLaBarra, '18 — e la descrizione si legge per intero').toBe(true);
      /* 19 — i due comandi restano quelli, con i loro bersagli */
      expect(m.pulsante.testo.toLowerCase(), '19 — il pulsante per aggiornare c\'è').toContain('aggiorna');
      expect(m.pulsante.h, '20 — e il suo bersaglio non è stato ridotto').toBeGreaterThanOrEqual(30);
      expect(m.chiudi.h, '21 — la chiusura resta 28px o più').toBeGreaterThanOrEqual(28);
      expect(m.scorrimento, '22 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
    });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   DUE COSE CHE SI DICHIARANO, E CHE NESSUNA MISURA DI GEOMETRIA VEDE
   ───────────────────────────────────────────────────────────────────────── */
test.describe('impaginazione · dichiarazioni', () => {
  test.use({ viewport: VIEWPORT.telefono });

  test('il documento dichiara di sapere stare al buio', async ({ page }) => {
    await apri(page, 'auto');
    /* Senza `color-scheme` il tema scuro AUTOMATICO del browser Android
       inverte la pagina con un algoritmo e lascia stare le maschere: le
       icone della barra restano scure su fondo diventato scuro. È la causa
       dello scatto dal telefono, e non è riproducibile in emulazione —
       quello che si può verificare è che la dichiarazione ci sia, e che
       segua il tema scelto nel pannello. */
    const d = await page.evaluate(() => {
      const app = document.getElementById('app');
      const leggi = (t) => { P.theme = t; savePrefs(); render();
        return getComputedStyle(document.getElementById('app')).colorScheme; };
      return {
        radice: getComputedStyle(document.documentElement).colorScheme,
        auto: leggi('auto'), chiaro: leggi('chiaro'), scuro: leggi('scuro'),
        attributo: app.getAttribute('data-theme')
      };
    });
    expect(d.radice, '23 — la radice dichiara i due schemi').toContain('dark');
    expect(d.auto, '24 — con «Auto» il pannello segue il sistema').toContain('dark');
    expect(d.chiaro, '25 — con «Chiaro» i comandi nativi restano chiari').toBe('light');
    expect(d.scuro, '26 — con «Scuro» restano scuri').toBe('dark');
  });

  test('nessuna icona è un quadrato pieno', async ({ page }) => {
    await apri(page, 'chiaro');
    await page.evaluate(() => {
      P.fold = {};
      ['settings', 'setrit', 'setcal', 'setsync', 'setpausa', 'setind', 'setmod',
       'setics', 'setpiano', 'setinfo', 'setpriv'].forEach(k => { P.fold[k] = false; });
      setImp('modo', 'avanzata');
      savePrefs();
      commit();
    });
    await page.waitForTimeout(400);
    /* `data-ico="sereno"` era usato dal codice e non definito da nessun
       foglio: per un `h2::before` una `--ico` mancante non fa sparire
       l'icona, lascia il riempimento — un quadrato ottone di 20px, ben
       visibile negli scatti. */
    const quadrati = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('#app [data-ico]')) {
        const v = el.getAttribute('data-ico');
        if (!v) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const pre = getComputedStyle(el, '::before');
        if (pre.display === 'none' || pre.content === 'none') continue;
        const mascherata = /url\(/.test(pre.maskImage || pre.webkitMaskImage || '');
        const dipinta = pre.backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(pre.backgroundColor);
        if (!mascherata && dipinta)
          out.push({ ico: v, fondo: pre.backgroundColor, w: pre.width });
      }
      return out;
    });
    expect(quadrati, '27 — nessun data-ico dipinto senza maschera').toEqual([]);
  });
});

test.describe('impaginazione · agenda del giorno', () => {
  test.use({ viewport: VIEWPORT.desktop });

  test('un blocco da mezz\'ora è leggibile e afferrabile', async ({ page }) => {
    await apri(page, 'chiaro');
    const m = await page.evaluate(MISURA, SOTTO_12_AMMESSI);

    expect(m.blocchi.length, 'ci devono essere blocchi da misurare').toBeGreaterThan(0);

    /* 08 — l'altezza. Con la scala a 38px/ora la mezz'ora valeva 17px e il
       minimo scritto nel codice era 18: sotto il bersaglio di WCAG 2.5.8. */
    expect(m.blocchi.filter(b => b.h < 24),
      '08 — nessun blocco sotto 24px di altezza').toEqual([]);

    /* 09 — il testo. Il blocco ha `overflow:hidden`, quindi un contenuto più
       alto del riquadro non sborda: sparisce. Il nome dell'attività veniva
       tagliato a metà glifo, e la prova che se ne accorge è questa. */
    expect(m.blocchi.filter(b => b.tagliato > 1),
      '09 — nessun blocco taglia il proprio testo').toEqual([]);

    /* 10 — la maniglia. Era alta 13px fisse: in un blocco da 18 ne copriva
       il 72%, e toccare il blocco iniziava un ridimensionamento invece di
       aprire l'attività. */
    expect(m.blocchi.filter(b => b.grip > b.h * 0.45),
      '10 — la maniglia non copre più del 45% del blocco').toEqual([]);
  });
});

test.describe('impaginazione · Riepilogo', () => {
  test.use({ viewport: VIEWPORT.desktop });

  test('la vista Riepilogo ha un titolo di primo livello', async ({ page }) => {
    await apri(page, 'chiaro');
    const andata = await vaiA(page, 'digest');
    expect(andata, 'il comando Riepilogo deve esistere ed essere visibile').toBe(true);

    const m = await page.evaluate(MISURA, SOTTO_12_AMMESSI);
    /* La schermata sostituisce l'intero pannello, quindi la testata con l'h1
       della data non c'è: la struttura cominciava da un h2 e chi naviga per
       titoli non trovava il livello da cui partire. */
    expect(m.titoli.filter(l => l === 1).length,
      '11 — un titolo di primo livello anche qui').toBe(1);
    expect(m.scorrimento, '12 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
  });
});
