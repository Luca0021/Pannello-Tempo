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

  /* ───────────────────────────────────────────────────────────────────────
     L'ORDINE GIUSTO AVEVA UNA CONSEGUENZA CHE MANCAVA

     Dati-poi-account è corretto. Ma se il passo sui dati FALLISCE e quello
     sull'account riesce lo stesso, si ottiene l'esito peggiore possibile di
     questa schermata: i dati restano nel database e l'account — l'unica
     chiave per raggiungerli — non esiste più. Nessuno, nemmeno chi li ha
     scritti, può più leggerli o cancellarli.
     ─────────────────────────────────────────────────────────────────────── */
  test('se la cancellazione dei dati fallisce, l\'account NON viene eliminato', async ({ page }) => {
    await conSessione(page, { deleteRemoteOk: false });
    const chiamato = await page.evaluate(() => {
      let toccato = false;
      const auth = window.eliminaAccountAuth;
      window.eliminaAccountAuth = () => { toccato = true; return auth(); };
      return new Promise(res => cancellaTutto({ cloud: true, account: true, locali: true },
        (e) => res({ toccato, esito: e })));
    });
    expect(chiamato.toccato,
      'l\'eliminazione dell\'account non deve nemmeno essere tentata').toBe(false);
    expect(chiamato.esito.accountNonToccato, 'e va dichiarato').toBe(true);
    expect(chiamato.esito.passi.account.ok).toBe(false);
    expect(chiamato.esito.passi.account.nota,
      'il motivo deve dire perché, non solo che non è riuscita')
      .toContain('non ci sarebbe più modo di raggiungerli');
    expect(chiamato.esito.completo).toBe(false);
  });

  test('se la verifica non conferma, l\'account NON viene eliminato', async ({ page }) => {
    /* `DELETE` ha risposto 200 ma il documento è ancora leggibile: non
       sappiamo se i dati ci sono. Su un dubbio non si butta la chiave. */
    await conSessione(page, { deleteRemoteOk: true, ancoraLeggibile: true });
    const r = await page.evaluate(() => {
      let toccato = false;
      const auth = window.eliminaAccountAuth;
      window.eliminaAccountAuth = () => { toccato = true; return auth(); };
      return new Promise(res => cancellaTutto({ cloud: true, account: true, locali: true },
        (e) => res({ toccato, esito: e })));
    });
    expect(r.esito.passi.cloud.ok, 'il DELETE era andato').toBe(true);
    expect(r.esito.passi.verifica.ok, 'ma la rilettura no').toBe(false);
    expect(r.toccato, 'e quindi l\'account resta').toBe(false);
    expect(r.esito.accountNonToccato).toBe(true);
  });

  test('i dati locali vengono comunque rimossi quando l\'account resta', async ({ page }) => {
    /* La guardia protegge l'account, non deve bloccare il resto: chi ha
       chiesto di pulire questo dispositivo deve ritrovarlo pulito. */
    await conSessione(page, { deleteRemoteOk: false });
    const e = await esegui(page, { cloud: true, account: true, locali: true });
    expect(e.passi.locali.ok, 'il locale procede').toBe(true);
    const dopo = await page.evaluate(() => localStorage.getItem(KEY));
    expect(dopo, 'la chiave dei dati deve essere rimossa').toBeNull();
  });

  /* ───────────────────────────────────────────────────────────────────────
     «NON C'ERA NIENTE DA FARE» NON È «UNA PARTE NON È RIUSCITA»

     Il ramo senza sessione segnava `cloud` come riuscito, quindi la guardia
     della verifica non scattava e si andava a rileggere un documento che non
     esiste in un account che non c'è: «Non verificabile: nessuna sessione.»,
     cioè un esito PARZIALE su un'operazione che non aveva nulla da compiere.
     ─────────────────────────────────────────────────────────────────────── */
  test('senza sessione la verifica non viene nemmeno tentata', async ({ page }) => {
    await conSessione(page, {});
    const r = await page.evaluate(() => {
      esciAccount(true);                       /* nessuna sessione, dati intatti */
      let letture = 0;
      window.fbLeggiDoc = () => { letture++; return Promise.resolve(''); };
      return new Promise(res => cancellaTutto({ cloud: true, account: false, locali: false },
        (e) => res({ letture, esito: e })));
    });
    expect(r.letture, 'non c\'era niente da rileggere').toBe(0);
    expect(r.esito.passi.cloud.nonApplicabile, 'il passo cloud è non applicabile').toBe(true);
    expect(r.esito.passi.verifica.ok, 'e la verifica non è un fallimento').toBe(true);
    expect(r.esito.passi.verifica.nonApplicabile).toBe(true);
    expect(r.esito.completo, 'niente da fare non è un fallimento').toBe(true);
    expect(r.esito.parziale, 'e non è nemmeno un esito parziale').toBe(false);
    expect(r.esito.nullaDaFare, 'ma va distinto da una cancellazione avvenuta').toBe(true);
  });

  test('senza sessione il messaggio dice che non c\'era niente, non «Fatto»', async ({ page }) => {
    await conSessione(page, {});
    const r = await page.evaluate(() => {
      esciAccount(true);
      return new Promise(res => eseguiDistruttiva('cloud', res));
    });
    expect(r.nota, 'dire «Fatto.» farebbe credere a una cancellazione avvenuta')
      .toBe('Non c\'era niente da eliminare.');
  });

  /* ───────────────────────────────────────────────────────────────────────
     CHE COSA RESTA, AZIONE PER AZIONE, QUANDO IL CLOUD FALLISCE

     Le tre azioni hanno intenzioni diverse e devono comportarsi in modo
     diverso; il caso interessante è il terzo, e la risposta NON è ovvia.

     «Elimina account e dati» con la cancellazione remota fallita conserva
     l'account — altrimenti i dati diventerebbero irraggiungibili — e ripulisce
     comunque il dispositivo. Sembra asimmetrico, ed è invece la scelta giusta,
     misurata: nessun dato va perso (la copia nel servizio resta, e l'account
     che la raggiunge pure), il dispositivo viene davvero pulito — che è la
     metà della richiesta sotto il nostro controllo, e conta per chi sta
     svuotando un telefono — e dopo l'operazione non resta niente che possa
     fare danni da solo: coda vuota, niente da inviare, istantanea azzerata,
     provider tornato «locale». Un rientro futuro RILEGGE, non sovrascrive.

     Queste prove fissano quel contratto, perché è il tipo di comportamento
     che si cambia per distrazione. */
  for (const cloudOk of [true, false]) {
    test(`dati locali e cloud, con la cancellazione remota che ${cloudOk ? 'riesce' : 'fallisce'}`,
      async ({ page }) => {
        const atteso = {
          /* azione            dati locali dopo   copie dopo */
          locali:  { dati: false, copie: 0 },
          cloud:   { dati: true,  copie: 1 },
          account: { dati: false, copie: 0 }
        };
        for (const id of ['locali', 'cloud', 'account']) {
          await conSessione(page, { deleteRemoteOk: cloudOk });
          const r = await page.evaluate((a) => new Promise((res) => eseguiDistruttiva(a, (e) => {
            res({ e, dati: !!localStorage.getItem(KEY),
              copie: (() => { try { return JSON.parse(localStorage.getItem(CHIAVE_BACKUP_AUTO) || '[]').length; }
                              catch (x) { return -1; } })(),
              sessione: !!(sync.fb && sync.fb.idToken) });
          })), id);
          expect(r.dati, `«${id}»: i dati di questo dispositivo`).toBe(atteso[id].dati);
          expect(r.copie, `«${id}»: le copie di sicurezza locali`).toBe(atteso[id].copie);
          expect(r.sessione, `«${id}»: la sessione viene sempre chiusa`).toBe(false);
        }
      });
  }

  test('dopo una cancellazione completa a metà non resta niente che parta da solo', async ({ page }) => {
    /* La domanda che rende accettabile il comportamento sopra: il dataset
       locale svuotato può, al rientro, spingere il vuoto sui dati che erano
       stati conservati proprio perché non si riusciva a cancellarli? */
    await conSessione(page, { deleteRemoteOk: false });
    const s = await page.evaluate(() => new Promise((res) => eseguiDistruttiva('account', () => {
      res({ voci: (S.data.items || []).length,
        coda: (typeof inCoda === 'function') ? inCoda() : -1,
        dirty: sync.dirty, provider: sync.provider,
        pronto: (typeof syncReady === 'function') ? syncReady() : null,
        chiavi: Object.keys(localStorage).filter((k) => k.indexOf('pannello-tempo') === 0) });
    })));
    expect(s.voci, 'il dispositivo è pulito').toBe(0);
    expect(s.coda, 'nessuna modifica in attesa di partire').toBe(0);
    expect(s.dirty, 'niente segnato da inviare').toBe(false);
    expect(s.provider, 'si torna al predefinito, non a un servizio').toBe('locale');
    expect(s.pronto, 'e non si è pronti a sincronizzare').toBe(false);
    expect(s.chiavi, 'resta solo lo stato del provider, senza credenziali')
      .toEqual(['pannello-tempo:sync']);
  });

  /* Il messaggio breve e la scheda d'esito stanno sullo stesso schermo: se si
     contraddicono, quella che resta impressa è la più rassicurante — e in
     questo caso era anche la falsa. */
  test('la scheda d\'esito dice la stessa cosa del messaggio breve', async ({ page }) => {
    await conSessione(page, {});
    const r = await page.evaluate(async () => {
      esciAccount(true);
      const esito = await new Promise((res) => eseguiDistruttiva('cloud', res));
      render();
      await new Promise((res) => setTimeout(res, 300));
      const c = [...document.querySelectorAll('#app .card')]
        .find((x) => /cancellazione|niente da eliminare/i.test((x.querySelector('h2') || {}).textContent || ''));
      return { nota: esito.nota,
        titolo: c ? c.querySelector('h2').textContent.trim() : null,
        testo: c ? c.textContent.replace(/\s+/g, ' ') : '' };
    });
    expect(r.nota).toBe('Non c\'era niente da eliminare.');
    expect(r.titolo, 'il titolo NON deve dichiarare una cancellazione avvenuta')
      .toBe('Non c\'era niente da eliminare');
    expect(r.testo, 'e deve dire che i dati del dispositivo sono intatti')
      .toContain('non sono stati toccati');
  });

  test('quando l\'account è conservato, la scheda lo dice in cima', async ({ page }) => {
    await conSessione(page, { deleteRemoteOk: false });
    const r = await page.evaluate(async () => {
      await new Promise((res) => eseguiDistruttiva('account', res));
      render();
      await new Promise((res) => setTimeout(res, 300));
      const c = [...document.querySelectorAll('#app .card')]
        .find((x) => /cancellazione/i.test((x.querySelector('h2') || {}).textContent || ''));
      return { titolo: c ? c.querySelector('h2').textContent.trim() : null,
        testo: c ? c.textContent.replace(/\s+/g, ' ') : '' };
    });
    expect(r.titolo).toBe('Cancellazione parziale');
    expect(r.testo, 'la decisione va letta senza cercarla nei passi')
      .toContain('L\'account è stato conservato di proposito');
  });

  test('con una sessione vera, la stessa azione dice «Fatto.»', async ({ page }) => {
    /* la controprova della prova sopra: il messaggio nuovo non deve mangiarsi
       il caso normale */
    await conSessione(page, {});
    const r = await page.evaluate(() =>
      new Promise(res => eseguiDistruttiva('cloud', res)));
    expect(r.nota).toBe('Fatto.');
    expect(r.esito.nullaDaFare).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   LE CONFERME SI DEVONO VEDERE

   Misurato prima della correzione: le schede di conferma vengono disegnate in
   cima alla pagina, nella zona «priorità», mentre i comandi che le aprono
   stanno in fondo alle impostazioni, dopo otto sezioni. Premendo un'azione
   distruttiva il dialogo nasceva a 10709 pixel SOPRA il bordo della vista a
   320x568, a 9637 a 393x852 e a 6087 a 1280x900, con il fuoco su BODY.

   All'utente non succedeva niente di visibile. E una conferma armata e
   invisibile resta armata: scorrendo in cima più tardi la si ritrova lì.

   Sono le sette azioni più pericolose del pannello, tre delle quali chiedono
   di scrivere CANCELLA e non si annullano. Vanno viste.
   ───────────────────────────────────────────────────────────────────────── */
test.describe('PRV-002 · le conferme distruttive si vedono', () => {
  async function conImpostazioniAperte(page, w, h) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof render === 'function' && !!window.S);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof render === 'function' && !!window.S);
    await page.evaluate(() => {
      S.now = new Date(2026, 8, 12, 10, 0, 0);
      saltaOnboarding();
      if (!P.fold) P.fold = {};
      P.fold.settings = false; savePrefs(); render();
    });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.innerWidth),
      `la vista deve essere larga ${w}px`).toBe(w);
  }

  /* misura dopo aver premuto: dove nasce il dialogo, dov'è il fuoco */
  async function premiEMisura(page, selettore) {
    await page.evaluate((s) => {
      const b = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null);
      if (b) b.scrollIntoView({ block: 'center' });
    }, selettore);
    await page.waitForTimeout(250);
    await page.click(selettore + ':visible');
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const d = document.querySelector('#app [role="alertdialog"]');
      if (!d) return { assente: true };
      const r = d.getBoundingClientRect();
      const sp = d.querySelector('h2 > span');
      const h2 = sp ? sp.closest('h2') : null;
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), vista: window.innerHeight,
        dentro: r.top >= -1 && r.top < window.innerHeight,
        fuocoNelDialogo: d.contains(document.activeElement) || document.activeElement === d,
        fuoco: document.activeElement ? (document.activeElement.getAttribute('role') ||
          document.activeElement.tagName) : null,
        titolo: sp ? (sp.textContent || '').trim() : null,
        titoloSporge: (sp && h2)
          ? Math.round((sp.getBoundingClientRect().right - h2.getBoundingClientRect().right) * 100) / 100
          : null,
        annulla: !!d.querySelector('[data-act="conferma-annulla"]'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
  }

  for (const [w, h, et] of [[320, 568, '320'], [393, 852, '393'], [1280, 900, '1280']]) {
    test(`a ${et}px ogni azione distruttiva mostra la propria conferma`, async ({ page }) => {
      await conImpostazioniAperte(page, w, h);
      const azioni = await page.evaluate(() => AZIONI_DISTRUTTIVE.map((a) => a.id));
      /* SETTE, non sei: contate. Tre sono da `conferma: 3` e chiedono di
         scrivere CANCELLA, e sono quelle che non si annullano. */
      expect(azioni, 'le sette azioni dichiarate').toEqual(
        ['aspetto', 'impostazioni', 'attivita', 'disconnetti', 'locali', 'cloud', 'account']);

      for (const id of azioni) {
        const m = await premiEMisura(page, `#app [data-act="distr"][data-v="${id}"]`);
        expect(m.assente, `«${id}»: la conferma deve comparire`).toBeUndefined();
        /* IL DIFETTO: il dialogo nasceva migliaia di pixel sopra la vista */
        expect(m.top, `«${id}»: la conferma comincia dentro la vista`).toBeGreaterThanOrEqual(-1);
        expect(m.top, `«${id}»: e non sotto il bordo inferiore`).toBeLessThan(m.vista);
        /* un alertdialog che non riceve il fuoco viene annunciato a metà */
        expect(m.fuocoNelDialogo,
          `«${id}»: il fuoco entra nel dialogo (è su ${m.fuoco})`).toBe(true);
        expect(m.annulla, `«${id}»: si può sempre annullare`).toBe(true);
        /* il titolo dentro il proprio contenitore, alle larghezze strette */
        expect(m.titoloSporge,
          `«${id}»: il titolo «${m.titolo}» sta nel suo h2`).toBeLessThanOrEqual(1);
        expect(m.overflow, `«${id}»: nessuno scorrimento orizzontale`).toBeLessThanOrEqual(1);
        await page.click('#app [data-act="conferma-annulla"]');
        await page.waitForTimeout(250);
      }
    });
  }

  test('un ridisegno qualsiasi non toglie il fuoco alla conferma aperta', async ({ page }) => {
    /* COME È STATO TROVATO, e perché è un difetto del prodotto e non della
       prova: il fuoco viene conservato attraverso un ridisegno solo per gli
       elementi che portano `data-act` o `data-keep`. La scheda di conferma è
       un `div[role="alertdialog"][tabindex="-1"]` e non ha né l'uno né
       l'altro, quindi `render()` le toglieva il fuoco prima dello scambio
       delle zone e nessuno glielo restituiva.

       Non serviva niente di esotico per inciamparci: il toast di un'azione
       precedente scade dopo 3,7 secondi e chiama `render()`. Aprendo tre
       conferme di fila, la terza perdeva il fuoco — sempre, a ogni
       larghezza. Per chi naviga da tastiera il dialogo spariva da sotto le
       dita mentre era ancora sullo schermo. */
    await conImpostazioniAperte(page, 393, 852);
    await premiEMisura(page, '#app [data-act="distr"][data-v="locali"]');
    const prima = await page.evaluate(() => {
      const d = document.querySelector('#app [role="alertdialog"]');
      return d.contains(document.activeElement) || document.activeElement === d;
    });
    expect(prima, 'il fuoco entra nel dialogo').toBe(true);
    /* un ridisegno qualunque, provocato come lo provoca il pannello */
    const dopo = await page.evaluate(async () => {
      render();
      await new Promise((r) => setTimeout(r, 250));
      const d = document.querySelector('#app [role="alertdialog"]');
      return { presente: !!d,
        dentro: d ? (d.contains(document.activeElement) || document.activeElement === d) : null,
        fuoco: document.activeElement ? document.activeElement.tagName : null };
    });
    expect(dopo.presente, 'la conferma resta aperta').toBe(true);
    expect(dopo.dentro, `il fuoco resta nel dialogo (è su ${dopo.fuoco})`).toBe(true);
  });

  test('un ridisegno che chiude la conferma non riporta il fuoco', async ({ page }) => {
    /* la controprova del ripristino: non deve rimettere il fuoco su un
       dialogo che non c'è più, o su un altro che comparisse dopo */
    await conImpostazioniAperte(page, 393, 852);
    await premiEMisura(page, '#app [data-act="distr"][data-v="locali"]');
    const dopo = await page.evaluate(async () => {
      S.conferma = null; render();
      await new Promise((r) => setTimeout(r, 250));
      return { dialogo: !!document.querySelector('#app [role="alertdialog"]'),
               fuoco: document.activeElement ? document.activeElement.tagName : null };
    });
    expect(dopo.dialogo, 'la conferma è chiusa').toBe(false);
    expect(dopo.fuoco, 'e il fuoco non viene messo altrove a forza').toBe('BODY');
  });

  test('annullare chiude la conferma senza eseguire niente', async ({ page }) => {
    await conImpostazioniAperte(page, 393, 852);
    const prima = await page.evaluate(() => ({
      voci: (S.data.items || []).length, tema: P.theme, modo: pref('modo') }));
    await premiEMisura(page, '#app [data-act="distr"][data-v="aspetto"]');
    await page.click('#app [data-act="conferma-annulla"]');
    await page.waitForTimeout(300);
    const dopo = await page.evaluate(() => ({
      dialogo: !!document.querySelector('#app [role="alertdialog"]'),
      voci: (S.data.items || []).length, tema: P.theme, modo: pref('modo') }));
    expect(dopo.dialogo, 'la conferma si chiude').toBe(false);
    expect(dopo.voci).toBe(prima.voci);
    expect(dopo.tema).toBe(prima.tema);
    expect(dopo.modo).toBe(prima.modo);
  });

  test('le due cancellazioni diffuse si vedono allo stesso modo', async ({ page }) => {
    /* «Cancella la cronologia» e «Cancella tutto» non passano da
       AZIONI_DISTRUTTIVE: hanno un ramo proprio, e prima della correzione
       avevano lo stesso difetto. */
    await conImpostazioniAperte(page, 393, 852);
    for (const act of ['del-cronologia', 'del-tutto']) {
      const m = await page.evaluate(async (a) => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((r) => setTimeout(r, 200));
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const finto = document.createElement('button');
        finto.setAttribute('data-act', a);
        document.getElementById('app').appendChild(finto);
        finto.click();
        finto.remove();
        await new Promise((r) => setTimeout(r, 450));
        const d = document.querySelector('#app [role="alertdialog"]');
        const r2 = d ? d.getBoundingClientRect() : null;
        return { presente: !!d, top: r2 ? Math.round(r2.top) : null,
          vista: window.innerHeight,
          fuocoNelDialogo: d ? (d.contains(document.activeElement) || document.activeElement === d) : null };
      }, act);
      expect(m.presente, `«${act}»: la conferma deve comparire`).toBe(true);
      expect(m.top, `«${act}»: dentro la vista`).toBeGreaterThanOrEqual(-1);
      expect(m.top, `«${act}»: e non sotto il bordo`).toBeLessThan(m.vista);
      expect(m.fuocoNelDialogo, `«${act}»: il fuoco entra nel dialogo`).toBe(true);
      await page.click('#app [data-act="conferma-annulla"]');
      await page.waitForTimeout(250);
    }
  });
});
