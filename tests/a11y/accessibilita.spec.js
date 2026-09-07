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
      const tutte = document.querySelectorAll('#annunci');
      const vivo = document.getElementById('annunci');
      return { presente: !!vivo,
               quante: tutte.length,
               dentroApp: !!(vivo && vivo.closest('#app')),
               polite: vivo && vivo.getAttribute('aria-live') === 'polite',
               atomic: vivo && vivo.getAttribute('aria-atomic') === 'true' };
    });
    expect(r.presente, 'manca la regione per gli annunci').toBe(true);
    expect(r.polite).toBe(true);
    expect(r.atomic).toBe(true);
    /* Ce n'era una seconda, dentro #app, creata dal diffing: un id
       duplicato, e `getElementById` restituiva sempre l'altra. Senza questa
       asserzione le tre righe sopra passavano comunque. */
    expect(r.quante, 'la regione di annuncio è duplicata').toBe(1);
    /* E deve stare FUORI da #app: una regione viva ricreata da innerHTML
       viene sostituita nello stesso momento in cui il testo cambia, e il
       lettore di schermo può non annunciare niente. */
    expect(r.dentroApp, 'la regione di annuncio viene ricreata a ogni ridisegno').toBe(false);
  });

  test('la lingua del documento è dichiarata', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('it');
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   Le misure che axe non fa, e che hanno trovato difetti veri.

   axe controlla il contrasto del TESTO e lo fa male sui gradienti: quando
   non riesce a determinare il fondo restituisce «incomplete», che non è una
   violazione e passa inosservato. Non controlla affatto il contrasto dei
   COMANDI (1.4.11), né la dimensione dei bersagli con l'eccezione di
   spaziatura (2.5.8). Le tre misure qui sotto lo fanno, e nella prima
   esecuzione a mano hanno trovato: 31 campi con bordo sotto 1,7:1, sette
   campi senza nome accessibile, sette pulsanti dei giorni larghi 9px e una
   regione di annuncio duplicata.

   `_collaudo.js` contiene le stesse misure in forma usabile dalla console,
   con i commenti sui falsi allarmi da cui sono nate. Qui sono ricopiate
   perché una prova non deve dipendere da un file che non è nella release.
   ───────────────────────────────────────────────────────────────────────── */

const MISURE = () => {
  function P(c){ const m=/rgba?\(([^)]+)\)/.exec(c); if(!m) return null;
    const p=m[1].split(',').map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:(p.length>3?p[3]:1)}; }
  function S(f,b){ const a=f.a; return {r:f.r*a+b.r*(1-a),g:f.g*a+b.g*(1-a),b:f.b*a+b.b*(1-a),a:1}; }
  function L(c){ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
  function R(a,b){ const x=L(a),y=L(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  const BIANCO={r:255,g:255,b:255,a:1};
  function livelli(img){ const out=[]; let prof=0,corr='';
    for(const ch of img){ if(ch==='(')prof++; else if(ch===')')prof--;
      if(ch===','&&prof===0){out.push(corr.trim());corr='';continue;} corr+=ch; }
    if(corr.trim())out.push(corr.trim()); return out; }
  function tappe(l){ const o=[]; const rx=/rgba?\([^)]+\)/g; let m;
    while((m=rx.exec(l))){ const p=P(m[0]); if(p)o.push(p); } return o; }
  /* i livelli si dipingono dal basso: l'ultimo della lista è il più in basso */
  function fondi(el){
    const cat=[]; let n=el;
    while(n&&n.nodeType===1){cat.push(n);n=n.parentElement;}
    let v=[BIANCO];
    for(let i=cat.length-1;i>=0;i--){
      const cs=getComputedStyle(cat[i]);
      const bg=P(cs.backgroundColor);
      if(bg&&bg.a>0) v = bg.a>=0.999 ? [S(bg,BIANCO)] : v.map(x=>S(bg,x));
      const img=cs.backgroundImage;
      if(img&&img!=='none') for(const l of livelli(img).reverse()){
        const t=tappe(l); if(!t.length) continue;
        const vis=t.filter(s=>s.a>0); if(!vis.length) continue;
        const opaco=t.every(s=>s.a>=0.999);
        const nuove=[]; const prima=v;
        if(opaco) for(const s of vis) nuove.push(S(s,BIANCO));
        else for(const x of prima){ nuove.push(x); for(const s of vis) nuove.push(S(s,x)); }
        v=nuove.slice(0,12);
      }
    }
    return v;
  }
  function visibile(el){
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)===0) return false;
    if(el.offsetParent===null&&cs.position!=='fixed') return false;
    const r=el.getBoundingClientRect(); if(r.width<1||r.height<1) return false;
    let n=el.parentElement;
    while(n&&n.nodeType===1){
      const c=getComputedStyle(n);
      if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0) return false;
      if(c.overflow==='hidden'||c.overflowY==='hidden'){ const q=n.getBoundingClientRect();
        if(q.height<2||q.width<2) return false; }
      n=n.parentElement;
    }
    return true;
  }
  window.__M = { P, S, R, fondi, visibile };
};

