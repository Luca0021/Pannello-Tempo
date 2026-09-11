#!/usr/bin/env node
/* tests/unit/profili.test.js — profili, moduli e modalità.
 *
 * Questo file non esisteva, e nella cartella `tests/` le uniche tracce del
 * sistema dei profili erano quattro chiamate a `attivaModulo` usate per
 * preparare lo stato di un'altra prova. Era il buco di copertura più grande
 * del pannello: `moduloAttivo` decide quali sezioni esistono, e nessuno lo
 * verificava.
 *
 * La regola che queste prove difendono è scritta nel blocco SET-002 di
 * js/modules.js e per molto tempo il codice l'ha contraddetta:
 *
 *     il profilo tocca i moduli, la modalità no.
 *
 * `applicaProfilo` eseguiva anche `setImp("modo", …)`, quindi scegliere un
 * profilo per spegnere due sezioni cambiava anche quanto dettaglio si vedeva
 * dentro quelle rimaste. Le prove «la modalità non si muove» sono lì per
 * quello, e devono fallire se qualcuno rimette quella riga.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..', '..');

let passati = 0, falliti = 0;
const problemi = [];
function prova(nome, fn) {
  try { fn(); passati++; console.log('  ok   ' + nome); }
  catch (e) { falliti++; problemi.push(nome + ' → ' + e.message);
              console.log('  FALL ' + nome + ' → ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'asserzione falsa'); }
function uguale(a, b, m) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((m || '') + ' atteso ' + JSON.stringify(b) + ', ottenuto ' + JSON.stringify(a));
}

/* Lo stesso ambiente del browser meno il disegno: gli script condividono lo
   scope globale e non si possono `require`. */
