/* tests/e2e/cancellazione.spec.js — PRV-002.
 *
 * Il flusso di cancellazione, con le chiamate di rete sostituite: nessun
 * account vero, nessun dato reale, nessuna cancellazione su un servizio.
 *
 * La parte lato regole — il proprietario può cancellare, un altro utente no
 * — è coperta da tests/security/regole.test.js, prove 4 e 8, sull'emulatore.
 * Qui si verifica il comportamento dell'applicazione: l'ordine dei passi,
 * l'esito separato per ognuno, e soprattutto che NON dichiari successo
 * quando qualcosa è andato storto.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node.
 * Comando in RUN-CI.md.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

/* Prepara: sessione finta, configurazione finta, endpoint dell'emulatore.
   Nessuna chiamata esce da qui. */
async function conSessione(page, opzioni) {
  const o = Object.assign({ deleteRemoteOk: true, ancoraLeggibile: false,
                            authDelete: 'ok' }, opzioni || {});
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof cancellaTutto === 'function');
  await page.evaluate((o) => {
    localStorage.clear();
    setImp('onboardingFatto', true);
    S.onboarding = null;
    S.data.items = [{ id: 'voce-1', label: 'una voce', area: 'lavoro', freq: 'once' }];
    save();
    salvaBackupAutomatico('preparazione del collaudo');

    /* configurazione finta, ambiente emulatore: `vietaProduzioneNeiTest`
       lascia passare solo così */
    FIREBASE_CONFIG.ambiente = 'emulatore';
    FIREBASE_CONFIG.apiKey = 'AIza' + 'F'.repeat(35);
    FIREBASE_CONFIG.projectId = 'demo-pannello';
    applicaSessione({ localId: 'uid-prova', idToken: 'TOK', expiresIn: '3600' },
                    'prova@esempio.invalid');

    /* sostituisco i punti di rete, non `fetch`: così resta chiaro che cosa
       sto simulando */
    PROVIDER.firebase.deleteRemote = () => Promise.resolve(
      o.deleteRemoteOk ? { ok: true } : { ok: false, motivo: 'il servizio ha rifiutato' });
    window.fbLeggiDoc = () => Promise.resolve(o.ancoraLeggibile ? '{"c":1}' : '');
    window.eliminaAccountAuth = () => Promise.resolve(
      o.authDelete === 'ok' ? { ok: true }
      : o.authDelete === 'riautenticare'
        ? { ok: false, riautenticare: true,
            motivo: "Per eliminare l'account serve la password: è un'operazione irreversibile e non deve poterla fare chi trova il dispositivo aperto." }
        : { ok: false, riautenticare: false, motivo: 'il servizio ha rifiutato' });
  }, o);
}

function esegui(page, opzioni) {
  return page.evaluate((op) => new Promise(res => cancellaTutto(op, res)), opzioni);
}

