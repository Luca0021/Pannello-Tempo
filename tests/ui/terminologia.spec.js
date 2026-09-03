/* tests/ui/terminologia.spec.js — CPY-002 / SYN-006.
 *
 * Fa fallire la pipeline se il gergo tecnico ricompare nell'interfaccia
 * consumer, o se Account e Calendario tornano a confondersi.
 *
 * Perché serve un collaudo e non basta la revisione: i testi di questo
 * pannello sono costruiti concatenando stringhe in una dozzina di moduli.
 * Una riga aggiunta in `settings-ui.js` fra sei mesi può reintrodurre
 * «projectId» senza che nessuno lo noti, e la persona che la scrive non ha
 * letto SYNC-DECISION.md.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node.
 * Comando in RUN-CI.md.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

/* Parole che non devono MAI comparire nel testo visibile del pannello.
   Sono nomi di fornitori e di concetti che l'utente non deve conoscere per
   usare il prodotto. Il confronto è sul testo reso, non sul sorgente:
   un commento nel codice che nomina Firebase è legittimo e necessario.
 *
 * ATTENZIONE ai confini di parola. La prima versione di questo elenco
 * conteneva la stringa `gist` e faceva fallire il collaudo su
 * «Re-gist-ro» e «re-gist-rato», che sono parole italiane innocenti.
 * Un collaudo che grida al lupo viene disattivato, e allora non protegge
 * più niente: per questo le voci brevi sono espressioni regolari con \b. */
const VIETATE_NELLA_UI = [
  /\bFirebase\b/i,
  /\bFirestore\b/i,
  /\bGitHub\b/,
  /\bGist\b/i,
  /\bPAT\b/,
  /personal access token/i,
  /\bapiKey\b/,
  /\bAPI key\b/i,
  /\bchiave API\b/i,
  /\bprojectId\b/,
  /\bID progetto\b/i,
  /\bauthDomain\b/,
  /\bappId\b/,
  /\bUID\b/,
  /\bcollection\b/i,
  /\bSecurity Rules\b/i,
  /rules_version/,
  /console\.firebase/i,
  /identitytoolkit/i,
  /googleapis/i,
  /\bprovider\b/i
];

/* Parole dell'area Account che non devono comparire nella sezione
   Calendario, e viceversa. È la separazione richiesta dalla Fase 2. */
const SOLO_ACCOUNT = ['Account Pannello Tempo', 'Crea account', 'Disconnetti',
  'Elimina account', 'Modifiche da sincronizzare', 'Ultima sincronizzazione'];
const SOLO_CALENDARIO = ['Importa da file', 'Esporta nel calendario',
  'Ultima esportazione', 'Ultima importazione', 'Nessun calendario collegato',
  'Integrazione automatica non attiva'];

/* Frasi sbagliate, esplicitamente vietate dal mandato. */
const FRASI_VIETATE = [
  'sincronizzazione calendario',
  'sincronizzazione del calendario',
  'calendario collegato',        /* ammesso solo dentro «Nessun calendario collegato» */
  'calendario sincronizzato',
  'i tuoi dati sono al sicuro',
  'completamente sicuri',
  'end-to-end encrypted'
];

async function apriTutto(page) {
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof render === 'function');
  await page.evaluate(() => {
    localStorage.clear();
    setImp('onboardingFatto', true);
    setImp('modo', 'avanzata');
    S.onboarding = null;
    /* apro ogni sezione pieghevole: un testo dentro una scheda chiusa non
       viene generato, e un collaudo che non lo genera non lo controlla */
    P.fold = {};
    document.querySelectorAll('[data-act="fold"]').forEach(b => {
      const v = b.getAttribute('data-v'); if (v) P.fold[v] = false;
    });
    savePrefs();
    render();
    /* secondo giro: alcune schede compaiono solo dopo il primo disegno */
    document.querySelectorAll('[data-act="fold"]').forEach(b => {
      const v = b.getAttribute('data-v'); if (v) P.fold[v] = false;
    });
    savePrefs();
    render();
  });
  await page.waitForTimeout(400);
}

function testoVisibile(page) {
  return page.evaluate(() => {
    /* solo il testo che un utente può leggere: niente attributi nascosti,
       niente commenti, niente contenuto di elementi non visibili */
    const app = document.getElementById('app');
    const salta = new Set(['SCRIPT', 'STYLE', 'TEMPLATE']);
    let out = '';
    const cammina = (n) => {
      if (n.nodeType === 3) { out += n.textContent + ' '; return; }
      if (n.nodeType !== 1) return;
      if (salta.has(n.tagName)) return;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      /* i testi per i soli lettori di schermo contano: sono testo */
      for (const c of n.childNodes) cammina(c);
      /* anche gli attributi che vengono letti ad alta voce */
      const aria = n.getAttribute && n.getAttribute('aria-label');
      if (aria) out += aria + ' ';
      const ph = n.getAttribute && n.getAttribute('placeholder');
      if (ph) out += ph + ' ';
      const ti = n.getAttribute && n.getAttribute('title');
      if (ti) out += ti + ' ';
    };
    cammina(app);
    return out.replace(/\s+/g, ' ');
  });
}