/* Le transizioni CSS vanno azzerate PRIMA di misurare: un browser che
   throttla le animazioni — succede a schede in secondo piano — lascia la
   transizione ferma sul valore di partenza, e `getComputedStyle` riporta il
   fondo vecchio col colore nuovo. Ho inseguito per mezz'ora un pulsante a
   1,00:1 che non era rotto.

   DIFETTO CORRETTO — qui c'era `page.addStyleTag()`, e la Content Security
   Policy del pannello lo BLOCCA:

     Applying inline style violates the following Content Security Policy
     directive 'style-src-elem 'self''

   Tre prove fallivano per questo, e non per il prodotto. Il fatto che sia
   stato bloccato è una buona notizia — dimostra che `style-src-elem` è
   davvero applicato — ma un collaudo non può aggirare la CSP né chiedere
   di allentarla per potersi eseguire.

   `insertRule` su un foglio già caricato è consentito: la CSP governa
   l'INSERIMENTO di elementi <style>, non la manipolazione dei fogli
   esistenti tramite CSSOM. È la stessa via usata da `_collaudo.js`. */
async function congela(page) {
  const fatto = await page.evaluate(() => {
    const regola = '.pt *, .pt *::before, .pt *::after' +
                   '{ transition: none !important; animation: none !important; }';
    for (const foglio of Array.from(document.styleSheets)) {
      try {
        foglio.insertRule(regola, foglio.cssRules.length);
        void document.body.offsetHeight;   /* forza il ricalcolo */
        return true;
      } catch (e) { /* foglio di altra origine o non modificabile: il prossimo */ }
    }
    return false;
  });
  /* Se nessun foglio è modificabile la misura resterebbe esposta alle
     transizioni congelate, e un fallimento inventato è peggio di nessuna
     misura: meglio saperlo subito. */
  expect(fatto, 'nessun foglio di stile modificabile: non posso azzerare le transizioni').toBe(true);
  await page.waitForTimeout(60);
}

