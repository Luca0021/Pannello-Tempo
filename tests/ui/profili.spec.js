/* tests/ui/profili.spec.js — profili, modalità e personalizzazione, in un browser.
 *
 * Le prove unitarie in tests/unit/profili.test.js coprono la logica. Queste
 * coprono le tre cose che la logica non sa: che un comando esista nella
 * pagina, che una conferma compaia prima di agire, e che un'informazione sia
 * davvero leggibile invece di essere soltanto calcolata.
 *
 * Ognuna nasce da un difetto misurato, non da un'ipotesi:
 *
 *   1. LA MODALITÀ NON AVEVA UN COMANDO. `data-act="modo"` esisteva in
 *      js/events.js e nessuna schermata lo disegnava: l'unico modo di
 *      cambiare modalità era scegliere un profilo, perché `applicaProfilo`
 *      la impostava di nascosto. Togliere quella conseguenza senza aggiungere
 *      il comando avrebbe reso la modalità irraggiungibile — che è un difetto
 *      peggiore di quello di partenza.
 *   2. IL PROFILO CAMBIAVA LA MODALITÀ. Misurato: con modalità avanzata,
 *      premere «Pianificatore» riportava a semplice senza dirlo, e
 *      l'anteprima del profilo — che elenca parti accese, spente e scelte
 *      dimenticate — non la nominava.
 *   3. IL RIPRISTINO DEL PRESET SI ESEGUIVA SUBITO. L'utente leggeva un
 *      conteggio prima e un toast dopo; quali parti stessero tornando
 *      indietro non lo sapeva in nessuno dei due momenti.
 *   4. LA PROVENIENZA DI UNA PARTE NON SI VEDEVA. «attiva»/«spenta» non
 *      distingue una scelta dell'utente da un preset del profilo.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';

/* Utente nuovo: nessuna preferenza, ora fissa. Il ricarico serve perché
   l'ingresso guidato viene deciso all'avvio. */
async function nuovo(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate(() => { S.now = new Date(2026, 8, 11, 9, 12, 0); render(); });
  await page.waitForTimeout(250);
}

/* Utente già configurato, con un profilo e una modalità sue. Si passa per
   `saltaOnboarding()` perché è la via che NON applica la modalità. */
async function configurato(page, profilo, modo) {
  await nuovo(page);
  await page.evaluate(() => { saltaOnboarding(); });
  await page.waitForTimeout(200);
  await page.evaluate(([p, m]) => {
    applicaProfilo(p);
    setImp('modo', m);
    render();
  }, [profilo, modo]);
  await page.waitForTimeout(250);
}

/* Preme il comando visibile: la navigazione primaria è disegnata due volte e
   a ogni larghezza una delle due è nascosta (NAV-001). */
async function premi(page, sel) {
  const t = page.locator(sel);
  const n = await t.count();
  for (let i = 0; i < n; i++) {
    if (await t.nth(i).isVisible()) { await t.nth(i).click(); await page.waitForTimeout(300); return true; }
  }
  return false;
}

/* Le impostazioni non sono una vista a parte: sono una scheda richiudibile
   della home. Si apre col suo comando vero, non scrivendo nello stato. */
async function apriImpostazioni(page) {
  if (await page.evaluate(() => folded('settings'))) {
    const ok = await premi(page, '#app .setcard [data-act="fold"][data-v="settings"]');
    expect(ok, 'il comando per aprire le impostazioni deve esistere').toBe(true);
  }
  await page.waitForTimeout(400);
  const visibile = await page.evaluate(() =>
    !!document.querySelector('#app [data-act="profilo"]'));
  expect(visibile, 'aperte le impostazioni, la scheda dei profili deve esserci').toBe(true);
}

/* ─────────────────────────────────────────────────────────────────────────
   1 — LA MODALITÀ HA UN COMANDO, E IL PROFILO NON LA TOCCA
   ───────────────────────────────────────────────────────────────────────── */
