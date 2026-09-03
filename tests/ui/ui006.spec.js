/* tests/ui/ui006.spec.js — UI-006: l'indicatore dell'area Lavoro/Vita.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node, quindi non
 * c'è Playwright. Il comando per eseguirlo è in RUN-CI.md. Finché non produce
 * un esito, UI-006 resta PARZIALE.
 *
 * Le asserzioni sono STRUTTURALI: guardano il DOM disegnato, non la presenza
 * di una regola CSS. «Il CSS c'è» non è una verifica — la barra d'area
 * poteva essere reintrodotta da una regola più specifica in un altro file, e
 * un test sul foglio di stile non l'avrebbe visto.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

/* ── strumenti eseguiti dentro la pagina ─────────────────────────────────── */

/* Prepara dati deterministici. Nessuna data «oggi» lasciata al caso: gli
   scatti di riferimento devono essere riproducibili. */
async function preparaDati(page, opzioni) {
  const o = Object.assign({ soloLavoro: false, soloVita: false, gruppo: false,
                            compatta: false, tema: 'chiaro', completato: false,
                            inAttesa: false, titoloLungo: false, areaAssente: false }, opzioni || {});
  await page.evaluate((o) => {
    localStorage.clear();
    /* l'app è già caricata: ricostruisco lo stato e ridisegno */
    setImp('onboardingFatto', true);
    setImp('modo', 'avanzata');
    S.onboarding = null;
    S.data.items = [];
    S.data.capture = [];
    const gf = n => dayKey(new Date(S.now.getTime() - n * 86400000));
    const voci = [];
    if (!o.soloVita) {
      voci.push({ id:'t-lav-1', label:'Preparare la riunione con il cliente', area:'lavoro', freq:'once', date:gf(4), start:15, dur:1.5 });
      voci.push({ id:'t-lav-2', label:'Rispondere alle email arretrate', area:'lavoro', freq:'daily', start:9, dur:0.5 });
    }
    if (!o.soloLavoro) {
      voci.push({ id:'t-vit-1', label:'Richiamare lo studio dentistico', area:'vita', freq:'once', date:gf(9) });
      voci.push({ id:'t-vit-2', label:'Camminata di mezz\'ora', area:'vita', freq:'daily' });
    }
    if (o.titoloLungo)
      voci.push({ id:'t-lungo', area:'vita', freq:'once', date:gf(2),
        label:'Titolo deliberatamente molto lungo senza spazi per verificare che non produca scorrimento orizzontale ' + 'x'.repeat(70) });
    if (o.areaAssente)
      voci.push({ id:'t-senza', label:'Voce con area non riconosciuta', area:'marte', freq:'once', date:gf(3) });
    if (o.inAttesa)
      voci.push({ id:'t-attesa', label:'Ricevere il preventivo', area:'lavoro', freq:'once', date:gf(5), waiting:true, bloccatoDa:'Marco' });
    S.data.items = voci;
    if (o.completato && voci.length) S.data.checks[voci[0].id] = stampFor(voci[0].freq);
    P.theme = o.tema;
    P.dense = !!o.compatta;
    P.groupBy = o.gruppo ? 'area' : 'sezione';
    savePrefs();
    normalizeData();
    commit();
  }, o);
  await page.waitForTimeout(250);
}

