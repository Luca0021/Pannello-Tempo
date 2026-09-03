/* tests/e2e/piattaforma.spec.js — CSP, PWA, offline, responsive.
 *
 * Queste prove hanno senso SOLO in un browser vero su HTTP. Da `file://`
 * la Content Security Policy non si applica e i service worker non si
 * registrano: collaudare così è come provare i freni con l'auto spenta, ed
 * è l'errore che ha lasciato passare una CSP che rompeva l'agenda.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node.
 * Comando in RUN-CI.md.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

async function apri(page) {
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof render === 'function');
  await page.evaluate(() => {
    localStorage.clear();
    setImp('onboardingFatto', true);
    S.onboarding = null;
    if (!ciSonoDemo()) caricaDemo();
    normalizeData(); commit();
  });
  await page.waitForTimeout(250);
}

/* ─── Content Security Policy ─────────────────────────────────────────── */

test.describe('SEC-003 · Content Security Policy', () => {
  test('la CSP è presente e script-src resta severo', async ({ page }) => {
    await apri(page);
    const csp = await page.evaluate(() =>
      document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
    expect(csp).toContain("script-src 'self'");
    expect(csp, "script-src non deve ammettere 'unsafe-inline'")
      .not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp, "script-src non deve ammettere 'unsafe-eval'")
      .not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    /* securetoken è stato tolto quando abbiamo smesso di rinnovare le
       sessioni: un permesso di rete che nessuna riga usa va togliere */
    expect(csp, 'permesso di rete non usato').not.toContain('securetoken');
  });

  test('con la CSP attiva l\'agenda si disegna davvero', async ({ page }) => {
    /* Il difetto storico: `style-src 'self'` vietava anche l'attributo
       `style`, e l'agenda posiziona ogni blocco con `top` e `height`
       calcolati. Il contenitore restava alto 0 pixel. */
    await apri(page);
    await page.evaluate(() => { S.view = 'giorno'; render(); });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const area = document.querySelector('.agarea');
      const blocchi = [...document.querySelectorAll('.agblk')];
      return {
        areaPresente: !!area,
        altezzaArea: area ? Math.round(area.getBoundingClientRect().height) : 0,
        blocchi: blocchi.length,
        conPosizione: blocchi.filter(b => {
          const cs = getComputedStyle(b);
          return parseFloat(cs.height) > 1 && cs.position === 'absolute';
        }).length,
        topDistinti: new Set(blocchi.map(b => Math.round(b.getBoundingClientRect().top))).size
      };
    });
    expect(m.areaPresente).toBe(true);
    expect(m.altezzaArea, 'il contenitore dell\'agenda non deve essere alto 0').toBeGreaterThan(100);
    if (m.blocchi > 1) {
      expect(m.conPosizione, 'i blocchi devono avere altezza e posizione').toBe(m.blocchi);
      expect(m.topDistinti, 'i blocchi non devono essere tutti a top:0').toBeGreaterThan(1);
    }
  });

  test('nessuna violazione della CSP durante l\'uso normale', async ({ page }) => {
    const violazioni = [];
    page.on('console', m => {
      const t = m.text();
      if (/Content Security Policy/i.test(t) && !/frame-ancestors/i.test(t))
        violazioni.push(t);
    });
    await apri(page);
    /* `frame-ancestors` è escluso: è noto e documentato che in un <meta>
       venga ignorato, e il browser lo segnala a ogni caricamento. Vedi
       SECURITY-REPORT.md SEC-003. */
    await page.evaluate(() => { S.view = 'giorno'; render(); });
    await page.waitForTimeout(400);
    expect(violazioni).toEqual([]);
  });
});

/* ─── PWA ──────────────────────────────────────────────────────────────── */