function carica() {
  const magazzino = {};
  const ctx = {
    console, Object, Array, JSON, Date, Math, String, Number, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Intl,
    localStorage: {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k, v) => { magazzino[k] = String(v); },
      removeItem: k => { delete magazzino[k]; },
      key: n => Object.keys(magazzino)[n] || null,
      get length() { return Object.keys(magazzino).length; }
    },
    document: { documentElement: { setAttribute(){}, getAttribute: () => null },
                getElementById: () => null, querySelectorAll: () => [],
                querySelector: () => null, addEventListener(){} },
    navigator: { onLine: true }, location: { protocol: 'http:', href: 'http://localhost/' },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    __magazzino: magazzino
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.__PT_TEST__ = true;
  const sandbox = vm.createContext(ctx);
  for (const f of ['js/config.js', 'js/config-firebase.js', 'js/utils.js',
                   'js/migrations.js', 'js/state.js', 'js/modules.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ': ' + e.message); }
  }
  return ctx;
}

const ctx = carica();

/* Stato pulito prima di ogni prova: dati veri e riconoscibili, così le prove
   che parlano di «i dati restano» possono verificarlo invece di dichiararlo. */
function azzera(impostazioni) {
  ctx.S.data = {
    v: ctx.SCHEMA_ATTUALE,
    items: [
      { id: 'r1', label: 'routine settimanale', area: 'lavoro', freq: 'weekly', days: [1] },
      { id: 't1', label: 'task di oggi', area: 'lavoro', freq: 'once', date: '2026-09-11' },
      { id: 'w1', label: 'in attesa di risposta', area: 'lavoro', freq: 'once', waiting: true }
    ],
    capture: [{ id: 'n1', text: 'una nota', t: 1 }],
    modelli: [{ id: 'm1', nome: 'giornata tipo' }],
    checks: {}, chiusure: [], completamenti: [],
    settings: Object.assign(ctx.impostazioniPredefinite(), impostazioni || {})
  };
}

console.log('Profili, moduli e modalità\n');

/* ─────────────────────────────────────────────────────────────────────────
   I TRE PROFILI: identità, non gusto
   ───────────────────────────────────────────────────────────────────────── */
prova('i profili sono esattamente tre, con questi identificativi', () => {
  uguale(Object.keys(ctx.PROFILI).sort(), ['completo', 'essenziale', 'pianificatore'], 'id:');
});

prova('ogni profilo ha nome, «per chi è» e beneficio, e nessuno è vuoto', () => {
  Object.keys(ctx.PROFILI).forEach(k => {
    const p = ctx.PROFILI[k];
    assert(p.nome && p.nome.length > 2, k + ': nome mancante');
    assert(p.per && p.per.length > 10, k + ': «per» mancante');
    /* PRD: la UI non deve dire soltanto che cosa contiene il profilo */
    assert(p.beneficio && p.beneficio.length > 20, k + ': beneficio mancante');
    assert(p.beneficio !== p.per, k + ': beneficio e «per» sono la stessa frase');
    assert(Array.isArray(p.moduli), k + ': moduli non è un elenco');
  });
});

prova('i nomi restano Essenziale, Pianificatore, Completo', () => {
  uguale([ctx.PROFILI.essenziale.nome, ctx.PROFILI.pianificatore.nome, ctx.PROFILI.completo.nome],
    ['Essenziale', 'Pianificatore', 'Completo'], 'nomi:');
});

prova('nessun profilo elenca un modulo che non esiste, o un modulo core', () => {
  const noti = ctx.MODULI.map(m => m.id);
  Object.keys(ctx.PROFILI).forEach(k => {
    ctx.PROFILI[k].moduli.forEach(id => {
      assert(noti.indexOf(id) >= 0, k + ': modulo sconosciuto ' + id);
      assert(!ctx.modulo(id).core, k + ': elenca il modulo core ' + id);
    });
  });
});

prova('i profili crescono: Essenziale ⊂ Pianificatore ⊂ Completo', () => {
  const e = ctx.PROFILI.essenziale.moduli, p = ctx.PROFILI.pianificatore.moduli,
        c = ctx.PROFILI.completo.moduli;
  e.forEach(x => assert(p.indexOf(x) >= 0, 'Pianificatore non contiene ' + x));
  p.forEach(x => assert(c.indexOf(x) >= 0, 'Completo non contiene ' + x));
  assert(e.length < p.length && p.length < c.length,
    'le tre quantità dovrebbero crescere: ' + e.length + '/' + p.length + '/' + c.length);
});

/* ─────────────────────────────────────────────────────────────────────────
   IL DIFETTO CORRETTO: il profilo non tocca la modalità
   ───────────────────────────────────────────────────────────────────────── */
prova('scegliere Essenziale non forza la modalità semplice', () => {
  azzera({ modo: 'avanzata' });
  ctx.applicaProfilo('essenziale');
  uguale(ctx.pref('modo'), 'avanzata', 'modo:');
});

prova('scegliere Pianificatore non forza la modalità semplice', () => {
  azzera({ modo: 'avanzata' });
  ctx.applicaProfilo('pianificatore');
  uguale(ctx.pref('modo'), 'avanzata', 'modo:');
});

prova('scegliere Completo non forza la modalità avanzata', () => {
  azzera({ modo: 'semplice' });
  ctx.applicaProfilo('completo');
  uguale(ctx.pref('modo'), 'semplice', 'modo:');
});

prova('passare da un profilo all\'altro lascia la modalità dove era', () => {
  azzera({ modo: 'avanzata' });
  ['essenziale', 'completo', 'pianificatore', 'essenziale'].forEach(id => {
    ctx.applicaProfilo(id);
    uguale(ctx.pref('modo'), 'avanzata', 'dopo ' + id + ' il modo:');
  });
});

prova('la modalità coerente col profilo resta una proposta, e la dichiara', () => {
  uguale(ctx.modoSuggerito('essenziale'), 'semplice', 'essenziale:');
  uguale(ctx.modoSuggerito('pianificatore'), 'semplice', 'pianificatore:');
  uguale(ctx.modoSuggerito('completo'), 'avanzata', 'completo:');
  /* proporre non è applicare: la proposta non deve scrivere niente */
  azzera({ modo: 'semplice' });
  ctx.modoSuggerito('completo');
  uguale(ctx.pref('modo'), 'semplice', 'modo dopo la proposta:');
});

/* ─────────────────────────────────────────────────────────────────────────
   IL PROFILO DECIDE I MODULI, LA SCELTA ESPLICITA VINCE
   ───────────────────────────────────────────────────────────────────────── */
prova('applicare un profilo accende i suoi moduli e spegne gli altri', () => {
  azzera();
  ctx.applicaProfilo('essenziale');
  assert(ctx.moduloAttivo('note'), 'note doveva restare accesa');
  assert(!ctx.moduloAttivo('routine'), 'routine doveva spegnersi');
  assert(!ctx.moduloAttivo('importi'), 'importi doveva spegnersi');
});

prova('i tre moduli core restano attivi con qualunque profilo', () => {
  azzera();
  ['essenziale', 'pianificatore', 'completo'].forEach(id => {
    ctx.applicaProfilo(id);
    ['oggi', 'agenda', 'rituale'].forEach(c =>
      assert(ctx.moduloAttivo(c), c + ' spento con il profilo ' + id));
  });
});

prova('una scelta esplicita vince sul profilo, in entrambi i versi', () => {
  azzera();
  ctx.applicaProfilo('essenziale');
  ctx.attivaModulo('routine', true);
  assert(ctx.moduloAttivo('routine'), 'la scelta esplicita non ha vinto (acceso)');
  ctx.attivaModulo('note', false);
  assert(!ctx.moduloAttivo('note'), 'la scelta esplicita non ha vinto (spento)');
});

prova('cambiare profilo azzera le scelte esplicite, e l\'anteprima lo dice prima', () => {
  azzera();
  ctx.applicaProfilo('essenziale');
  ctx.attivaModulo('routine', true);
  const ant = ctx.anteprimaProfilo('pianificatore');
  uguale(ant.scelteAzzerate, 1, 'scelte che verrebbero dimenticate:');
  ctx.applicaProfilo('pianificatore');
  uguale(ctx.sceltePersonali(), 0, 'scelte rimaste:');
});

prova('un id di profilo inatteso non cambia niente', () => {
  azzera({ modo: 'avanzata' });
  ctx.applicaProfilo('pianificatore');
  ctx.attivaModulo('importi', true);
  assert(ctx.applicaProfilo('premium') === false, 'ha accettato un profilo inesistente');
  uguale(ctx.pref('profilo'), 'pianificatore', 'profilo:');
  uguale(ctx.sceltePersonali(), 1, 'le scelte non dovevano essere toccate:');
  uguale(ctx.pref('modo'), 'avanzata', 'modo:');
});

prova('un modulo core non si spegne nemmeno chiedendolo', () => {
  azzera();
  assert(ctx.attivaModulo('oggi', false) === false, 'ha accettato di spegnere un core');
  assert(ctx.moduloAttivo('oggi'), 'oggi si è spento');
});

prova('un id di modulo sconosciuto non nasconde niente', () => {
  azzera();
  assert(ctx.moduloAttivo('sezione-inventata'), 'un id sconosciuto ha nascosto una sezione');
});

prova('accendere un modulo accende ciò da cui dipende, spegnerlo spegne i dipendenti', () => {
  azzera();
  ctx.applicaProfilo('essenziale');          /* coach e rituale: rituale è core */
  ctx.attivaModulo('energia', true);
  assert(ctx.moduloAttivo('agenda'), 'agenda è core, doveva già essere attiva');
  ctx.attivaModulo('coach', true);
  assert(ctx.moduloAttivo('coach'), 'coach non si è accesa');
  uguale(ctx.dipendenzeMancanti('coach'), [], 'dipendenze mancanti di coach:');
});

/* ─────────────────────────────────────────────────────────────────────────
   COMPATIBILITÀ CON DATI PRECEDENTI
   ───────────────────────────────────────────────────────────────────────── */
prova('senza profilo scelto decidono i predefiniti dei moduli', () => {
  azzera({ profilo: null, moduli: {}, modo: 'semplice' });
  assert(ctx.moduloAttivo('routine'), 'routine è predefinita: doveva essere attiva');
  assert(ctx.moduloAttivo('note'), 'note è predefinita');
  assert(!ctx.moduloAttivo('obiettivi'), 'obiettivi non è predefinita');
  /* i moduli marcati «avanzato» seguono la modalità, e solo in questo caso */
  assert(!ctx.moduloAttivo('etichette'), 'etichette in modalità semplice');
  ctx.setImp('modo', 'avanzata');
  assert(ctx.moduloAttivo('etichette'), 'etichette in modalità avanzata');
});

prova('impostazioni vecchie senza le chiavi profilo e moduli non fanno cadere niente', () => {
  azzera();
  delete ctx.S.data.settings.profilo;
  delete ctx.S.data.settings.moduli;
  assert(ctx.moduloAttivo('oggi'), 'core');
  assert(ctx.moduloAttivo('note'), 'predefinita');
  uguale(ctx.sceltePersonali(), 0, 'scelte:');
  uguale(ctx.provenienzaModulo('note').origine, 'predefinito', 'origine:');
});

/* ─────────────────────────────────────────────────────────────────────────
   PROVENIENZA: l'informazione che l'interfaccia non dava
   ───────────────────────────────────────────────────────────────────────── */
prova('un modulo core dichiara di essere core', () => {
  azzera();
  const p = ctx.provenienzaModulo('agenda');
  uguale(p.origine, 'core', 'origine:');
  assert(p.attivo && !p.diverge, 'un core non diverge da niente');
});

prova('un modulo deciso dal profilo dichiara il profilo', () => {
  azzera();
  ctx.applicaProfilo('pianificatore');
  uguale(ctx.provenienzaModulo('routine').origine, 'profilo', 'accesa dal profilo:');
  uguale(ctx.provenienzaModulo('importi').origine, 'profilo', 'spenta dal profilo:');
  assert(!ctx.provenienzaModulo('routine').diverge, 'non diverge');
});

prova('una scelta esplicita diversa dal profilo si dichiara, e si distingue', () => {
  azzera();
  ctx.applicaProfilo('essenziale');
  ctx.attivaModulo('importi', true);        /* Essenziale non lo prevede */
  const p = ctx.provenienzaModulo('importi');
  uguale(p.origine, 'personale', 'origine:');
  assert(p.diverge === true, 'doveva risultare divergente dal profilo');
  assert(p.attivo === true, 'e attiva');
});

prova('una scelta esplicita che coincide col profilo è personale ma non divergente', () => {
  azzera();
  ctx.applicaProfilo('pianificatore');
  ctx.attivaModulo('routine', true);        /* Pianificatore la prevede già */
  const p = ctx.provenienzaModulo('routine');
  uguale(p.origine, 'personale', 'origine:');
  assert(p.diverge === false, 'non doveva risultare divergente');
});

prova('la provenienza copre tutte le parti, e nessuna resta senza etichetta', () => {
  azzera();
  ctx.applicaProfilo('pianificatore');
  ctx.MODULI.forEach(m => {
    const p = ctx.provenienzaModulo(m.id);
    assert(p, m.id + ': nessuna provenienza');
    assert(p.etichetta && p.etichetta.length, m.id + ': etichetta vuota');
    /* corta di proposito: finisce accanto al nome, su schermi da 320px */
    assert(p.etichetta.length <= 16, m.id + ': etichetta troppo lunga «' + p.etichetta + '»');
  });
  assert(ctx.provenienzaModulo('non-esiste') === null, 'un id sconosciuto deve dare null');
});

/* ─────────────────────────────────────────────────────────────────────────
   RITORNO AL PRESET: spiegato prima, e solo sulla visibilità
   ───────────────────────────────────────────────────────────────────────── */
prova('senza profilo non c\'è un preset a cui tornare, e lo dice', () => {
  azzera({ profilo: null });
  const a = ctx.anteprimaRipristinoPreset();
  assert(a.ok === false, 'non doveva essere possibile');
  assert(/profilo/i.test(a.motivo), 'il motivo non nomina il profilo: ' + a.motivo);
  uguale(ctx.ripristinaPreset().ok, false, 'ripristinaPreset:');
});

prova('l\'anteprima del ripristino nomina le parti, non le conta soltanto', () => {
  azzera();
  ctx.applicaProfilo('essenziale');
  ctx.attivaModulo('importi', true);        /* tornerà spenta */
  ctx.attivaModulo('note', false);          /* tornerà attiva */
  const a = ctx.anteprimaRipristinoPreset();
  assert(a.ok, 'doveva essere possibile');
  uguale(a.profilo.nome, 'Essenziale', 'profilo:');
  uguale(a.accese.map(x => x.id), ['note'], 'tornano attive:');
  uguale(a.spente.map(x => x.id), ['importi'], 'tornano spente:');
  uguale(a.scelte, 2, 'scelte da dimenticare:');
  a.accese.concat(a.spente).forEach(x =>
    assert(x.nome && x.nome.length, 'una parte senza nome nell\'anteprima'));
});

prova('una scelta esplicita che coincide col profilo non compare come cambiamento', () => {
  azzera();
  ctx.applicaProfilo('pianificatore');
  ctx.attivaModulo('routine', true);
  const a = ctx.anteprimaRipristinoPreset();
  uguale(a.accese.length, 0, 'accese:');
  uguale(a.spente.length, 0, 'spente:');
  uguale(a.invariate, 1, 'invariate:');
  uguale(a.scelte, 1, 'scelte:');
});

prova('il ripristino riporta esattamente allo stato del profilo', () => {
  azzera();
  ctx.applicaProfilo('pianificatore');
  const atteso = ctx.moduliAttivi();
  ctx.attivaModulo('importi', true);
  ctx.attivaModulo('routine', false);
  assert(JSON.stringify(ctx.moduliAttivi()) !== JSON.stringify(atteso), 'lo stato doveva cambiare');
  const r = ctx.ripristinaPreset();
  assert(r.ok, 'ripristino fallito');
  uguale(ctx.moduliAttivi(), atteso, 'moduli dopo il ripristino:');
  uguale(ctx.sceltePersonali(), 0, 'scelte rimaste:');
});

prova('il ripristino non tocca nessun dato, e nemmeno le altre impostazioni', () => {
  azzera({ modo: 'avanzata', sogliaLavoro: 42 });
  ctx.applicaProfilo('completo');
  ctx.attivaModulo('importi', false);
  const datiPrima = JSON.stringify({
    items: ctx.S.data.items, capture: ctx.S.data.capture, modelli: ctx.S.data.modelli
  });
  ctx.ripristinaPreset();
  uguale(JSON.parse(JSON.stringify({
    items: ctx.S.data.items, capture: ctx.S.data.capture, modelli: ctx.S.data.modelli
  })), JSON.parse(datiPrima), 'i dati:');
  uguale(ctx.pref('modo'), 'avanzata', 'modo:');
  uguale(ctx.pref('sogliaLavoro'), 42, 'sogliaLavoro:');
  uguale(ctx.pref('profilo'), 'completo', 'profilo:');
});

prova('spegnere una parte dichiara quante voci nasconde, e che restano', () => {
  azzera();
  ctx.applicaProfilo('completo');
  const c = ctx.conseguenzeSpegnimento('routine');
  uguale(c.voci, 1, 'routine ricorrenti nei dati di prova:');
  assert(/restano/i.test(c.testo), 'il testo non promette che i dati restano: ' + c.testo);
  const n = ctx.conseguenzeSpegnimento('note');
  uguale(n.voci, 1, 'note in posta:');
  assert(ctx.conseguenzeSpegnimento('agenda') === null, 'un core non si spegne');
});

prova('spegnere una parte non cancella le voci che nascondeva', () => {
  azzera();
  ctx.applicaProfilo('completo');
  const quante = ctx.S.data.capture.length;
  ctx.attivaModulo('note', false);
  assert(!ctx.moduloAttivo('note'), 'note doveva spegnersi');
  uguale(ctx.S.data.capture.length, quante, 'le note dopo lo spegnimento:');
  ctx.attivaModulo('note', true);
  uguale(ctx.S.data.capture.length, quante, 'le note dopo la riaccensione:');
});

/* ─────────────────────────────────────────────────────────────────────────
   PROFILI E PIANI COMMERCIALI SONO DUE COSE
   ───────────────────────────────────────────────────────────────────────── */
prova('nessun profilo si chiama come un piano, e nessuno nomina un prezzo', () => {
  const commerciali = /gratuito|premium|a vita|lifetime|piano|prova gratuita|€/i;
  Object.keys(ctx.PROFILI).forEach(k => {
    const p = ctx.PROFILI[k];
    assert(!commerciali.test(k), 'id commerciale: ' + k);
    assert(!commerciali.test(p.nome), 'nome commerciale: ' + p.nome);
    assert(!commerciali.test(p.per), k + ': «per» nomina il commerciale');
    assert(!commerciali.test(p.beneficio), k + ': il beneficio nomina il commerciale');
  });
});

console.log('\n' + passati + ' superate, ' + falliti + ' fallite');
if (falliti) { problemi.forEach(p => console.log('  · ' + p)); process.exit(1); }
