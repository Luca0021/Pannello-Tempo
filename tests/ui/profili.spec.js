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
   l'ingresso guidato viene deciso all'avvio.

   `largo` e `alto` sono parametri e non una costante per un difetto trovato in
   questo file: le prove del passo del profilo sul telefono impostavano la
   larghezza e POI chiamavano questa funzione, che la riportava a 1280. Le tre
   prove passavano misurando un desktop e dichiarando di misurare un telefono,
   che è il modo peggiore in cui una prova può essere verde. */
async function nuovo(page, largo = 1280, alto = 900) {
  await page.setViewportSize({ width: largo, height: alto });
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
        /* CORREZIONE DI QUESTA PROVA — cercava la frase esatta «la cambi
           quando vuoi dalle impostazioni», che stava nella didascalia della
           modalità. Quella didascalia è stata accorciata da 78 a 39 pixel,
           perché a 320x568 ogni riga qui spinge «Avanti» più in basso, e la
           terza frase ripeteva quello che la riga in cima al passo già dice.
           Il requisito — «consenti la modifica successiva», e dirlo — resta e
           va verificato; la formulazione no. Ora la prova cerca la promessa
           dovunque sia nel passo, invece delle parole che avevo scritto io. */
        diceCambiabile: /cambiare in qualsiasi momento|cambi quando vuoi/i.test(testo),
        stato: S.onboarding.modo
      };
    });
    expect(s.comandi, '16 — due comandi per la modalità nel passo del profilo').toBe(2);
    expect(s.valori.sort(), '17 — i due valori previsti').toEqual(['avanzata', 'semplice']);
    expect(s.premuti.filter(x => x === 'true').length, '18 — uno solo premuto').toBe(1);
    expect(s.dice, '19 — la modalità che verrà usata è scritta').toBe(true);
    expect(String(s.diceQuale).toLowerCase(), '20 — e coincide con lo stato')
      .toBe(String(s.stato).toLowerCase());
    expect(s.diceCambiabile, '21 — e il passo dice che la scelta non è definitiva').toBe(true);
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

/* ─────────────────────────────────────────────────────────────────────────
   5 — GLI STESSI STATI, SU UNO SCHERMO DA TELEFONO

   Le prove sopra girano a 1280x900, e questo è stato il difetto di questo
   file: gli stati che il commit ha introdotto non esistono nella pagina a
   riposo — il comando della modalità sta in fondo a otto sezioni, il badge
   «scelta tua» compare solo con una personalizzazione, la scheda di conferma
   solo dopo un clic — quindi NESSUNA delle suite che spazzano la pagina a
   320, 375 e 393px li ha mai visti.

   Il censimento fatto a quelle larghezze ha trovato due difetti veri e un
   allarme del proprio strumento di misura:

     VERO 1 — la conferma nasceva fuori dallo schermo. La scheda dei profili
     sta in fondo alle impostazioni, quindi al clic la pagina è scorsa di
     quasi settemila pixel; la scheda di conferma viene disegnata in cima.
     Misurato a 393x852: dialogo a 5618px SOPRA il bordo della vista, fuoco
     rimasto sul pulsante premuto. Premere non produceva niente di visibile.

     VERO 2 — il bordo del badge «scelta tua» era `var(--brass)`: 2,95:1 in
     tema chiaro contro il 3:1 che il progetto si è dato per il non testuale.
     In tema scuro dava 6,55:1, ed è il motivo per cui guardando un tema solo
     non si vedeva.

     FALSO ALLARME — «il segmento non premuto è a 1,75:1». Era il mio
     calcolatore: raccoglieva i fondi risalendo gli antenati e, se il primo
     era semitrasparente, lo usava com'è invece di comporlo su quello sotto.
     `rgba(15,27,36,.07)` finiva trattato come quasi nero. Composto bene dà
     8,51:1 in chiaro e 6,85:1 in scuro. Il modello `.seg` è quello che il
     pannello usa già per «Sfondo» e non è stato toccato: la lezione è nel
     calcolatore qui sotto, che compone gli strati dal basso.
   ───────────────────────────────────────────────────────────────────────── */

