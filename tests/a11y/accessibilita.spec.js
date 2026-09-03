/* tests/a11y/accessibilita.spec.js — A11Y-001…006.
 *
 * axe-core sulle schermate principali, più le verifiche che axe non può
 * fare da sé: la navigazione con la sola tastiera, il fuoco visibile,
 * l'ordine delle intestazioni, e che nessuna informazione sia portata dal
 * solo colore.
 *
 * Su axe serve un chiarimento onesto: axe trova circa un terzo dei
 * problemi di accessibilità reali. «Zero violazioni axe» non significa
 * «accessibile», significa «nessuna delle cose che axe sa controllare».
 * Le prove manuali che restano sono elencate in ACCESSIBILITY-REPORT.md.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node.
 * Comando in RUN-CI.md.
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

async function apri(page, opzioni) {
  const o = Object.assign({ demo: true, avanzata: true }, opzioni || {});
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof render === 'function');
  await page.evaluate((o) => {
    localStorage.clear();
    setImp('onboardingFatto', true);
    setImp('modo', o.avanzata ? 'avanzata' : 'semplice');
    S.onboarding = null;
    if (o.demo && !ciSonoDemo()) caricaDemo();
    const gf = n => dayKey(new Date(S.now.getTime() - n * 86400000));
    if (o.demo) S.data.items.push(
      { id: 'ar-1', label: 'Presentare la relazione', area: 'lavoro', freq: 'once', date: gf(4) },
      { id: 'ar-2', label: 'Richiamare lo studio', area: 'vita', freq: 'once', date: gf(9) });
    normalizeData(); commit();
    /* apro ogni sezione: una scheda chiusa non viene disegnata, e ciò che
       non è disegnato non viene controllato */
    P.fold = {};
    document.querySelectorAll('[data-act="fold"]').forEach(b => {
      const v = b.getAttribute('data-v'); if (v) P.fold[v] = false; });
    savePrefs(); render();
  }, o);
  await page.waitForTimeout(350);
}

/* Le regole di axe che applichiamo: WCAG 2.0 e 2.1, livelli A e AA.
   Niente «best-practice»: contiene regole opinabili che produrrebbero
   rumore e farebbero disattivare il collaudo. */
const REGOLE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function analizza(page) {
  return new AxeBuilder({ page }).withTags(REGOLE).include('#app').analyze();
}

function riassumi(violazioni) {
  return violazioni.map(v => ({
    regola: v.id, impatto: v.impact, quante: v.nodes.length,
    descrizione: v.help,
    esempi: v.nodes.slice(0, 3).map(n => n.target.join(' '))
  }));
}

test.describe('A11Y · axe-core sulle schermate principali', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Oggi', async ({ page }) => {
    await apri(page);
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });

  test('Agenda', async ({ page }) => {
    await apri(page);
    await page.evaluate(() => { S.view = 'giorno'; render(); });
    await page.waitForTimeout(300);
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });

  test('Riepilogo', async ({ page }) => {
    await apri(page);
    await page.evaluate(() => { const b = document.querySelector('[data-act="digest"]'); if (b) b.click(); });
    await page.waitForTimeout(300);
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });

  test('Impostazioni', async ({ page }) => {
    await apri(page);
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });

  test('Onboarding', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await page.waitForFunction(() => typeof render === 'function');
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
    await page.waitForFunction(() => document.querySelector('#onbtit') !== null, { timeout: 10000 });
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });

  test('tema scuro', async ({ page }) => {
    await apri(page);
    await page.evaluate(() => { P.theme = 'scuro'; savePrefs(); });
    await page.reload();
    await page.waitForFunction(() => typeof render === 'function');
    await page.waitForTimeout(350);
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });

  test('telefono', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await apri(page);
    const r = await analizza(page);
    expect(riassumi(r.violations)).toEqual([]);
  });
});