test.describe('MOB-001 · PWA', () => {
  test('il manifest è valido e completo', async ({ page }) => {
    const r = await page.request.get(BASE + '/manifest.webmanifest');
    expect(r.status()).toBe(200);
    const m = await r.json();
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toMatch(/standalone|fullscreen|minimal-ui/);
    expect(m.icons.length, 'servono almeno due icone').toBeGreaterThanOrEqual(2);
    /* un'icona `maskable` serve ad Android per non ritagliare il logo */
    expect(m.icons.some(i => (i.purpose || '').includes('maskable')),
      'manca un\'icona maskable').toBe(true);
    expect(m.icons.some(i => i.sizes === '512x512'), 'manca l\'icona 512').toBe(true);
  });

  test('il service worker si registra e prende il controllo', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    const stato = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      return { scope: reg.scope, attivo: !!reg.active };
    });
    expect(stato.attivo).toBe(true);
    expect(stato.scope).toContain('127.0.0.1');
  });

  test('lo scheletro in cache contiene tutti i moduli', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const nomi = await caches.keys();
      const c = await caches.open(nomi[0]);
      const chiavi = (await c.keys()).map(x => new URL(x.url).pathname);
      const ordine = await (await fetch('/js/ORDINE.txt')).text();
      const moduli = ordine.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      return { cache: nomi[0], mancanti: moduli.filter(m => !chiavi.some(k => k.endsWith(m))) };
    });
    expect(r.mancanti, 'moduli non messi in cache: si romperebbero offline').toEqual([]);
  });

  test('offline: il pannello si apre e funziona', async ({ page, context }) => {
    await apri(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForTimeout(1500);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => typeof render === 'function', { timeout: 15000 });
    const m = await page.evaluate(() => ({
      disegnato: document.getElementById('app').innerHTML.length > 1000,
      stato: (typeof statoSync === 'function') ? statoSync().id : '?'
    }));
    expect(m.disegnato, 'il pannello deve disegnarsi anche senza rete').toBe(true);
    await context.setOffline(false);
  });

  test('offline: le modifiche restano e non si perdono', async ({ page, context }) => {
    await apri(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    const r = await page.evaluate(() => {
      const prima = (S.data.items || []).length;
      S.data.items.push({ id: 'offline-1', label: 'scritta senza rete', area: 'lavoro', freq: 'once', date: dk() });
      normalizeData(); commit();
      const grezzo = JSON.parse(localStorage.getItem(KEY));
      return { prima, dopo: (grezzo.items || []).length,
               presente: (grezzo.items || []).some(i => i.id === 'offline-1') };
    });
    expect(r.presente, 'una modifica fatta offline deve restare su disco').toBe(true);
    expect(r.dopo).toBe(r.prima + 1);
    await context.setOffline(false);
  });
});

/* ─── Responsive ───────────────────────────────────────────────────────── */

test.describe('MOB-002 · responsive', () => {
  const MISURE = [
    { nome: 'telefono piccolo', w: 320, h: 568 },
    { nome: 'telefono',         w: 375, h: 812 },
    { nome: 'tablet',           w: 768, h: 1024 },
    { nome: 'desktop',          w: 1280, h: 900 },
    { nome: 'zoom 200%',        w: 640, h: 450 }
  ];

  for (const m of MISURE) {
    test(`${m.nome} (${m.w}px): nessuno scorrimento orizzontale`, async ({ page }) => {
      await page.setViewportSize({ width: m.w, height: m.h });
      await apri(page);
      const s = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      /* un pixel di tolleranza: gli arrotondamenti del layout esistono */
      expect(s.scrollWidth, `eccede di ${s.scrollWidth - s.clientWidth}px`)
        .toBeLessThanOrEqual(s.clientWidth + 1);
    });

    test(`${m.nome} (${m.w}px): i comandi restano toccabili`, async ({ page }) => {
      await page.setViewportSize({ width: m.w, height: m.h });
      await apri(page);
      const piccoli = await page.evaluate(() =>
        [...document.getElementById('app')
          .querySelectorAll('button,a[href],input,select,[role="button"],[role="checkbox"]')]
          .filter(e => {
            const cs = getComputedStyle(e);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.width < 24 && r.height < 24;
          })
          .map(e => ({ t: (e.textContent || '').trim().slice(0, 20) || e.getAttribute('aria-label') || e.tagName,
                       m: Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) })));
      expect(piccoli, 'comandi sotto 24x24').toEqual([]);
    });
  }

  test('sul telefono la barra in basso non copre il contenuto finale', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await apri(page);
    const m = await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 300));
      const fissi = [...document.querySelectorAll('*')]
        .filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height > 20);
      const barra = fissi.length ? fissi[0].getBoundingClientRect().top : Infinity;
      const conTesto = [...document.getElementById('app').querySelectorAll('*')]
        .filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
                     && e.getBoundingClientRect().height > 0);
      const ultimo = conTesto[conTesto.length - 1];
      return { barra, ultimoBottom: ultimo ? ultimo.getBoundingClientRect().bottom : 0 };
    });
    expect(m.ultimoBottom, 'l\'ultimo contenuto finisce sotto la barra fissa')
      .toBeLessThan(m.barra);
  });
});