/* Contrasto: un solo fondo opaco, ottenuto componendo gli strati
   semitrasparenti su quello sotto. Vedi il falso allarme qui sopra. */
const CONTRASTO = () => {
  const P = (c) => { const m = String(c || '').match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const v = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const L = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sopra = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a),
                             b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const fondo = (e) => {
    const strati = []; let n = e;
    while (n && n.nodeType === 1) {
      const c = P(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { strati.push(c); if (c.a === 1) break; }
      n = n.parentElement;
    }
    if (!strati.length || strati[strati.length - 1].a < 1) strati.push({ r: 255, g: 255, b: 255, a: 1 });
    let acc = strati.pop();
    while (strati.length) acc = sopra(strati.pop(), acc);
    return acc;
  };
  window.__C = (col, e) => {
    const c = P(col); if (!c) return 0;
    const b = fondo(e);
    const f = c.a < 1 ? sopra(c, b) : c;
    const x = L(f), y = L(b);
    return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
  };
};

/* Le larghezze dichiarate dal progetto per il telefono, più lo zoom al 200%
   che è il caso di chi ha bisogno di caratteri grandi. */
const STRETTI = [[320, 568, '320'], [375, 812, '375'], [393, 852, '393'], [640, 450, 'zoom200']];

/* Lo stato che nessuna suite esistente crea: profilo Essenziale più due
   scelte a mano OPPOSTE, così esistono insieme il badge «scelta tua», la
   riga del ripristino e — al clic — la scheda di conferma. */
async function statoVivo(page, { w, h, tema = 'chiaro', schema = 'light' }) {
  await page.setViewportSize({ width: w, height: h });
  await page.emulateMedia({ colorScheme: schema });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render === 'function' && !!window.S);
  await page.evaluate((t) => {
    S.now = new Date(2026, 8, 11, 15, 3, 0);
    saltaOnboarding();
    setImp('modo', 'semplice');
    P.theme = t; savePrefs();
    applicaProfilo('essenziale');
    attivaModulo('importi', true);      /* Essenziale non la prevede */
    attivaModulo('note', false);        /* Essenziale la prevede */
    commit();
  }, tema);
  await page.waitForTimeout(300);
  await apriImpostazioni(page);
  /* la larghezza è quella che si crede di misurare: un aiutante che la
     riporta a 1280 trasforma una prova mobile in un desktop travestito, ed è
     già successo in questo file */
  expect(await page.evaluate(() => window.innerWidth),
    `la vista deve essere larga ${w}px`).toBe(w);
  await page.evaluate(CONTRASTO);
}