test.describe('A11Y · contrasto misurato, non stimato', () => {
  test.beforeEach(async ({ page }) => { await apri(page); await congela(page); await page.addInitScript(MISURE); });

  test('1.4.3 · nessun testo sotto soglia, con i gradienti composti', async ({ page }) => {
    await page.evaluate(MISURE);
    const esito = await page.evaluate(() => {
      const bad = []; let n = 0;
      document.querySelectorAll('#app *').forEach(el => {
        let tx = '';
        el.childNodes.forEach(c => { if (c.nodeType === 3) tx += c.nodeValue; });
        tx = tx.replace(/\s+/g, ' ').trim();
        if (!tx || !__M.visibile(el)) return;
        const cs = getComputedStyle(el), fg = __M.P(cs.color);
        if (!fg) return;
        n++;
        const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
        const soglia = (px >= 24 || (px >= 18.66 && peso >= 700)) ? 3 : 4.5;
        let peggio = 99;
        __M.fondi(el).forEach(b => {
          const f = fg.a < 1 ? __M.S(fg, b) : fg;
          const r = __M.R(f, b);
          if (r < peggio) peggio = r;
        });
        if (peggio < soglia - 0.01)
          bad.push(tx.slice(0, 30) + ' ' + Math.round(peggio * 100) / 100 + ':1 (min ' + soglia + ')');
      });
      return { esaminati: n, falliti: bad };
    });
    expect(esito.esaminati, 'nessun testo esaminato: la misura non sta guardando niente').toBeGreaterThan(200);
    expect(esito.falliti, 'testi sotto la soglia di contrasto').toEqual([]);
  });

  test('1.4.11 · i comandi si distinguono dal fondo', async ({ page }) => {
    await page.evaluate(MISURE);
    const esito = await page.evaluate(() => {
      const SEL = '#app input, #app select, #app textarea, #app button.tiny, #app button.ghost, ' +
                  '#app .slot, #app .lk, #app .chiudi, #app .dayb, #app .areapunto, #app .scegli, #app .star';
      const bad = []; let n = 0, esenti = 0;
      document.querySelectorAll(SEL).forEach(el => {
        if (!__M.visibile(el) || el.type === 'hidden') return;
        const cs = getComputedStyle(el);
        /* i comandi disegnati dal browser sono esenti dalla 1.4.11 */
        if (el.tagName === 'INPUT' && cs.appearance !== 'none' && parseFloat(cs.borderTopWidth) === 0) { esenti++; return; }
        n++;
        const bordo = __M.P(cs.borderTopColor), largh = parseFloat(cs.borderTopWidth) || 0;
        const fill = __M.P(cs.backgroundColor);
        const bs = __M.fondi(el.parentElement || el);
        const migliore = c => {
          if (!c || c.a === 0) return 0;
          let b = 0;
          bs.forEach(x => { const f = c.a < 1 ? __M.S(c, x) : c; const r = __M.R(f, x); if (r > b) b = r; });
          return b;
        };
        /* il comando si vede se si vede il BORDO oppure il riempimento:
           il massimo dei due, non il minimo */
        const v = Math.max(largh > 0 ? migliore(bordo) : 0, migliore(fill));
        if (v < 3) bad.push((el.className || el.tagName) + ' ' + Math.round(v * 100) / 100 + ':1');
      });
      return { esaminati: n, esenti, falliti: bad };
    });
    expect(esito.esaminati, 'nessun comando esaminato').toBeGreaterThan(20);
    expect(esito.falliti, 'comandi che non si distinguono dal fondo (min 3:1)').toEqual([]);
  });

  test('2.5.8 · nessun bersaglio piccolo E affollato', async ({ page }) => {
    await page.evaluate(MISURE);
    const esito = await page.evaluate(() => {
      const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"]';
      const ber = [];
      document.querySelectorAll(SEL).forEach(e => {
        if (!__M.visibile(e)) return;
        /* ECCEZIONE «ESSENZIALE» della 2.5.8, e non è uno sconto: il
           criterio la prevede per i bersagli la cui presentazione è
           essenziale all'informazione che trasmettono.

           I blocchi dell'agenda (`.agblk`) sono alti quanto dura
           l'impegno: un quarto d'ora è 18px, un'ora è 72. Portarli tutti
           a 24px vorrebbe dire che un impegno di 15 minuti occupa lo
           stesso spazio di uno di mezz'ora, e l'agenda smette di dire
           quanto dura una cosa — che è l'unica ragione per cui esiste una
           vista ad agenda invece di un elenco.

           L'alternativa equivalente esiste e non è teorica: le stesse
           voci compaiono nelle liste, con comandi a misura piena. Le due
           asserzioni in fondo a questa prova verificano che i blocchi
           abbiano un nome e siano raggiungibili da tastiera, così
           l'eccezione resta un'eccezione e non una zona franca. */
        if (e.classList && e.classList.contains('agblk')) return;
        const r = e.getBoundingClientRect();
        ber.push({ e, r, p: (r.width < 24 || r.height < 24) });
      });
      const cerchio = r => { const x = r.left + r.width / 2, y = r.top + r.height / 2;
        return { left: x - 12, top: y - 12, right: x + 12, bottom: y + 12 }; };
      const incrocia = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      const bad = []; let perSpaziatura = 0;
      ber.forEach(t => {
        if (!t.p) return;
        const c = cerchio(t.r);
        const scontri = ber.filter(o => o.e !== t.e && (
          incrocia(c, { left: o.r.left, top: o.r.top, right: o.r.right, bottom: o.r.bottom }) ||
          (o.p && incrocia(c, cerchio(o.r)))));
        if (!scontri.length) perSpaziatura++;
        else bad.push((t.e.className || t.e.tagName) + ' ' +
                      Math.round(t.r.width) + 'x' + Math.round(t.r.height));
      });
      return { bersagli: ber.length, perSpaziatura, falliti: bad };
    });
    expect(esito.bersagli, 'nessun bersaglio esaminato').toBeGreaterThan(20);
    /* Un bersaglio sotto 24×24 va bene SE è isolato: l'eccezione di
       spaziatura fa parte del criterio, non è uno sconto. Ciò che non va
       bene è piccolo e affollato insieme — i sette pulsanti dei giorni
       larghi 9px e attaccati erano esattamente quello. */
    expect(esito.falliti, 'bersagli piccoli e affollati').toEqual([]);
  });

  /* Il prezzo dell'eccezione di sopra: se i blocchi dell'agenda sono
     esentati dalla misura, devono almeno essere nominati e raggiungibili.
     Senza queste due asserzioni l'eccezione diventerebbe il posto dove
     nascondere i difetti dell'agenda.

     AGGIORNAMENTO (UI-007) — l'eccezione copre ora molto meno di prima.
     Quando questa prova è stata scritta un blocco da mezz'ora era alto
     18px; con la scala portata a 52px/ora ne misura 24, cioè il minimo
     pieno. L'esenzione vale soltanto per le durate SOTTO la mezz'ora, dove
     il minimo di AGBLK_MIN vince sulla durata. Che i blocchi arrivino a 24
     lo verifica tests/ui/impaginazione.spec.js; qui resta il controllo che
     conta se l'eccezione si applica: nome e tastiera. */
  test('2.5.8 · i blocchi dell\'agenda, esentati per altezza, restano usabili', async ({ page }) => {
    await page.evaluate(() => { if (typeof vaiA === 'function') vaiA('agenda'); render(); });
    await page.waitForTimeout(300);
    const esito = await page.evaluate(() => {
      const blocchi = Array.from(document.querySelectorAll('#app .agblk'))
        .filter(e => e.offsetParent !== null);
      const senzaNome = [], nonRaggiungibili = [];
      for (const b of blocchi) {
        const nome = (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim();
        if (nome.length < 2) senzaNome.push(b.className);
        /* un `button` è raggiungibile da tastiera per natura, a meno che
           qualcuno lo escluda con tabindex negativo */
        const ti = b.getAttribute('tabindex');
        const raggiungibile = (b.tagName === 'BUTTON' || b.tagName === 'A' || (ti !== null && Number(ti) >= 0))
                              && !(ti !== null && Number(ti) < 0) && !b.disabled;
        if (!raggiungibile) nonRaggiungibili.push(b.className + ' tabindex=' + ti);
      }
      return { quanti: blocchi.length, senzaNome, nonRaggiungibili,
               altezze: blocchi.slice(0, 6).map(b => Math.round(b.getBoundingClientRect().height)) };
    });
    expect(esito.quanti, 'nessun blocco in agenda: la prova non sta guardando niente').toBeGreaterThan(0);
    expect(esito.senzaNome, 'blocchi dell\'agenda senza nome accessibile').toEqual([]);
    expect(esito.nonRaggiungibili, 'blocchi dell\'agenda non raggiungibili da tastiera').toEqual([]);
    /* e l'altezza deve davvero variare con la durata: se fossero tutti
       uguali, l'eccezione «essenziale» non avrebbe fondamento */
    expect(new Set(esito.altezze).size,
      'tutti i blocchi hanno la stessa altezza: allora l\'altezza non codifica la durata, e l\'eccezione non vale')
      .toBeGreaterThan(1);
  });
});

test.describe('A11Y-005 · ogni campo ha un nome, e non solo un segnaposto', () => {
  test.beforeEach(async ({ page }) => { await apri(page); });

  test('nessun campo senza nome accessibile', async ({ page }) => {
    const esito = await page.evaluate(() => {
      /* Per input/select/textarea il CONTENUTO non è un nome: per un
         `select` il testo delle opzioni non dice di che campo si tratta.
         Trattarlo come nome nascondeva sette campi senza etichetta. */
      function nome(e) {
        const al = (e.getAttribute('aria-label') || '').trim();
        if (al) return { n: al, d: 'aria-label' };
        const lb = e.getAttribute('aria-labelledby');
        if (lb) {
          let t = '';
          lb.split(/\s+/).forEach(i => { const x = document.getElementById(i); if (x) t += ' ' + x.textContent; });
          if (t.trim()) return { n: t.trim(), d: 'aria-labelledby' };
        }
        if (e.labels && e.labels.length) { const l = e.labels[0].textContent.trim(); if (l) return { n: l, d: 'label' }; }
        const ti = (e.getAttribute('title') || '').trim(); if (ti) return { n: ti, d: 'title' };
        const ph = (e.getAttribute('placeholder') || '').trim(); if (ph) return { n: ph, d: 'placeholder' };
        return { n: '', d: '-' };
      }
      const senza = [], soloPh = [];
      let n = 0;
      document.querySelectorAll('#app input:not([type=hidden]), #app select, #app textarea').forEach(e => {
        if (e.offsetParent === null) return;
        n++;
        const v = nome(e);
        const et = e.tagName.toLowerCase() + '[' + (e.type || '') + '] ' +
                   (e.getAttribute('data-chg') || e.getAttribute('data-keep') || e.id || '?');
        if (!v.n) senza.push(et);
        else if (v.d === 'placeholder') soloPh.push(et);
      });
      return { campi: n, senzaNome: senza, soloPlaceholder: soloPh };
    });
    expect(esito.campi, 'nessun campo esaminato').toBeGreaterThan(10);
    expect(esito.senzaNome, 'campi senza nome accessibile').toEqual([]);
    /* Un `placeholder` non è un'etichetta: sparisce appena si scrive, e chi
       torna sul campo con un lettore di schermo non sa più che campo sia. */
    expect(esito.soloPlaceholder, 'campi il cui unico nome è il segnaposto').toEqual([]);
  });

  /* Un `<label>` che non etichetta niente è una promessa che il markup non
     mantiene. Nel pannello ce n'erano 31: didascalie messe davanti a un
     campo, senza `for`, perché il blocco si ripete nella pagina e gli id si
     ripeterebbero. La scelta è stata: il NOME va sul comando (`aria-label`
     che contiene la parola visibile, come chiede la 2.5.3) e la didascalia
     diventa uno `<span>`. Questa prova tiene ferma quella scelta: ogni
     `<label>` che resta deve essere davvero associato. */
  test('ogni <label> è associato a un comando', async ({ page }) => {
    const rotte = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#app label').forEach(l => {
        if (l.offsetParent === null) return;
        const f = l.getAttribute('for');
        if (f) {
          if (!document.getElementById(f)) out.push('for rotto verso «' + f + '»: ' + l.textContent.trim().slice(0, 24));
          return;
        }
        if (l.querySelector('input,select,textarea')) return;   /* associazione implicita */
        out.push('label senza comando: «' + l.textContent.trim().slice(0, 24) + '» — usa <span class="lbl">');
      });
      return out;
    });
    expect(rotte, 'label che non etichettano niente').toEqual([]);
  });

  test('le didascalie non associate hanno il nome sul comando', async ({ page }) => {
    /* Il rovescio della prova precedente: se la didascalia è uno `<span>`,
       il comando accanto deve avere un nome che la contenga, altrimenti chi
       ascolta ha perso l'informazione invece di riceverla per un'altra via. */
    const scoperti = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#app span.lbl').forEach(s => {
        if (s.offsetParent === null) return;
        if (s.getAttribute('aria-hidden') === 'true') return;    /* spaziatore */
        const testo = (s.textContent || '').replace(/\s+/g, ' ').trim();
        if (!testo) return;
        /* il gruppo può portare il nome al posto del singolo comando */
        const id = s.id;
        if (id && document.querySelector('[aria-labelledby~="' + id + '"]')) return;
        const cont = s.parentElement;
        if (!cont) return;
        const campo = cont.querySelector('input:not([type=hidden]),select,textarea');
        if (!campo) return;                                      /* didascalia di un gruppo di pulsanti */
        const al = (campo.getAttribute('aria-label') || '').trim();
        const lb = campo.getAttribute('aria-labelledby');
        if (lb) return;
        if (!al) { out.push('«' + testo + '»: il comando accanto non ha nome'); return; }
        /* WCAG 2.5.3: il nome deve contenere il testo visibile */
        if (al.toLowerCase().indexOf(testo.toLowerCase()) < 0)
          out.push('«' + testo + '» non è contenuto in aria-label «' + al + '»');
      });
      return out;
    });
    expect(scoperti, 'didascalie il cui testo non arriva a chi ascolta').toEqual([]);
  });

  test('i gruppi di pulsanti hanno un nome, e lo stato non è solo colore', async ({ page }) => {
    const esito = await page.evaluate(() => {
      const senzaNome = [], senzaStato = [];
      document.querySelectorAll('#app [role="group"]').forEach(g => {
        if (g.offsetParent === null) return;
        const al = (g.getAttribute('aria-label') || '').trim();
        const lb = g.getAttribute('aria-labelledby');
        const rif = lb ? document.getElementById(lb.split(/\s+/)[0]) : null;
        if (!al && !(rif && rif.textContent.trim())) senzaNome.push(String(g.className) || g.tagName);
      });
      /* i pulsanti dei giorni restano premuti: senza `aria-pressed` lo stato
         è solo il colore di fondo, e chi ascolta non sa quali giorni ha scelto */
      document.querySelectorAll('#app button.dayb').forEach(b => {
        if (b.offsetParent === null) return;
        if (b.getAttribute('aria-pressed') === null) senzaStato.push(b.textContent.trim());
        /* e il nome non può essere la sola iniziale: «M» è martedì o mercoledì? */
        const n = (b.getAttribute('aria-label') || b.textContent || '').trim();
        if (n.length < 3) senzaStato.push('nome troppo corto: «' + n + '»');
      });
      return { senzaNome, senzaStato };
    });
    expect(esito.senzaNome, 'gruppi di comandi senza nome').toEqual([]);
    expect(esito.senzaStato, 'pulsanti dei giorni senza stato o senza nome pieno').toEqual([]);
  });
});
