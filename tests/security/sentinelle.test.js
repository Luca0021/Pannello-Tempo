/* tests/security/sentinelle.test.js — SEC-001: nessun segreto persistito.
 *
 * Fa fallire la pipeline se un token, una password o una chiave finisce in
 * qualunque meccanismo di persistenza del browser.
 *
 * Perché sentinelle e non un controllo sui campi noti: una pulizia che
 * azzera `o.fb.refresh` e lascia `o.fb.credenziali.refresh` supererebbe un
 * controllo sui campi e fallisce questo. Si cercano le STRINGHE.
 *
 * Eseguito da Playwright, perché servono un browser vero e i suoi
 * meccanismi di persistenza: sessionStorage, Cache API e IndexedDB non
 * esistono in Node.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node.
 * Comando in RUN-CI.md.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

/* Valori sentinella: riconoscibili, e nessuno è un segreto vero. */
const SENT = {
  idToken:  'SENTINELLA_ID_TOKEN_0123456789',
  refresh:  'SENTINELLA_REFRESH_0123456789',
  pat:      'ghp_' + 'S'.repeat(36),
  password: 'SENTINELLA_PASSWORD',
  apiKey:   'AIza' + 'S'.repeat(35),
  jwt:      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZW50aW5lbGxhIn0.firma'
};

async function apri(page) {
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof sync !== 'undefined' && typeof auditSegreti === 'function');
}