test.describe('A11Y · quello che axe non controlla', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('A11Y-004 · si arriva ai comandi principali con la sola tastiera', async ({ page }) => {
    await apri(page);
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    const raggiunti = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        return { act: e.getAttribute('data-act'), tag: e.tagName,
                 nome: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30) };
      });
      if (d) raggiunti.push(d);
    }
    /* i comandi che devono essere raggiungibili senza mouse */
    for (const act of ['vaioggi', 'vaiagenda', 'menunuovo', 'digest'])
      expect(raggiunti.some(r => r.act === act), 'non raggiungibile con Tab: ' + act).toBe(true);
    /* e almeno una casella di completamento */
    expect(raggiunti.some(r => r.tag === 'INPUT' && r.act === 'toggle'),
      'nessuna casella di completamento raggiungibile').toBe(true);
  });

  test('A11Y-004 · il fuoco è sempre visibile', async ({ page }) => {
    await apri(page);
    const invisibili = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const cs = getComputedStyle(e);
        const haFuoco = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
                     || cs.boxShadow !== 'none'
                     || cs.borderColor !== getComputedStyle(e.parentElement || e).borderColor;
        return haFuoco ? null : { tag: e.tagName, cls: String(e.className || '').slice(0, 24) };
      });
      if (r) invisibili.push(r);
    }
    expect(invisibili, 'elementi che prendono il fuoco senza mostrarlo').toEqual([]);
  });

  test('A11Y-005 · la casella di completamento è nativa e ha un nome', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.box')];
      return {
        totali: c.length,
        nonNative: c.filter(e => e.tagName !== 'INPUT' || e.type !== 'checkbox').length,
        senzaNome: c.filter(e => !(e.getAttribute('aria-label') || '').trim()).length,
        senzaArea: c.filter(e => e.getAttribute('data-act') === 'toggle')
                    .filter(e => !/^(Lavoro|Vita|Area non indicata),/.test(e.getAttribute('aria-label') || '')).length
      };
    });
    expect(r.totali).toBeGreaterThan(0);
    expect(r.nonNative, 'caselle non native').toBe(0);
    expect(r.senzaNome, 'caselle senza nome accessibile').toBe(0);
    expect(r.senzaArea, 'nomi accessibili che non cominciano dall\'area').toBe(0);
  });

  test('A11Y-006 · nessuna informazione dal solo colore', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(() => {
      /* i tre indicatori che usano il colore: area, stato della
         sincronizzazione, livello di una scheda. Ognuno deve avere un
         testo accanto. */
      const chip = [...document.querySelectorAll('.areachip')];
      const stati = [...document.querySelectorAll('.statoarea')];
      const livelli = [...document.querySelectorAll('[data-livello]')];
      return {
        areaSenzaTesto: chip.filter(c => !/Lavoro|Vita|Area non indicata/.test(c.textContent)).length,
        statoSenzaTesto: stati.filter(s => s.textContent.trim().length < 3).length,
        livelloSenzaTesto: livelli.filter(l => l.textContent.trim().length < 3).length,
        puntiNonNascosti: [...document.querySelectorAll('.areapunto')]
          .filter(p => p.getAttribute('aria-hidden') !== 'true').length
      };
    });
    expect(r.areaSenzaTesto).toBe(0);
    expect(r.statoSenzaTesto).toBe(0);
    expect(r.livelloSenzaTesto).toBe(0);
    expect(r.puntiNonNascosti, 'i punti decorativi devono essere aria-hidden').toBe(0);
  });

  test('A11Y-001 · le intestazioni non saltano livelli', async ({ page }) => {
    await apri(page);
    const salti = await page.evaluate(() => {
      const h = [...document.getElementById('app').querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter(e => getComputedStyle(e).display !== 'none')
        .map(e => Number(e.tagName[1]));
      const out = [];
      for (let i = 1; i < h.length; i++)
        if (h[i] > h[i-1] + 1) out.push('da h' + h[i-1] + ' a h' + h[i]);
      return out;
    });
    expect(salti, 'livelli di intestazione saltati').toEqual([]);
  });

  test('A11Y-002 · gli annunci per i lettori di schermo esistono', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(() => {
      const vivo = document.getElementById('annunci');
      return { presente: !!vivo,
               polite: vivo && vivo.getAttribute('aria-live') === 'polite',
               atomic: vivo && vivo.getAttribute('aria-atomic') === 'true' };
    });
    expect(r.presente, 'manca la regione per gli annunci').toBe(true);
    expect(r.polite).toBe(true);
    expect(r.atomic).toBe(true);
  });

  test('la lingua del documento è dichiarata', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('it');
  });
});