test.describe('profili · gli stessi stati su uno schermo da telefono', () => {
  for (const [w, h, et] of STRETTI) {
    test(`a ${et}px i comandi della scheda stanno dentro e si toccano`, async ({ page }) => {
      await statoVivo(page, { w, h });
      const m = await page.evaluate(() => {
        const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const box = (e) => { const r = e.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height),
                   l: Math.round(r.left), r: Math.round(r.right),
                   t: Math.round(r.top), b: Math.round(r.bottom) }; };
        /* una parola che occupa due rettangoli è spezzata a metà */
        const rotte = (el) => { if (!el) return []; const out = [];
          const cam = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t;
          while ((t = cam.nextNode())) { const re = /\S+/g; let mm;
            while ((mm = re.exec(t.nodeValue))) { const rr = document.createRange();
              rr.setStart(t, mm.index); rr.setEnd(t, mm.index + mm[0].length);
              const cime = new Set(Array.from(rr.getClientRects())
                .filter((x) => x.width > 0.5).map((x) => Math.round(x.top)));
              if (cime.size > 1) out.push(mm[0]); } }
          return out; };
        const modo = [...document.querySelectorAll('#app [data-act="modo"]')].filter(vis);
        const badge = [...document.querySelectorAll('#app ul.moduli .txt .slot')].filter(vis);
        const rip = document.querySelector('#app [data-act="preset-ripristina"]');
        const prof = [...document.querySelectorAll('#app [data-act="profilo"]')].filter(vis);
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          modo: modo.map((x) => ({ v: x.getAttribute('data-v'), ...box(x),
            premuto: x.getAttribute('aria-pressed'),
            fs: parseFloat(getComputedStyle(x).fontSize),
            contrasto: __C(getComputedStyle(x).color, x) })),
          gruppoNome: (() => { if (!modo.length) return null;
            const g = modo[0].closest('[role="group"]');
            if (!g) return null;
            const l = document.getElementById(g.getAttribute('aria-labelledby'));
            return l ? l.textContent.trim() : null; })(),
          badge: badge.map((x) => ({ testo: x.textContent.trim(), tua: x.classList.contains('tua'),
            ...box(x), fs: parseFloat(getComputedStyle(x).fontSize),
            testoC: __C(getComputedStyle(x).color, x),
            bordoC: __C(getComputedStyle(x).borderColor, x) })),
          ripristina: rip && vis(rip) ? { ...box(rip), fs: parseFloat(getComputedStyle(rip).fontSize) } : null,
          righe: [...document.querySelectorAll('#app ul.moduli > li')].map((li) => {
            const sw = li.querySelector('[role="switch"]');
            const tx = li.querySelector('.txt');
            return { nome: tx ? tx.childNodes[0].textContent.trim().slice(0, 22) : '',
              sw: sw && vis(sw) ? box(sw) : null, tx: tx ? box(tx) : null };
          }),
          profiliRotte: prof.map((x) => ({ id: x.getAttribute('data-v'), rotte: rotte(x) }))
        };
      });

      /* 71 — niente deve uscire di lato: è la prima cosa che rompe uno
         schermo da 320px, e una riga di comandi nuova è il modo tipico */
      expect(m.overflow, '71 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
      /* 72-75 — il comando della modalità: esiste, si tocca, si legge, e
         dichiara il proprio stato anche a questa larghezza */
      expect(m.modo.length, '72 — due comandi per la modalità').toBe(2);
      expect(m.modo.filter((x) => x.h < 24 || x.w < 24),
        '73 — bersagli della modalità sotto 24×24').toEqual([]);
      expect(m.modo.filter((x) => x.fs < 12),
        '74 — comandi della modalità sotto i 12px').toEqual([]);
      expect(m.modo.filter((x) => x.premuto === 'true').length,
        '75 — uno e uno solo premuto').toBe(1);
      expect(m.gruppoNome, '76 — il gruppo della modalità ha un nome leggibile').toBeTruthy();
      /* 77 — il contrasto del testo dei due segmenti, premuto e non */
      expect(m.modo.filter((x) => x.contrasto < 4.5),
        '77 — testo dei comandi della modalità sotto 4,5:1').toEqual([]);
      /* 78-81 — i badge di provenienza */
      expect(m.badge.length, '78 — ogni parte non fondamentale porta il badge').toBe(11);
      expect(m.badge.filter((x) => x.tua).length,
        '79 — le due scelte a mano si distinguono').toBe(2);
      expect(m.badge.filter((x) => x.fs < 12), '80 — badge sotto i 12px').toEqual([]);
      expect(m.badge.filter((x) => x.testoC < 4.5), '81 — testo del badge sotto 4,5:1').toEqual([]);
      /* 82 — il bordo è non testuale: 3:1. Era 2,95:1 in tema chiaro. */
      expect(m.badge.filter((x) => x.bordoC < 3), '82 — bordo del badge sotto 3:1').toEqual([]);
      /* 83-84 — la riga del ripristino, e l'interruttore di ogni parte */
      expect(m.ripristina, '83 — «Torna al preset» è visibile con due scelte a mano').not.toBeNull();
      expect(m.ripristina.h, '84 — e il suo bersaglio non è ridotto').toBeGreaterThanOrEqual(24);
      expect(m.righe.filter((r) => r.sw && (r.sw.h < 24 || r.sw.w < 24)).map((r) => r.nome),
        '85 — interruttori sotto 24×24').toEqual([]);
      /* 86 — il badge non deve spingere il testo sotto l'interruttore */
      expect(m.righe.filter((r) => r.sw && r.tx &&
        r.sw.l < r.tx.r - 1 && r.sw.t < r.tx.b - 1 && r.sw.b > r.tx.t + 1).map((r) => r.nome),
        '86 — testo e interruttore sovrapposti').toEqual([]);
      /* 87 — il beneficio aggiunto ai profili non deve spezzare parole */
      expect(m.profiliRotte.filter((x) => x.rotte.length),
        '87 — parole spezzate a metà nei pulsanti dei profili').toEqual([]);
    });
  }

  for (const [w, h, et] of STRETTI) {
    test(`a ${et}px la conferma del ripristino si vede`, async ({ page }) => {
      await statoVivo(page, { w, h });
      /* si parte da dove sta il comando, com'è per chi lo preme davvero */
      await page.evaluate(() => document.querySelector('#app [data-act="preset-ripristina"]')
        .scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(250);
      const prima = await page.evaluate(() => window.scrollY);
      await page.click('#app [data-act="preset-ripristina"]');
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const d = document.querySelector('#app [role="alertdialog"]');
        if (!d) return { assente: true };
        const r = d.getBoundingClientRect();
        const nav = document.querySelector('#app .navprim.basso');
        const nr = (nav && nav.getBoundingClientRect().height > 0) ? nav.getBoundingClientRect() : null;
        const ok = d.querySelector('[data-act="preset-ok"]');
        const okr = ok ? ok.getBoundingClientRect() : null;
        return {
          top: Math.round(r.top), bottom: Math.round(r.bottom), vista: window.innerHeight,
          scroll: window.scrollY,
          fuocoNelDialogo: d.contains(document.activeElement) || document.activeElement === d,
          fuoco: document.activeElement ? (document.activeElement.getAttribute('role') ||
            document.activeElement.tagName) : null,
          okDentro: okr ? (okr.top >= 0 && okr.bottom <= window.innerHeight) : null,
          okAlto: okr ? Math.round(okr.height) : null,
          sopraLaBarra: nr ? (Math.round(r.top) < Math.round(nr.top)) : true,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          testoMin: Math.min(...[...d.querySelectorAll('p')].map((x) => parseFloat(getComputedStyle(x).fontSize))),
          etichettato: !!(d.getAttribute('aria-labelledby') &&
            document.getElementById(d.getAttribute('aria-labelledby'))),
          /* il titolo dentro il proprio h2: è la misura che mancava, ed è il
             motivo per cui il difetto è arrivato fino alla CI invece di
             cadere qui — vedi la nota sopra la prova del contenimento */
          titolo: (() => {
            const sp = d.querySelector('h2 > span');
            const h2 = sp ? sp.closest('h2') : null;
            if (!sp || !h2) return null;
            const sr = sp.getBoundingClientRect(), hr = h2.getBoundingClientRect();
            const cs = getComputedStyle(sp);
            const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
            return { sporge: Math.round((sr.right - hr.right) * 100) / 100,
                     larghezza: Math.round(sr.width * 100) / 100,
                     contenitore: Math.round(hr.width * 100) / 100,
                     righe: Math.round(sr.height / lh),
                     flexShrink: cs.flexShrink, minWidth: cs.minWidth,
                     testo: (sp.textContent || '').trim() };
          })()
        };
      });
      expect(m.assente, '88 — la conferma deve comparire').toBeUndefined();
      /* 89 — IL DIFETTO: il dialogo nasceva 5618px sopra il bordo della
         vista, e premere non produceva niente di visibile */
      expect(m.top, '89 — la conferma comincia dentro la vista').toBeGreaterThanOrEqual(-1);
      expect(m.top, '90 — e non sotto il bordo inferiore').toBeLessThan(m.vista);
      /* 91 — il comando che conferma deve essere raggiungibile senza cercare */
      expect(m.okDentro, '91 — «Torna al preset» è visibile senza scorrere').toBe(true);
      expect(m.okAlto, '92 — e il suo bersaglio non è ridotto').toBeGreaterThanOrEqual(24);
      /* 93 — un alertdialog che non riceve il fuoco viene annunciato a metà */
      expect(m.fuocoNelDialogo, `93 — il fuoco entra nel dialogo (è su ${m.fuoco})`).toBe(true);
      expect(m.etichettato, '94 — il dialogo ha un nome accessibile').toBe(true);
      expect(m.sopraLaBarra, '95 — la conferma non nasce sotto la barra fissa').toBe(true);
      expect(m.overflow, '96 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
      expect(m.testoMin, '97 — il testo della conferma non è rimpicciolito').toBeGreaterThanOrEqual(12);
      /* 98 — IL CONTROLLO CHE MANCAVA, ed è quello che rende la 96
         indipendente dai font.

         La 96 guarda il documento: vede il difetto solo quando il titolo
         supera il bordo della VISTA. In locale il titolo sporgeva già di
         18,66px dal proprio h2 e ne restavano 18,34 al bordo, quindi la 96
         passava; con le metriche tipografiche del runner quei 18,34 non
         bastavano più e la 96 cadeva con 5px su chromium e 55 su firefox.
         Il contenimento invece è vero o falso a prescindere da quanto è
         largo un carattere: un titolo che esce dal proprio contenitore è
         sbagliato anche quando per fortuna non arriva al bordo. */
      expect(m.titolo, '98 — il titolo della conferma esiste').not.toBeNull();
      expect(m.titolo.sporge,
        `98 — il titolo «${m.titolo.testo}» sta nel suo h2 ` +
        `(largo ${m.titolo.larghezza} in un contenitore da ${m.titolo.contenitore}, ` +
        `flex-shrink ${m.titolo.flexShrink}, min-width ${m.titolo.minWidth})`)
        .toBeLessThanOrEqual(1);
      /* 99 — e ci sta andando a capo, non rimpicciolendosi o troncandosi */
      expect(m.titolo.righe, '99 — il titolo va a capo su al massimo tre righe')
        .toBeLessThanOrEqual(3);
    });
  }

  /* LE DUE CONFERME, NON UNA.
     La regola CSS è circoscritta a `[role="alertdialog"]`, e di schede di
     conferma ce ne sono due: questa e quella delle azioni distruttive, che
     ha la stessa struttura — `h2 > span` con `flex:none` — e lo stesso
     difetto latente. Oggi se la cava perché «Ripristina l'aspetto?» è corto,
     ma è la stessa fragilità, e una correzione che ne copre una sola
     lascerebbe l'altra a scadere il giorno in cui qualcuno allunga un
     titolo. */
  for (const [azione, atteso] of [['aspetto', /aspetto/i], ['impostazioni', /impostazioni/i]]) {
    test(`a 320px il titolo della conferma «${azione}» sta nel suo contenitore`, async ({ page }) => {
      await statoVivo(page, { w: 320, h: 568 });
      await page.evaluate((a) => { S.conferma = a; render(); }, azione);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const d = document.querySelector('#app [role="alertdialog"]');
        if (!d) return { assente: true };
        const sp = d.querySelector('h2 > span');
        const h2 = sp ? sp.closest('h2') : null;
        if (!sp || !h2) return { senzaTitolo: true };
        const sr = sp.getBoundingClientRect(), hr = h2.getBoundingClientRect();
        const cs = getComputedStyle(sp);
        return { sporge: Math.round((sr.right - hr.right) * 100) / 100,
          larghezza: Math.round(sr.width * 100) / 100,
          contenitore: Math.round(hr.width * 100) / 100,
          flexShrink: cs.flexShrink, minWidth: cs.minWidth,
          fontSize: parseFloat(cs.fontSize),
          testo: (sp.textContent || '').trim(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(m.assente, '100 — la conferma deve comparire').toBeUndefined();
      expect(m.senzaTitolo, '101 — e avere un titolo').toBeUndefined();
      expect(m.testo, '102 — è la conferma attesa').toMatch(atteso);
      /* 103 — la stessa regola vale qui: lo span deve potersi restringere */
      expect(Number(m.flexShrink), '103 — il titolo può restringersi').toBeGreaterThan(0);
      expect(m.sporge,
        `104 — il titolo «${m.testo}» sta nel suo h2 ` +
        `(largo ${m.larghezza} in ${m.contenitore})`).toBeLessThanOrEqual(1);
      expect(m.overflow, '105 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
      /* 106 — il testo non è stato rimpicciolito per farlo stare */
      expect(m.fontSize, '106 — il titolo non è stato rimpicciolito').toBeGreaterThanOrEqual(15);
    });
  }

  test('in tema scuro badge e comandi restano leggibili', async ({ page }) => {
    /* il bordo del badge dava 6,55:1 in scuro e 2,95:1 in chiaro: un tema
       solo non basta a trovare quel difetto, e questa prova esiste perché
       la prima versione l'ha mancato */
    await statoVivo(page, { w: 393, h: 852, tema: 'scuro', schema: 'dark' });
    const m = await page.evaluate(() => {
      const c = (e, p) => __C(getComputedStyle(e)[p], e);
      return {
        badge: [...document.querySelectorAll('#app ul.moduli .txt .slot')]
          .map((x) => ({ testo: x.textContent.trim(), tua: x.classList.contains('tua'),
                         t: c(x, 'color'), b: c(x, 'borderColor') })),
        modo: [...document.querySelectorAll('#app [data-act="modo"]')]
          .map((x) => ({ v: x.getAttribute('data-v'), t: c(x, 'color') }))
      };
    });
    expect(m.badge.filter((x) => x.t < 4.5), '98 — testo dei badge in tema scuro').toEqual([]);
    expect(m.badge.filter((x) => x.b < 3), '99 — bordo dei badge in tema scuro').toEqual([]);
    expect(m.modo.filter((x) => x.t < 4.5), '100 — comandi della modalità in tema scuro').toEqual([]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   6 — IL PASSO DEL PROFILO, SU UNO SCHERMO DA TELEFONO

   Il comando della modalità e il beneficio dei tre profili hanno fatto
   crescere il passo 2 da 762 a 1028 pixel a 320x568, e «Avanti» non sta più
   sopra la piega: prima era a y 508 con lo schermo alto 568, ora a 774.
   Dei 266 pixel, 144 sono il beneficio dei profili — contenuto approvato,
   che non si toglie — 58 la riga della modalità e 39 la sua didascalia, già
   accorciata da 78.

   «Avanti» sopra la piega a 320px non è una regola che questo progetto si è
   dato, e riportarlo là vorrebbe dire togliere una delle due cose che il
   passo deve dire. Quello che invece è una regola, e che queste prove
   fissano, è che a quella larghezza non ci sia scorrimento laterale, che
   niente sia tagliato, e che il comando per andare avanti sia raggiungibile
   e a misura piena. L'altezza resta dichiarata qui e in PROFILI-REPORT.md.
   ───────────────────────────────────────────────────────────────────────── */
test.describe('profili · l\'ingresso guidato su uno schermo da telefono', () => {
  for (const [w, h, et] of [[320, 568, '320'], [375, 812, '375'], [393, 852, '393']]) {
    test(`a ${et}px il passo del profilo è usabile per intero`, async ({ page }) => {
      await nuovo(page, w, h);
      await page.evaluate(() => { apriOnboarding(2); });
      await page.waitForTimeout(450);
      /* la larghezza è quella che si crede di misurare: se `nuovo` la
         riportasse a 1280 questa prova diventerebbe un desktop travestito */
      const larghezza = await page.evaluate(() => window.innerWidth);
      expect(larghezza, `la vista deve essere larga ${w}px`).toBe(w);
      await page.evaluate(CONTRASTO);
      const m = await page.evaluate(() => {
        const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const modo = [...document.querySelectorAll('[data-act="onb-modo"]')].filter(vis);
        const prof = [...document.querySelectorAll('[data-act="onb-profilo"]')].filter(vis);
        const av = document.querySelector('[data-act="onb-avanti"]');
        const r = (e) => { const q = e.getBoundingClientRect();
          return { w: Math.round(q.width), h: Math.round(q.height), t: Math.round(q.top) }; };
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          modo: modo.map((x) => ({ v: x.getAttribute('data-v'), ...r(x),
            premuto: x.getAttribute('aria-pressed'),
            fs: parseFloat(getComputedStyle(x).fontSize),
            contrasto: __C(getComputedStyle(x).color, x) })),
          gruppoNome: (() => { if (!modo.length) return null;
            const g = modo[0].closest('[role="group"]'); if (!g) return null;
            const l = document.getElementById(g.getAttribute('aria-labelledby'));
            return l ? l.textContent.trim() : null; })(),
          profili: prof.length,
          avanti: av && vis(av) ? r(av) : null,
          dice: /Comincerai in modalità/i.test(document.body.textContent)
        };
      });
      /* 101 — la larghezza: è la misura che rompe prima a 320px */
      expect(m.overflow, '101 — nessuno scorrimento orizzontale').toBeLessThanOrEqual(1);
      /* 102-106 — il comando della modalità nel passo del profilo */
      expect(m.modo.length, '102 — due comandi per la modalità').toBe(2);
      expect(m.modo.filter((x) => x.h < 24 || x.w < 24), '103 — bersagli sotto 24×24').toEqual([]);
      expect(m.modo.filter((x) => x.fs < 12), '104 — comandi sotto i 12px').toEqual([]);
      expect(m.modo.filter((x) => x.premuto === 'true').length, '105 — uno solo premuto').toBe(1);
      expect(m.modo.filter((x) => x.contrasto < 4.5), '106 — testo sotto 4,5:1').toEqual([]);
      expect(m.gruppoNome, '107 — il gruppo ha un nome leggibile').toBeTruthy();
      expect(m.dice, '108 — la modalità che verrà usata è scritta').toBe(true);
      expect(m.profili, '109 — i tre profili ci sono tutti').toBe(3);
      /* 110-112 — «Avanti» esiste, si tocca, e si raggiunge scorrendo: NON
         si pretende che stia sopra la piega, si pretende che ci si arrivi */
      expect(m.avanti, '110 — «Avanti» è nel documento e visibile').not.toBeNull();
      expect(m.avanti.h, '111 — e il suo bersaglio non è ridotto').toBeGreaterThanOrEqual(24);
      const dopo = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return new Promise((res) => setTimeout(() => {
          const a = document.querySelector('[data-act="onb-avanti"]').getBoundingClientRect();
          res({ dentro: a.top >= 0 && a.bottom <= window.innerHeight + 1,
                tagliato: a.bottom > document.documentElement.scrollHeight + 1 });
        }, 350));
      });
      expect(dopo.dentro, '112 — scorrendo fino in fondo «Avanti» è nella vista').toBe(true);
      expect(dopo.tagliato, '113 — e non finisce oltre la fine del documento').toBe(false);
      /* 114 — e il comando funziona da qui: il passo va avanti */
      await page.click('[data-act="onb-avanti"]');
      await page.waitForTimeout(350);
      const passo = await page.evaluate(() => S.onboarding.passo);
      expect(passo, '114 — premerlo porta al passo successivo').toBe(3);
    });
  }
});