/* Le stesse misure usate in sessione, portate dentro la pagina. */
const MISURE = () => {
  function parse(c){ const m=String(c).match(/rgba?\(([^)]+)\)/); if(!m) return null;
    const p=m[1].split(',').map(s=>parseFloat(s.trim()));
    return {r:p[0],g:p[1],b:p[2],a:(p.length>3?p[3]:1)}; }
  function stops(s){ const o=[],re=/rgba?\(([^)]+)\)/g; let m;
    while((m=re.exec(s))){ const p=m[1].split(',').map(x=>parseFloat(x.trim()));
      const c={r:p[0],g:p[1],b:p[2],a:(p.length>3?p[3]:1)}; if(c.a>0.05) o.push(c);} return o; }
  function over(f,b){ const a=f.a;
    return {r:f.r*a+b.r*(1-a),g:f.g*a+b.g*(1-a),b:f.b*a+b.b*(1-a),a:1}; }
  function lum(c){ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
  function ratio(a,b){ const l1=lum(a),l2=lum(b),hi=Math.max(l1,l2),lo=Math.min(l1,l2);
    return (hi+0.05)/(lo+0.05); }
  function fondi(el){
    let cand=[{r:255,g:255,b:255,a:1}],node=el,acc=null;
    while(node&&node.nodeType===1){
      const cs=getComputedStyle(node);
      const gs=(cs.backgroundImage&&cs.backgroundImage!=='none')?stops(cs.backgroundImage):[];
      const bg=parse(cs.backgroundColor);
      if(gs.length){ const base=(bg&&bg.a>0)?bg:null;
        cand=gs.map(g=>base?over(g,base):g);
        if(cand.some(c=>c.a>=0.999)) return cand.map(c=>c.a<1?over(c,{r:255,g:255,b:255,a:1}):c); }
      if(bg&&bg.a>0){ acc=acc?over(acc,bg):bg; if(acc.a>=0.999) return [acc]; }
      node=node.parentNode; }
    if(acc) return [acc.a<1?over(acc,{r:255,g:255,b:255,a:1}):acc];
    return cand.map(c=>c.a<1?over(c,{r:255,g:255,b:255,a:1}):c);
  }
  function visibile(el){ const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none') return false;
    const r=el.getBoundingClientRect(); return r.width>=1&&r.height>=1; }
  function tp(el){ return [...el.childNodes].filter(n=>n.nodeType===3)
    .map(n=>n.textContent.trim()).join(' ').trim(); }
  function rettVisibile(el){
    let q=el.getBoundingClientRect(), p=el.parentElement;
    while(p){ const cs=getComputedStyle(p);
      if(/auto|hidden|scroll/.test(cs.overflow+cs.overflowX+cs.overflowY)){
        const pr=p.getBoundingClientRect();
        const l=Math.max(q.left,pr.left),t=Math.max(q.top,pr.top);
        const ri=Math.min(q.right,pr.right),b=Math.min(q.bottom,pr.bottom);
        if(ri<=l||b<=t) return null;
        q={left:l,top:t,right:ri,bottom:b,width:ri-l,height:b-t}; }
      p=p.parentElement; }
    return q;
  }
  const app = document.getElementById('app');
  const righe = [...app.querySelectorAll('li[data-area]')].filter(visibile);
  const caselle = [...app.querySelectorAll('.box')].filter(visibile);
  const chip = [...app.querySelectorAll('.areachip')].filter(visibile);
  const punti = [...app.querySelectorAll('.areapunto')];

  /* 1 — nessuna barra colorata sul bordo sinistro */
  const conBarra = righe.filter(li => {
    const cs = getComputedStyle(li), w = parseFloat(cs.borderLeftWidth);
    return w > 0 && cs.borderLeftStyle !== 'none' && cs.borderLeftColor !== 'rgba(0, 0, 0, 0)';
  }).length;

  /* 3 — bersaglio minimo */
  const minCasella = caselle.length
    ? Math.min(...caselle.map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }))
    : 0;

  /* 7 — spazio fra casella e contenuto */
  const spazi = righe.map(li => {
    const cb = li.querySelector('.box'), co = li.querySelector('.taskcont, .txt, .agtesto');
    if (!cb || !co) return null;
    const a = cb.getBoundingClientRect(), b = co.getBoundingClientRect();
    return Math.round(b.left - a.right);
  }).filter(x => x !== null);

  /* 8 — separatore indipendente dall'area, dentro la stessa lista */
  const perLista = {}; const divergenti = [];
  righe.forEach(li => {
    if (li === li.parentElement.lastElementChild) return;
    const k = li.parentElement.className || li.parentElement.tagName;
    perLista[k] = perLista[k] || {};
    perLista[k][li.getAttribute('data-area')] = getComputedStyle(li).borderBottomColor;
  });
  Object.keys(perLista).forEach(k => {
    const v = Object.values(perLista[k]);
    if (new Set(v).size > 1) divergenti.push(k);
  });

  /* 9 — sovrapposizioni reali */
  const nodi = [];
  for (const el of app.querySelectorAll('*')) {
    if (!tp(el) || !visibile(el)) continue;
    let p = el, fisso = false;
    while (p && p.nodeType === 1) { if (getComputedStyle(p).position === 'fixed') { fisso = true; break; } p = p.parentElement; }
    if (fisso) continue;
    const q = rettVisibile(el);
    if (!q || q.width < 1 || q.height < 1) continue;
    nodi.push({ el, r: q });
  }
  let sovrapposti = 0;
  for (let a = 0; a < nodi.length; a++) for (let b = a + 1; b < nodi.length; b++) {
    const A = nodi[a], B = nodi[b];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
    const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
    if (ox > 2 && oy > 2) sovrapposti++;
  }

  /* 11 — contrasto dei testi */
  const contrasto = [];
  for (const el of app.querySelectorAll('*')) {
    const t = tp(el); if (!t || !visibile(el)) continue;
    const cs = getComputedStyle(el); let fg = parse(cs.color); if (!fg) continue;
    const op = parseFloat(cs.opacity); if (op < 1) fg = { ...fg, a: fg.a * op };
    let peggio = 99;
    for (const bg of fondi(el)) { const fs = fg.a < 1 ? over(fg, bg) : fg; const r = ratio(fs, bg); if (r < peggio) peggio = r; }
    const px = parseFloat(cs.fontSize), pw = parseInt(cs.fontWeight, 10) || 400;
    const soglia = (px >= 24 || (px >= 18.66 && pw >= 700)) ? 3 : 4.5;
    if (peggio < soglia) contrasto.push({ testo: t.slice(0, 40), rapporto: Math.round(peggio * 100) / 100, soglia });
  }

  /* 12 — contrasto del punto d'area (elemento grafico: 3:1) */
  const puntiSotto3 = punti.filter(p => {
    if (!visibile(p)) return false;
    const c = parse(getComputedStyle(p).backgroundColor);
    if (!c || c.a === 0) return false;
    return !fondi(p.parentElement).every(bg => ratio(c.a < 1 ? over(c, bg) : c, bg) >= 3);
  }).length;

  /* 13 — bersagli sotto 24x24 */
  const bersagliPiccoli = [...app.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[role="checkbox"]')]
    .filter(visibile)
    .filter(e => { const r = e.getBoundingClientRect(); return r.width < 24 && r.height < 24; })
    .map(e => ({ t: (e.textContent || '').trim().slice(0, 20) || e.getAttribute('aria-label') || e.tagName,
                 m: Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) }));

  const d = document.documentElement;
  return {
    righe: righe.length,
    conBarra,
    caselle: caselle.length,
    casellePulsante: caselle.filter(e => e.tagName === 'BUTTON').length,
    minCasella: Math.round(minCasella),
    chip: chip.length,
    chipSenzaTesto: chip.filter(c => !/Lavoro|Vita|Area non indicata/.test(c.textContent)).length,
    puntiNonNascosti: punti.filter(p => p.getAttribute('aria-hidden') !== 'true').length,
    caselleTask: caselle.filter(e => e.getAttribute('data-act') === 'toggle').length,
    caselleSenzaArea: caselle.filter(e => e.getAttribute('data-act') === 'toggle')
      .filter(e => !/^(Lavoro|Vita|Area non indicata),/.test(e.getAttribute('aria-label') || '')).length,
    spazioMinimo: spazi.length ? Math.min(...spazi) : null,
    separatoriDivergenti: divergenti,
    sovrapposti,
    contrasto,
    puntiSotto3,
    bersagliPiccoli,
    scrollWidth: d.scrollWidth,
    clientWidth: d.clientWidth,
    badgeInGruppo: typeof badgeArea === 'function' ? badgeArea({ area: 'lavoro', label: 'x' }, 'gruppo-area') : 'n/d',
    badgeInLista: typeof badgeArea === 'function' ? badgeArea({ area: 'lavoro', label: 'x' }, 'lista') : 'n/d'
  };
};