test.describe('SEC-001 · nessun segreto persistito', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('lo strumento di audit copre sei meccanismi', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(() => auditSegreti());
    expect(r.controllati).toEqual(
      ['localStorage', 'sessionStorage', 'URL', 'cookie', 'Cache API', 'IndexedDB']);
  });

  test('lo strumento di audit trova davvero i segreti (controprova)', async ({ page }) => {
    await apri(page);
    /* Un controllo che non trova niente può essere corretto oppure rotto.
       Questa prova lo sporca di proposito: se non trova, il controllo è
       inutile e tutte le altre prove di questo file non valgono nulla. */
    const r = await page.evaluate(async (S) => {
      localStorage.setItem('sporco-1', JSON.stringify({ fb: { idToken: S.idToken } }));
      localStorage.setItem('sporco-2', JSON.stringify({ gist: { token: S.pat } }));
      localStorage.setItem('sporco-3', JSON.stringify({ password: S.password }));
      localStorage.setItem('sporco-4', S.apiKey);
      localStorage.setItem('sporco-5', S.jwt);
      sessionStorage.setItem('sporco-6', JSON.stringify({ refresh_token: S.refresh }));
      const out = await auditSegreti();
      ['sporco-1','sporco-2','sporco-3','sporco-4','sporco-5'].forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('sporco-6');
      return out;
    }, SENT);
    expect(r.pulito).toBe(false);
    const tipi = r.trovati.map(t => t.split('→')[1].trim());
    expect(tipi).toContain('token di sessione');
    expect(tipi).toContain('token GitHub');
    expect(tipi).toContain('password');
    expect(tipi).toContain('chiave API Google');
    expect(tipi).toContain('JWT');
  });

  test('una sessione viva non lascia segreti in nessun meccanismo', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(async (S) => {
      localStorage.clear();
      /* sessione finta: nessuna chiamata di rete */
      applicaSessione({ localId: 'uid-prova', idToken: S.idToken, expiresIn: '3600' }, 'prova@esempio.invalid');
      sync.gist.token = S.pat;
      saveSync();
      save();
      return auditSegreti();
    }, SENT);
    expect(r.trovati, 'segreti trovati con una sessione attiva').toEqual([]);
  });

  test('la disconnessione non lascia residui', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(async (S) => {
      localStorage.clear();
      applicaSessione({ localId: 'uid-prova', idToken: S.idToken, expiresIn: '3600' }, 'prova@esempio.invalid');
      sync.gist.token = S.pat;
      saveSync();
      const u = esciAccount(true);
      const a = await auditSegreti();
      return { dichiarati: u.residui, sentinelle: u.sentinelle, audit: a.trovati,
               provider: sync.provider, pronto: syncReady() };
    }, SENT);
    expect(r.dichiarati).toEqual([]);
    expect(r.sentinelle).toEqual([]);
    expect(r.audit).toEqual([]);
    expect(r.provider).toBe('locale');
    expect(r.pronto, 'dopo l\'uscita non si legge più dal cloud').toBe(false);
  });

  test('un blocco scritto da una versione precedente viene ripulito all\'avvio', async ({ page }) => {
    await apri(page);
    /* Simula il disco lasciato dalla build 035c16ab8a8f, che scriveva i
       token in chiaro, e ricarica: la pulizia gira a ogni avvio. */
    await page.evaluate((S) => {
      localStorage.setItem('pannello-tempo:sync', JSON.stringify({
        provider: 'gist', auto: true, rev: 7, dirty: true, ricordami: true,
        gist: { id: 'a'.repeat(32), token: S.pat, file: 'pannello.json' },
        fb: { apiKey: S.apiKey, projectId: 'vecchio', email: 'x@esempio.invalid',
              uid: 'uid-vecchio', refresh: S.refresh, idToken: S.idToken, expAt: 9e15 }
      }));
    }, SENT);
    await page.reload();
    await page.waitForFunction(() => typeof auditSegreti === 'function');
    const r = await page.evaluate(() => auditSegreti().then(a => ({
      trovati: a.trovati, provider: sync.provider, pronto: syncReady(),
      idInMemoria: sync.gist.id, tokenInMemoria: sync.gist.token
    })));
    expect(r.trovati, 'la pulizia all\'avvio deve togliere tutto').toEqual([]);
    expect(r.provider, 'il provider deprecato torna a locale').toBe('locale');
    expect(r.pronto).toBe(false);
    expect(r.idInMemoria, 'l\'identificativo resta: serve al recupero').not.toBe('');
    expect(r.tokenInMemoria, 'il token no').toBe('');
  });

  test('l\'export non contiene credenziali', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate((S) => {
      applicaSessione({ localId: 'uid-prova', idToken: S.idToken, expiresIn: '3600' }, 'prova@esempio.invalid');
      sync.gist.token = S.pat;
      const json = esportaJson();
      const csv = esportaCsv();
      const valori = Object.keys(S).map(k => S[k]);
      return {
        jsonSporco: valori.filter(v => json.indexOf(v) >= 0),
        csvSporco: valori.filter(v => csv.indexOf(v) >= 0)
      };
    }, SENT);
    expect(r.jsonSporco, 'sentinelle trovate nell\'export JSON').toEqual([]);
    expect(r.csvSporco, 'sentinelle trovate nell\'export CSV').toEqual([]);
  });

  test('le copie di sicurezza non contengono credenziali', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(async (S) => {
      applicaSessione({ localId: 'uid-prova', idToken: S.idToken, expiresIn: '3600' }, 'prova@esempio.invalid');
      sync.gist.token = S.pat;
      salvaBackupAutomatico('prova sentinelle');
      salvaBackupPreMigrazione(JSON.stringify(S.data || {}));
      return auditSegreti();
    }, SENT);
    expect(r.trovati, 'sentinelle trovate nelle copie di sicurezza').toEqual([]);
  });

  test('il diario tecnico non contiene credenziali né titoli di attività', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate((S) => {
      S.data = S.data || {};
      applicaSessione({ localId: 'uid-prova', idToken: S.idToken, expiresIn: '3600' }, 'prova@esempio.invalid');
      registraOperazione('sicurezza', 'prova');
      const diario = JSON.stringify(window.S.data.operazioni || []);
      return { sporco: Object.keys(S).map(k => S[k]).filter(v => diario.indexOf(v) >= 0) };
    }, SENT);
    expect(r.sporco).toEqual([]);
  });

  test('nessun token nell\'URL', async ({ page }) => {
    await apri(page);
    const u = page.url();
    expect(u).not.toContain('token');
    expect(u).not.toContain('idToken');
    expect(u).not.toContain('ghp_');
    expect(u).not.toContain('AIza');
  });

  test('il service worker non mette in cache risposte con credenziali', async ({ page }) => {
    await apri(page);
    /* Le chiamate ai servizi sono escluse dalla cache per costruzione
       (MAI_IN_CACHE in sw.js). «Per costruzione» è un'affermazione che va
       verificata: l'audit legge i corpi in cache e cerca le sentinelle. */
    const r = await page.evaluate(() => {
      const re = /api\.github\.com|googleapis\.com|firebaseio|identitytoolkit/;
      return {
        escludeGitHub: re.test('https://api.github.com/gists/x'),
        escludeIdentity: re.test('https://identitytoolkit.googleapis.com/v1/x'),
        escludeFirestore: re.test('https://firestore.googleapis.com/v1/x'),
        includeIlSito: !re.test('http://127.0.0.1:8765/js/sync.js')
      };
    });
    expect(r.escludeGitHub).toBe(true);
    expect(r.escludeIdentity).toBe(true);
    expect(r.escludeFirestore).toBe(true);
    expect(r.includeIlSito).toBe(true);
    const a = await page.evaluate(() => auditSegreti());
    expect(a.trovati.filter(t => t.indexOf('cache') === 0)).toEqual([]);
  });

  test('cambio account: i dati del precedente non entrano nel nuovo', async ({ page }) => {
    await apri(page);
    const r = await page.evaluate(() => {
      localStorage.clear();
      /* account A con una voce riconoscibile */
      applicaSessione({ localId: 'uid-A', idToken: 'TOK_A', expiresIn: '3600' }, 'a@esempio.invalid');
      S.data.items = [{ id: 'voce-di-A', label: 'appartiene ad A', area: 'lavoro', freq: 'once' }];
      save();
      /* uscita e ingresso con un altro UID, senza rete */
      esciAccount(true);
      applicaSessione({ localId: 'uid-B', idToken: 'TOK_B', expiresIn: '3600' }, 'b@esempio.invalid');
      return {
        istantaneaAzzerata: typeof azzeraIstantanea === 'function',
        /* la sincronizzazione automatica non deve partire da sola con i
           dati dell'altro in memoria */
        dirty: sync.dirty,
        uid: sync.fb.uid,
        vociInMemoria: (S.data.items || []).length
      };
    });
    /* i dati di A sono ancora in memoria — è corretto, sono sul dispositivo —
       ma non devono essere stati marcati come «da inviare» per B */
    expect(r.uid).toBe('uid-B');
    expect(r.dirty, 'entrando con un altro account nulla è «da inviare»').toBe(false);
  });
});