test.describe('PRV-002 · cancellazione', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('sette passi dichiarati', async ({ page }) => {
    await conSessione(page, {});
    const passi = await page.evaluate(() => PASSI_CANCELLAZIONE().map(p => p.id));
    expect(passi).toEqual(['cloud', 'verifica', 'account', 'coda', 'credenziali', 'locali', 'backup']);
  });

  test('tre azioni distinte, con opzioni distinte', async ({ page }) => {
    await conSessione(page, {});
    const a = await page.evaluate(() =>
      AZIONI_DISTRUTTIVE.filter(x => x.opzioni).map(x => ({ id: x.id, o: x.opzioni })));
    expect(a.map(x => x.id)).toEqual(['locali', 'cloud', 'account']);
    expect(a.find(x => x.id === 'cloud').o).toEqual({ cloud: true, account: false, locali: false });
    expect(a.find(x => x.id === 'locali').o).toEqual({ cloud: false, account: false, locali: true });
  });

  test('solo dati locali: il cloud non viene toccato', async ({ page }) => {
    await conSessione(page, {});
    const e = await esegui(page, { cloud: false, account: false, locali: true });
    expect(e.completo).toBe(true);
    expect(e.passi.cloud.nota).toContain('non richiesto');
    const dopo = await page.evaluate(() => localStorage.getItem(KEY));
    expect(dopo, 'la chiave dei dati deve essere rimossa').toBeNull();
  });

  test('solo cloud: i dati locali restano', async ({ page }) => {
    await conSessione(page, {});
    const e = await esegui(page, { cloud: true, account: false, locali: false });
    expect(e.completo).toBe(true);
    expect(e.passi.locali.nota).toContain('conservati su tua richiesta');
    const voci = await page.evaluate(() => (S.data.items || []).length);
    expect(voci, 'i dati del dispositivo non devono sparire').toBeGreaterThan(0);
  });

  test('il cloud fallisce: esito parziale, e il locale procede', async ({ page }) => {
    await conSessione(page, { deleteRemoteOk: false });
    const e = await esegui(page, { cloud: true, account: false, locali: true });
    expect(e.passi.cloud.ok, 'il fallimento remoto resta segnato').toBe(false);
    expect(e.passi.cloud.nota).toContain('rifiutato');
    expect(e.passi.locali.ok, 'il locale procede comunque').toBe(true);
    expect(e.completo, 'NON deve dichiararsi completo').toBe(false);
    expect(e.parziale).toBe(true);
  });

  test('il documento è ancora leggibile: nessuna falsa conferma', async ({ page }) => {
    /* Il caso più insidioso: DELETE risponde 200 e il documento c'è ancora.
       Senza il passo di verifica, l'applicazione direbbe «cancellato». */
    await conSessione(page, { deleteRemoteOk: true, ancoraLeggibile: true });
    const e = await esegui(page, { cloud: true, account: false, locali: false });
    expect(e.passi.cloud.ok).toBe(true);
    expect(e.passi.verifica.ok, 'la verifica deve accorgersene').toBe(false);
    expect(e.passi.verifica.nota).toContain('ancora leggibile');
    expect(e.completo, 'NON deve dichiararsi completo').toBe(false);
  });

  test('eliminazione dell\'account: riuscita', async ({ page }) => {
    await conSessione(page, { authDelete: 'ok' });
    const e = await esegui(page, { cloud: true, account: true, locali: true });
    expect(e.passi.account.ok).toBe(true);
    expect(e.completo).toBe(true);
    expect(e.riautenticare).toBeFalsy();
  });

  test('eliminazione dell\'account: serve la password, e lo dice', async ({ page }) => {
    await conSessione(page, { authDelete: 'riautenticare' });
    const e = await esegui(page, { cloud: true, account: true, locali: true });
    expect(e.passi.account.ok, 'non deve fingere di avercela fatta').toBe(false);
    expect(e.riautenticare, 'deve chiedere la riautenticazione').toBe(true);
    expect(e.passi.account.nota).toContain('password');
    expect(e.completo).toBe(false);
  });

  test('dopo la cancellazione non resta nulla per rientrare', async ({ page }) => {
    await conSessione(page, {});
    await esegui(page, { cloud: true, account: true, locali: true });
    const r = await page.evaluate(async () => {
      const a = await auditSegreti();
      return { sentinelle: a.trovati, provider: sync.provider, pronto: syncReady(),
               idToken: sync.fb.idToken, coda: (typeof inCoda === 'function') ? inCoda() : -1,
               conflitti: S.conflitti };
    });
    expect(r.sentinelle).toEqual([]);
    expect(r.provider).toBe('locale');
    expect(r.pronto).toBe(false);
    expect(r.idToken).toBe('');
    expect(r.coda, 'la coda deve essere vuota: altrimenti una riconnessione futura reinvierebbe').toBe(0);
    expect(r.conflitti).toBeNull();
  });

  test('l\'ordine è dati-poi-account', async ({ page }) => {
    /* Se l'account venisse eliminato prima dei dati, si perderebbe il token
       con cui cancellarli e resterebbero orfani nel database. */
    await conSessione(page, {});
    const ordine = await page.evaluate(() => {
      const visti = [];
      const del = PROVIDER.firebase.deleteRemote;
      const auth = window.eliminaAccountAuth;
      PROVIDER.firebase.deleteRemote = () => { visti.push('dati'); return del(); };
      window.eliminaAccountAuth = () => { visti.push('account'); return auth(); };
      return new Promise(res => cancellaTutto({ cloud: true, account: true, locali: true },
        () => res(visti)));
    });
    expect(ordine).toEqual(['dati', 'account']);
  });
});