/* Le 14 asserzioni, applicate a qualunque stato preparato. */
function verifica(m) {
  expect(m.righe, 'la pagina deve contenere righe con area').toBeGreaterThan(0);
  expect(m.conBarra, '01 — nessuna barra colorata attaccata alla casella').toBe(0);
  expect(m.casellePulsante, '02 — nessun <button> travestito da casella').toBe(0);
  expect(m.minCasella, '03 — bersaglio della casella almeno 24x24').toBeGreaterThanOrEqual(24);
  expect(m.chipSenzaTesto, '04 — l\'area non è comunicata dal solo colore').toBe(0);
  expect(m.puntiNonNascosti, '05 — il punto è decorativo e va nascosto').toBe(0);
  expect(m.caselleSenzaArea, '06 — il nome accessibile include l\'area').toBe(0);
  if (m.spazioMinimo !== null)
    expect(m.spazioMinimo, '07 — spazio fra casella e contenuto').toBeGreaterThanOrEqual(8);
  expect(m.separatoriDivergenti, '08 — separatore indipendente dall\'area').toEqual([]);
  expect(m.sovrapposti, '09 — nessuna sovrapposizione di testo').toBe(0);
  expect(m.scrollWidth, '10 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(m.clientWidth + 1);
  expect(m.contrasto, '11 — contrasto dei testi 4,5:1').toEqual([]);
  expect(m.puntiSotto3, '12 — contrasto del punto d\'area 3:1').toBe(0);
  expect(m.bersagliPiccoli, '13 — nessun bersaglio sotto 24x24').toEqual([]);
  expect(m.badgeInLista, '14a — il badge compare in una lista normale').not.toBe('');
  expect(m.badgeInGruppo, '14b — il badge NON si ripete in una lista raggruppata').toBe('');
}

/* ── gli scenari ─────────────────────────────────────────────────────────── */

const SCENARI = [
  { nome: 'lavoro',            opt: { soloLavoro: true } },
  { nome: 'vita',              opt: { soloVita: true } },
  { nome: 'lista-mista',       opt: {} },
  { nome: 'lista-raggruppata', opt: { gruppo: true } },
  { nome: 'completato',        opt: { completato: true } },
  { nome: 'in-attesa',         opt: { inAttesa: true } },
  { nome: 'titolo-lungo',      opt: { titoloLungo: true } },
  { nome: 'cinque-azioni',     opt: {} },
  { nome: 'compatta',          opt: { compatta: true } },
  { nome: 'area-assente',      opt: { areaAssente: true } }
];

const VIEWPORT = {
  desktop: { width: 1280, height: 900 },
  mobile:  { width: 375,  height: 812 },
  /* zoom 200%: metà dei pixel CSS a parità di contenuto */
  zoom200: { width: 640,  height: 450 }
};

for (const tema of ['chiaro', 'scuro']) {
  for (const [nomeVp, vp] of Object.entries(VIEWPORT)) {
    test.describe(`UI-006 · ${tema} · ${nomeVp}`, () => {
      test.use({ viewport: vp, colorScheme: tema === 'scuro' ? 'dark' : 'light' });

      for (const s of SCENARI) {
        test(`${s.nome}`, async ({ page }) => {
          await page.goto(BASE + '/index.html');
          await page.waitForFunction(() => typeof render === 'function' && document.getElementById('app').children.length > 0);
          await preparaDati(page, Object.assign({ tema }, s.opt));
          const m = await page.evaluate(MISURE);
          verifica(m);

          /* Regressione visiva. Alla PRIMA esecuzione questo passo fallisce
             di proposito: i riferimenti non esistono, Playwright li crea e si
             ferma. Vanno guardati e approvati a mano — uno scatto appena
             generato non dimostra che l'aspetto sia giusto. */
          const bersaglio = page.locator('[data-sez="recupera"], [data-sez="today"]').first();
          if (await bersaglio.count()) {
            await expect(bersaglio).toHaveScreenshot(`${s.nome}-${tema}-${nomeVp}.png`, {
              maxDiffPixelRatio: 0.01,
              animations: 'disabled'
            });
          }
        });
      }
    });
  }
}

/* Una verifica che non dipende dal disegno: la proprietà `checked` deve
   seguire lo stato anche quando lo stato cambia da fuori (sincronizzazione,
   annullamento, ripristino). È il difetto che la casella nativa introduce se
   il diffing sincronizza solo gli attributi. */
test.describe('UI-006 · casella nativa e stato', () => {
  test.use({ viewport: VIEWPORT.desktop });
  test('la casella segue uno stato cambiato dal codice', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await page.waitForFunction(() => typeof render === 'function');
    await preparaDati(page, {});
    const esito = await page.evaluate(() => {
      const cb = document.querySelector('input.box[data-act="toggle"]');
      const id = cb.getAttribute('data-id');
      const it = itemById(id);
      S.data.checks[id] = stampFor(it.freq);   /* cambio NON originato dal clic */
      render();
      const dopo = document.querySelector('input.box[data-id="' + id + '"]');
      return { statoDice: isOn(it), casellaMostra: dopo.checked };
    });
    expect(esito.casellaMostra).toBe(esito.statoDice);
  });
});