test.describe('profili · profilo e modalità sono due scelte', () => {

  test('la modalità ha un comando visibile nelle impostazioni', async ({ page }) => {
    await configurato(page, 'pianificatore', 'semplice');
    await apriImpostazioni(page);
    const m = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#app [data-act="modo"]')]
        .filter(x => x.offsetParent !== null || x.getBoundingClientRect().width > 0);
      return {
        quanti: b.length,
        valori: b.map(x => x.getAttribute('data-v')),
        premuti: b.map(x => x.getAttribute('aria-pressed')),
        gruppo: b.length ? !!b[0].closest('[role="group"]') : false,
        nome: b.length ? (b[0].closest('[role="group"]') || {}).getAttribute
          ? document.getElementById(b[0].closest('[role="group"]').getAttribute('aria-labelledby'))
            ? document.getElementById(b[0].closest('[role="group"]').getAttribute('aria-labelledby')).textContent.trim()
            : null
          : null : null
      };
    });
    /* 1 — il comando c'è: era il difetto, e senza di lui la modalità sarebbe
       diventata irraggiungibile togliendo l'accoppiamento col profilo */
    expect(m.quanti, '1 — due comandi per la modalità, semplice e avanzata').toBe(2);
    expect(m.valori.sort(), '2 — i due valori previsti').toEqual(['avanzata', 'semplice']);
    /* 3 — lo stato è annunciato, non solo colorato */
    expect(m.premuti.filter(x => x === 'true').length, '3 — uno e uno solo è premuto').toBe(1);
    expect(m.gruppo, '4 — i due comandi stanno in un gruppo con un nome').toBe(true);
    expect(m.nome, '5 — e il nome del gruppo è leggibile').toBeTruthy();
  });

  test('il comando cambia la modalità, e solo quella', async ({ page }) => {
    await configurato(page, 'pianificatore', 'semplice');
    await apriImpostazioni(page);
    const prima = await page.evaluate(() => ({
      modo: pref('modo'), profilo: pref('profilo'), moduli: moduliAttivi()
    }));
    await page.click('#app [data-act="modo"][data-v="avanzata"]');
    await page.waitForTimeout(400);
    const dopo = await page.evaluate(() => ({
      modo: pref('modo'), profilo: pref('profilo'), moduli: moduliAttivi(),
      premuto: document.querySelector('#app [data-act="modo"][data-v="avanzata"]')
        .getAttribute('aria-pressed')
    }));
    expect(prima.modo, '6 — si parte da semplice').toBe('semplice');
    expect(dopo.modo, '7 — il comando cambia la modalità').toBe('avanzata');
    expect(dopo.premuto, '8 — e lo stato premuto la segue').toBe('true');
    expect(dopo.profilo, '9 — il profilo non si muove').toBe(prima.profilo);
    /* 10 — in modalità avanzata i moduli marcati «avanzato» si accendono solo
       se NON c'è un profilo: con un profilo attivo l'insieme non cambia */
    expect(dopo.moduli, '10 — e nemmeno le parti attive').toEqual(prima.moduli);
  });

  for (const [profilo, atteso] of [['essenziale', 'avanzata'], ['pianificatore', 'avanzata'],
                                   ['completo', 'avanzata']]) {
    test(`scegliere «${profilo}» non tocca la modalità già scelta`, async ({ page }) => {
      await configurato(page, 'pianificatore', 'avanzata');
      await apriImpostazioni(page);
      await page.click(`#app [data-act="profilo"][data-v="${profilo}"]`);
      await page.waitForTimeout(500);
      const s = await page.evaluate(() => ({ modo: pref('modo'), profilo: pref('profilo') }));
      expect(s.profilo, '11 — il profilo cambia').toBe(profilo);
      expect(s.modo, '12 — la modalità no').toBe(atteso);
    });
  }

  test('anche partendo da semplice, nessun profilo la porta ad avanzata', async ({ page }) => {
    await configurato(page, 'essenziale', 'semplice');
    await apriImpostazioni(page);
    for (const p of ['completo', 'pianificatore', 'essenziale']) {
      await page.click(`#app [data-act="profilo"][data-v="${p}"]`);
      await page.waitForTimeout(400);
      const modo = await page.evaluate(() => pref('modo'));
      expect(modo, `13 — dopo «${p}» la modalità resta semplice`).toBe('semplice');
    }
  });

  test('le impostazioni dichiarano che il profilo non cambia la modalità', async ({ page }) => {
    await configurato(page, 'pianificatore', 'semplice');
    await apriImpostazioni(page);
    const t = await page.evaluate(() => {
      const c = [...document.querySelectorAll('#app .card')]
        .find(x => /come vuoi usare il pannello/i.test((x.querySelector('h2') || {}).textContent || ''));
      return c ? c.textContent.replace(/\s+/g, ' ') : null;
    });
    expect(t, '14 — la scheda «Come vuoi usare il pannello» deve esistere').toBeTruthy();
    expect(t, '15 — e dire che cambiare profilo non modifica la modalità')
      .toMatch(/cambiare profilo non la modifica/i);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   2 — L'INGRESSO GUIDATO PROPONE LA MODALITÀ, E LA MOSTRA
   ───────────────────────────────────────────────────────────────────────── */
test.describe('profili · l\'ingresso guidato', () => {

  test('al passo del profilo la modalità è scritta e cambiabile', async ({ page }) => {
    await nuovo(page);
    await page.evaluate(() => { apriOnboarding(2); });
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-act="onb-modo"]')];
      const testo = document.body.textContent.replace(/\s+/g, ' ');
      return {
        comandi: b.length, valori: b.map(x => x.getAttribute('data-v')),
        premuti: b.map(x => x.getAttribute('aria-pressed')),
        dice: /Comincerai in modalità/i.test(testo),
        diceQuale: (testo.match(/Comincerai in modalità (semplice|avanzata)/i) || [])[1],
        diceCambiabile: /cambi quando vuoi dalle impostazioni/i.test(testo),
        stato: S.onboarding.modo
      };
    });
    expect(s.comandi, '16 — due comandi per la modalità nel passo del profilo').toBe(2);
    expect(s.valori.sort(), '17 — i due valori previsti').toEqual(['avanzata', 'semplice']);
    expect(s.premuti.filter(x => x === 'true').length, '18 — uno solo premuto').toBe(1);
    expect(s.dice, '19 — la modalità che verrà usata è scritta').toBe(true);
    expect(String(s.diceQuale).toLowerCase(), '20 — e coincide con lo stato')
      .toBe(String(s.stato).toLowerCase());
    expect(s.diceCambiabile, '21 — e si dice che si può cambiare dopo').toBe(true);
  });

  test('la proposta segue il profilo finché non la scelgo io', async ({ page }) => {
    await nuovo(page);
    await page.evaluate(() => { apriOnboarding(2); });
    await page.waitForTimeout(400);
    /* Pianificatore è il predefinito: proposta «semplice» */
    let s = await page.evaluate(() => ({ p: S.onboarding.profilo, m: S.onboarding.modo }));
    expect(s.m, '22 — proposta iniziale coerente col profilo predefinito').toBe('semplice');
    await page.click('[data-act="onb-profilo"][data-v="completo"]');
    await page.waitForTimeout(300);
    s = await page.evaluate(() => ({ p: S.onboarding.profilo, m: S.onboarding.modo }));
    expect(s.m, '23 — «Completo» propone avanzata').toBe('avanzata');
    /* da qui in poi decide l'utente: la proposta non deve più muoversi */
    await page.click('[data-act="onb-modo"][data-v="semplice"]');
    await page.waitForTimeout(300);
    await page.click('[data-act="onb-profilo"][data-v="completo"]');
    await page.waitForTimeout(300);
    s = await page.evaluate(() => ({ m: S.onboarding.modo, scelto: S.onboarding.modoScelto }));
    expect(s.scelto, '24 — la scelta è registrata come esplicita').toBe(true);
    expect(s.m, '25 — e cambiare profilo non la sovrascrive più').toBe('semplice');
  });

  test('la modalità scelta nell\'ingresso viene applicata davvero', async ({ page }) => {
    await nuovo(page);
    await page.evaluate(() => { apriOnboarding(2); });
    await page.waitForTimeout(400);
    await page.click('[data-act="onb-profilo"][data-v="essenziale"]');
    await page.waitForTimeout(250);
    await page.click('[data-act="onb-modo"][data-v="avanzata"]');
    await page.waitForTimeout(250);
    await page.evaluate(() => { applicaScelteOnboarding(); chiudiOnboarding(); });
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => ({ modo: pref('modo'), profilo: pref('profilo') }));
    /* 26 — la combinazione che il vecchio codice non poteva produrre:
       profilo minimo e modalità avanzata */
    expect(s.profilo, '26 — il profilo scelto').toBe('essenziale');
    expect(s.modo, '27 — con la modalità scelta, non quella dedotta dal profilo').toBe('avanzata');
  });

  test('rivedere la presentazione non cambia la modalità di chi è già configurato', async ({ page }) => {
    await configurato(page, 'essenziale', 'avanzata');
    await page.evaluate(() => { apriOnboarding(2); });
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => ({ m: S.onboarding.modo, scelto: S.onboarding.modoScelto }));
    expect(s.m, '28 — riprende la modalità dell\'utente').toBe('avanzata');
    expect(s.scelto, '29 — e la considera già scelta, così il profilo non la muove').toBe(true);
    await page.click('[data-act="onb-profilo"][data-v="completo"]');
    await page.waitForTimeout(300);
    const dopo = await page.evaluate(() => S.onboarding.modo);
    expect(dopo, '30 — cambiare profilo qui non la riporta indietro').toBe('avanzata');
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   3 — IL RIPRISTINO DEL PRESET CHIEDE, E SPIEGA PRIMA
   ───────────────────────────────────────────────────────────────────────── */
test.describe('profili · tornare al preset', () => {

  /* Stato di partenza: profilo Essenziale più due scelte a mano opposte, così
     la conferma deve elencare una parte per verso. */
  async function conDueScelte(page) {
    await configurato(page, 'essenziale', 'semplice');
    await page.evaluate(() => {
      attivaModulo('importi', true);      /* Essenziale non la prevede: tornerà spenta */
      attivaModulo('note', false);        /* Essenziale la prevede: tornerà attiva */
      render();
    });
    await page.waitForTimeout(300);
    await apriImpostazioni(page);
  }

  test('il comando non agisce subito: apre una conferma che nomina le parti', async ({ page }) => {
    await conDueScelte(page);
    const prima = await page.evaluate(() => ({ moduli: moduliAttivi(), scelte: sceltePersonali() }));
    await page.click('#app [data-act="preset-ripristina"]');
    await page.waitForTimeout(400);
    const c = await page.evaluate(() => {
      const d = document.querySelector('#app [role="alertdialog"]');
      if (!d) return { assente: true };
      return {
        testo: d.textContent.replace(/\s+/g, ' '),
        titolo: (d.querySelector('h2') || {}).textContent || '',
        etichettato: !!d.getAttribute('aria-labelledby') &&
                     !!document.getElementById(d.getAttribute('aria-labelledby')),
        conferma: !!d.querySelector('[data-act="preset-ok"]'),
        annulla: !!d.querySelector('[data-act="conferma-annulla"]'),
        moduli: moduliAttivi(), scelte: sceltePersonali()
      };
    });
    expect(c.assente, '31 — deve comparire una conferma').toBeUndefined();
    /* 32 — e niente deve essere ancora cambiato */
    expect(c.moduli, '32 — il ripristino non è ancora avvenuto').toEqual(prima.moduli);
    expect(c.scelte, '33 — le scelte sono ancora tutte lì').toBe(prima.scelte);
    expect(c.titolo, '34 — il titolo nomina il profilo').toMatch(/Essenziale/);
    expect(c.etichettato, '35 — il dialogo ha un nome accessibile').toBe(true);
    /* 36/37 — i NOMI delle parti, non un conteggio */
    expect(c.testo, '36 — dice quale parte torna attiva').toMatch(/Tornano attive:.*Posta in arrivo/);
    expect(c.testo, '37 — e quale torna spenta').toMatch(/Tornano spente:.*Importi/);
    expect(c.testo, '38 — promette che i dati restano').toMatch(/i dati restano dove sono/i);
    expect(c.testo, '39 — e che la modalità non viene toccata').toMatch(/modalità compresa/i);
    expect(c.testo, '40 — e che si potrà annullare').toMatch(/annullare/i);
    expect(c.conferma && c.annulla, '41 — due vie: confermare e annullare').toBe(true);
  });

  test('annullare la conferma non cambia niente', async ({ page }) => {
    await conDueScelte(page);
    const prima = await page.evaluate(() => ({ moduli: moduliAttivi(), scelte: sceltePersonali() }));
    await page.click('#app [data-act="preset-ripristina"]');
    await page.waitForTimeout(300);
    await page.click('#app [data-act="conferma-annulla"]');
    await page.waitForTimeout(400);
    const dopo = await page.evaluate(() => ({
      moduli: moduliAttivi(), scelte: sceltePersonali(),
      dialogo: !!document.querySelector('#app [role="alertdialog"]')
    }));
    expect(dopo.dialogo, '42 — la conferma si chiude').toBe(false);
    expect(dopo.moduli, '43 — le parti attive sono quelle di prima').toEqual(prima.moduli);
    expect(dopo.scelte, '44 — e le scelte a mano sono ancora lì').toBe(prima.scelte);
  });

  test('confermare riporta al preset, senza toccare dati né modalità', async ({ page }) => {
    await conDueScelte(page);
    const prima = await page.evaluate(() => ({
      voci: S.data.items.length, note: S.data.capture.length, modo: pref('modo')
    }));
    await page.click('#app [data-act="preset-ripristina"]');
    await page.waitForTimeout(300);
    await page.click('#app [data-act="preset-ok"]');
    await page.waitForTimeout(500);
    const dopo = await page.evaluate(() => ({
      moduli: moduliAttivi(), scelte: sceltePersonali(),
      voci: S.data.items.length, note: S.data.capture.length, modo: pref('modo'),
      profilo: pref('profilo'), annullabile: !!S.undo
    }));
    expect(dopo.scelte, '45 — nessuna scelta a mano resta').toBe(0);
    expect(dopo.moduli.includes('note'), '46 — «Posta in arrivo» torna attiva').toBe(true);
    expect(dopo.moduli.includes('importi'), '47 — «Importi» torna spenta').toBe(false);
    expect(dopo.voci, '48 — nessuna attività perduta').toBe(prima.voci);
    expect(dopo.note, '49 — nessuna nota perduta').toBe(prima.note);
    expect(dopo.modo, '50 — la modalità non è stata toccata').toBe(prima.modo);
    expect(dopo.profilo, '51 — il profilo è ancora quello').toBe('essenziale');
    expect(dopo.annullabile, '52 — e l\'annullamento è disponibile').toBe(true);
  });

  test('senza scelte a mano il comando non compare', async ({ page }) => {
    await configurato(page, 'pianificatore', 'semplice');
    await apriImpostazioni(page);
    const n = await page.evaluate(() =>
      document.querySelectorAll('#app [data-act="preset-ripristina"]').length);
    expect(n, '53 — niente da ripristinare, nessun comando che non farebbe nulla').toBe(0);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   4 — LA PROVENIENZA DI OGNI PARTE, E IL BENEFICIO DI OGNI PROFILO
   ───────────────────────────────────────────────────────────────────────── */
test.describe('profili · che cosa si legge', () => {

  test('ogni parte dichiara da dove viene il suo stato', async ({ page }) => {
    await configurato(page, 'pianificatore', 'semplice');
    await page.evaluate(() => { attivaModulo('importi', true); render(); });
    await page.waitForTimeout(300);
    await apriImpostazioni(page);
    const r = await page.evaluate(() => {
      const righe = [...document.querySelectorAll('#app ul.moduli > li')];
      return righe.map(li => {
        const nome = (li.querySelector('.txt') || {}).childNodes
          ? li.querySelector('.txt').childNodes[0].textContent.trim() : '';
        const badge = li.querySelector('.txt .slot');
        const sw = li.querySelector('[role="switch"]');
        return { nome,
          badge: badge ? badge.textContent.trim() : null,
          tua: badge ? badge.classList.contains('tua') : false,
          core: !sw };
      });
    });
    expect(r.length, '54 — le quattordici parti sono elencate').toBe(14);
    /* 55 — ogni parte non-core porta l'etichetta della provenienza */
    const senza = r.filter(x => !x.core && !x.badge).map(x => x.nome);
    expect(senza, '55 — nessuna parte senza provenienza').toEqual([]);
    const importi = r.find(x => /^Importi/.test(x.nome));
    const routine = r.find(x => /^Routine/.test(x.nome));
    expect(importi.badge, '56 — la parte accesa a mano dice «scelta tua»').toBe('scelta tua');
    expect(importi.tua, '57 — e si distingue, perché diverge dal profilo').toBe(true);
    expect(routine.badge, '58 — quella che segue il preset dice «dal profilo»').toBe('dal profilo');
    expect(routine.tua, '59 — e non si distingue, perché non diverge').toBe(false);
    /* 60 — le tre parti fondamentali restano marcate come tali sulla destra */
    expect(r.filter(x => x.core).length, '60 — tre parti sono sempre attive').toBe(3);
  });

  test('ogni profilo spiega il beneficio, non solo chi lo sceglie', async ({ page }) => {
    await configurato(page, 'pianificatore', 'semplice');
    await apriImpostazioni(page);
    const p = await page.evaluate(() => {
      return [...document.querySelectorAll('#app [data-act="profilo"]')].map(b => ({
        id: b.getAttribute('data-v'),
        nome: (b.querySelector('.pnome') || {}).textContent || '',
        sub: (b.querySelector('.sub') || {}).textContent || '',
        premuto: b.getAttribute('aria-pressed')
      }));
    });
    expect(p.length, '61 — tre profili, non di più e non di meno').toBe(3);
    expect(p.map(x => x.id).sort(), '62 — con questi identificativi')
      .toEqual(['completo', 'essenziale', 'pianificatore']);
    expect(p.filter(x => x.premuto === 'true').length, '63 — uno è attivo').toBe(1);
    for (const x of p) {
      /* 64 — il beneficio è una frase in più rispetto a «per chi è»: due
         periodi distinti, non un elenco di funzioni */
      expect(x.sub.length, `64 — «${x.id}» spiega più di una riga`).toBeGreaterThan(70);
      expect(x.sub, `65 — «${x.id}» non promette un piano commerciale`)
        .not.toMatch(/gratuito|premium|€/i);
    }
    const testo = p.map(x => x.sub).join(' ');
    expect(testo, '66 — e almeno uno dice a che serve concentrarsi')
      .toMatch(/ti concentri/i);
  });

  test('la scheda promette sempre che si può cambiare e tornare indietro', async ({ page }) => {
    /* senza personalizzazioni: la promessa non deve dipendere dal fatto che
       ci sia già qualcosa da ripristinare */
    await configurato(page, 'pianificatore', 'semplice');
    await apriImpostazioni(page);
    const t = await page.evaluate(() => {
      const c = [...document.querySelectorAll('#app .card')]
        .find(x => /come vuoi usare il pannello/i.test((x.querySelector('h2') || {}).textContent || ''));
      return c ? c.textContent.replace(/\s+/g, ' ') : '';
    });
    expect(t, '67 — si può cambiare profilo quando si vuole').toMatch(/cambiare profilo quando vuoi/i);
    expect(t, '68 — cambiarlo non cancella niente').toMatch(/non cancella niente/i);
    expect(t, '69 — le scelte a mano vincono sul profilo').toMatch(/vincono sul profilo/i);
    expect(t, '70 — e si può tornare alla configurazione originale')
      .toMatch(/configurazione originale/i);
  });
});