test.describe('CPY-002 · terminologia della UI consumer', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('nessun nome di fornitore né gergo tecnico nel testo visibile', async ({ page }) => {
    await apriTutto(page);
    const t = await testoVisibile(page);
    const trovate = VIETATE_NELLA_UI
      .filter(re => re.test(t))
      .map(re => {
        const m = t.match(re);
        const i = t.indexOf(m[0]);
        return { parola: m[0], contesto: t.slice(Math.max(0, i - 60), i + 40) };
      });
    expect(trovate, 'parole vietate trovate nell\'interfaccia consumer').toEqual([]);
  });

  test('nessuna frase che confonda sincronizzazione e calendario', async ({ page }) => {
    await apriTutto(page);
    const t = (await testoVisibile(page)).toLowerCase();
    const trovate = FRASI_VIETATE.filter(f => {
      if (f === 'calendario collegato') {
        /* ammesso solo nella forma negativa «Nessun calendario collegato» */
        const tutte = (t.match(/calendario collegato/g) || []).length;
        const negate = (t.match(/nessun calendario collegato/g) || []).length;
        return tutte > negate;
      }
      return t.includes(f);
    });
    expect(trovate, 'frasi ambigue o rassicurazioni generiche').toEqual([]);
  });

  /* Le due sezioni si identificano dal TITOLO della scheda, non dal suo
     contenuto. Cercare le parole nel testo intero pescava anche la scheda
     «Come vuoi usare il pannello», che elenca i nomi di tutti i moduli — e
     quindi nomina legittimamente sia l'account sia il calendario.

     Niente `eval` dentro `page.evaluate`: la CSP del pannello vieta
     `script-src 'unsafe-eval'`, quindi una funzione passata come stringa e
     ricostruita nella pagina verrebbe bloccata. Il predicato passa come
     sorgente di espressione regolare e viene ricomposto con `new RegExp`,
     che la CSP non tocca. */
  async function scansionaSezione(page, reTitolo, parole) {
    return page.evaluate(([src, parole]) => {
      const re = new RegExp(src);
      const titolo = c => { const h = c.querySelector('h2'); return h ? h.textContent.replace(/[▾▸]/g, '').trim() : ''; };
      const schede = [...document.querySelectorAll('.card')].filter(c => re.test(titolo(c)));
      const t = schede.map(c => c.textContent).join(' ');
      return { titoli: schede.map(titolo), trovate: parole.filter(p => t.includes(p)) };
    }, [reTitolo, parole]);
  }

  test('le parole dell\'Account non compaiono nella sezione Calendario', async ({ page }) => {
    await apriTutto(page);
    const r = await scansionaSezione(page, '^(Calendario e promemoria|Importa da file \\.ics)', SOLO_ACCOUNT);
    expect(r.titoli.length, 'le schede del Calendario devono esistere').toBeGreaterThan(0);
    expect(r.trovate, 'terminologia dell\'Account dentro la sezione Calendario').toEqual([]);
  });

  test('le parole del Calendario non compaiono nella sezione Account', async ({ page }) => {
    await apriTutto(page);
    const r = await scansionaSezione(page, '^Sincronizzazione', SOLO_CALENDARIO);
    expect(r.titoli.length, 'la scheda dell\'Account deve esistere').toBeGreaterThan(0);
    expect(r.trovate, 'terminologia del Calendario dentro la sezione Account').toEqual([]);
  });

  test('gli stati richiesti dalla Fase 2 sono presenti', async ({ page }) => {
    await apriTutto(page);
    const t = await testoVisibile(page);
    const attesi = [
      'Solo su questo dispositivo',
      'Nessun calendario collegato',
      'Integrazione automatica non attiva',
      'Ultima esportazione',
      'Ultima importazione',
      'Promemoria nell\'app'
    ];
    const mancanti = attesi.filter(a => !t.includes(a));
    expect(mancanti, 'stati espliciti mancanti nell\'interfaccia').toEqual([]);
  });

  test('Gist non è selezionabile come provider', async ({ page }) => {
    await apriTutto(page);
    const esito = await page.evaluate(() => ({
      /* nessun comando di scelta del fornitore nella pagina */
      selettori: document.querySelectorAll('[data-act="provider"]').length,
      /* l'adattatore non si dichiara mai pronto */
      gistConfigurato: PROVIDER.gist.isConfigured(),
      gistDeprecato: PROVIDER.gist.deprecato === true,
      /* la scrittura è rifiutata */
      scritturaRifiutata: true
    }));
    expect(esito.selettori, 'nessun selettore di fornitore nella UI').toBe(0);
    expect(esito.gistConfigurato, 'Gist non deve dichiararsi configurato').toBe(false);
    expect(esito.gistDeprecato, 'Gist deve essere marcato deprecato').toBe(true);
    const push = await page.evaluate(() => PROVIDER.gist.push('x').then(
      () => 'accettata', e => 'rifiutata: ' + e.titolo));
    expect(push).toContain('rifiutata');
  });

  test('la modalità predefinita è Solo dispositivo', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => typeof sync !== 'undefined');
    const p = await page.evaluate(() => ({ provider: sync.provider, pronto: syncReady() }));
    expect(p.provider).toBe('locale');
    expect(p.pronto).toBe(false);
  });
});
