/* tests/security/regole.test.js — SEC-002: isolamento dei dati per UID.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NON ESEGUITO nell'ambiente in cui è stato scritto.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Richiede Node, @firebase/rules-unit-testing e un runtime Java per
 * l'emulatore Firestore. Nessuno dei tre è presente. Il comando esatto è
 * in RUN-CI.md e in FIREBASE-SETUP.md §13.
 *
 * Finché questo file non produce «falliti: 0», SEC-002 resta PARZIALE.
 * Regole scritte non sono regole verificate: una regola può essere
 * sintatticamente valida, superare la revisione di chi l'ha scritta, e
 * lasciare passare un utente che non dovrebbe. È esattamente ciò che
 * questo file esiste per scoprire.
 *
 * CODICI D'USCITA
 *   0  tutte le prove superate
 *   1  almeno una prova fallita
 *   2  SALTATO: manca @firebase/rules-unit-testing
 *
 * Il 2 è distinto di proposito: un test saltato non è un test superato, e
 * la pipeline non deve poterli confondere. Un `exit 0` su un test saltato è
 * il modo più efficace di credersi al sicuro senza esserlo.
 *
 * DATI: tutti finti. Il progetto è `demo-pannello` — il prefisso `demo-` è
 * quello che l'emulatore riconosce come progetto dimostrativo: non tocca
 * nulla di reale e non richiede credenziali. Nessun dato personale, nessuna
 * email vera, nessun token.
 */

'use strict';

let rut;
try {
  rut = require('@firebase/rules-unit-testing');
} catch (e) {
  console.log('SALTATO: @firebase/rules-unit-testing non è installato.');
  console.log('SEC-002 resta PARZIALE finché questo test non viene eseguito.');
  console.log('');
  console.log('  npm i -D @firebase/rules-unit-testing firebase-tools');
  console.log('  npx firebase emulators:exec --only firestore,auth \\');
  console.log('      --project demo-pannello "node tests/security/regole.test.js"');
  process.exit(2);
}

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment, assertFails, assertSucceeds
} = rut;

const PROGETTO = process.env.PT_PROGETTO_TEST || 'demo-pannello';
const REGOLE = path.resolve(__dirname, '..', '..', 'firebase', 'firestore.rules');

/* Guardia: questo collaudo non deve poter parlare con un progetto reale. */
if (!/^demo-/.test(PROGETTO)) {
  console.error('INTERROTTO: il progetto di prova deve cominciare per «demo-».');
  console.error('Ricevuto: «' + PROGETTO + '». Un collaudo non tocca la produzione.');
  process.exit(1);
}

const UID_A = 'utente-a';
const UID_B = 'utente-b';

let passati = 0, falliti = 0;
const problemi = [];

async function prova(numero, nome, fn) {
  const etichetta = String(numero).padStart(2, '0') + ' — ' + nome;
  try {
    await fn();
    passati++;
    console.log('  ok   ' + etichetta);
  } catch (e) {
    falliti++;
    problemi.push(etichetta + ' → ' + e.message);
    console.log('  FALL ' + etichetta + ' → ' + e.message);
  }
}

/* Un payload valido secondo le regole: schema, timestamp plausibile e
   dimensione sotto il limite. */
function datiValidi(extra) {
  return Object.assign({
    payload: JSON.stringify({ items: [] }),
    schema: 6,
    aggiornatoIl: new Date()
  }, extra || {});
}

async function main() {
  console.log('SEC-002 — isolamento per UID, sulle regole di firebase/firestore.rules');
  console.log('progetto di prova: ' + PROGETTO + ' (finto)\n');

  const env = await initializeTestEnvironment({
    projectId: PROGETTO,
    firestore: { rules: fs.readFileSync(REGOLE, 'utf8') }
  });

  const a = env.authenticatedContext(UID_A).firestore();
  const b = env.authenticatedContext(UID_B).firestore();
  const anonimo = env.unauthenticatedContext().firestore();

  /* Semina i dati di A e di B scavalcando le regole: serve a preparare lo
     stato, non è una prova. `withSecurityRulesDisabled` esiste per questo. */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('users/' + UID_A + '/datasets/current').set(datiValidi());
    await db.doc('users/' + UID_A + '/records/r1').set({ id: 'r1', schema: 6 });
    await db.doc('users/' + UID_A + '/profile/main').set({ schema: 6 });
    await db.doc('users/' + UID_B + '/datasets/current').set(datiValidi());
    await db.doc('users/' + UID_B + '/records/r9').set({ id: 'r9', schema: 6 });
    await db.doc('pannello/' + UID_A).set({ payload: '{}' });
  });

  /* ─── 1-4: il proprietario può fare le quattro operazioni ─────────────── */

  await prova(1, 'il proprietario legge', async () => {
    await assertSucceeds(a.doc('users/' + UID_A + '/datasets/current').get());
    await assertSucceeds(a.doc('users/' + UID_A + '/records/r1').get());
    await assertSucceeds(a.doc('users/' + UID_A + '/profile/main').get());
  });

  await prova(2, 'il proprietario crea', async () => {
    await assertSucceeds(a.doc('users/' + UID_A + '/records/nuovo').set({ id: 'nuovo', schema: 6 }));
    await assertSucceeds(a.doc('users/' + UID_A + '/backups/b1').set(datiValidi()));
    await assertSucceeds(a.doc('users/' + UID_A + '/tombstones/r0').set({ id: 'r0', schema: 6 }));
    await assertSucceeds(a.doc('users/' + UID_A + '/sync/meta').set({ schema: 6, rev: 1 }));
  });

  await prova(3, 'il proprietario aggiorna', async () => {
    await assertSucceeds(a.doc('users/' + UID_A + '/datasets/current')
      .set(datiValidi({ payload: JSON.stringify({ items: [{ id: 'x' }] }) })));
    await assertSucceeds(a.doc('users/' + UID_A + '/records/r1').update({ schema: 6 }));
  });

  await prova(4, 'il proprietario cancella', async () => {
    await assertSucceeds(a.doc('users/' + UID_A + '/records/nuovo').delete());
    await assertSucceeds(a.doc('users/' + UID_A + '/backups/b1').delete());
    /* anche il documento nel percorso delle versioni precedenti */
    await assertSucceeds(a.doc('pannello/' + UID_A).delete());
  });

  /* ─── 5-8: nessun accesso incrociato ──────────────────────────────────── */

  await prova(5, 'A non legge i dati di B', async () => {
    await assertFails(a.doc('users/' + UID_B + '/datasets/current').get());
    await assertFails(a.doc('users/' + UID_B + '/records/r9').get());
    await assertFails(a.doc('users/' + UID_B + '/profile/main').get());
    await assertFails(a.doc('users/' + UID_B + '/backups/qualsiasi').get());
    await assertFails(a.doc('users/' + UID_B + '/sync/meta').get());
  });

  await prova(6, 'A non crea dati per B', async () => {
    await assertFails(a.doc('users/' + UID_B + '/records/intruso').set({ id: 'intruso', schema: 6 }));
    await assertFails(a.doc('users/' + UID_B + '/datasets/nuovo').set(datiValidi()));
    await assertFails(a.doc('users/' + UID_B + '/backups/intruso').set(datiValidi()));
  });

  await prova(7, 'A non aggiorna i dati di B', async () => {
    await assertFails(a.doc('users/' + UID_B + '/datasets/current').set(datiValidi()));
    await assertFails(a.doc('users/' + UID_B + '/records/r9').update({ schema: 6 }));
  });

  await prova(8, 'A non cancella i dati di B', async () => {
    await assertFails(a.doc('users/' + UID_B + '/records/r9').delete());
    await assertFails(a.doc('users/' + UID_B + '/datasets/current').delete());
    await assertFails(a.doc('pannello/' + UID_B).delete());
  });

  /* ─── 9-10: nessun accesso senza autenticazione ───────────────────────── */

  await prova(9, 'senza autenticazione non si legge', async () => {
    await assertFails(anonimo.doc('users/' + UID_A + '/datasets/current').get());
    await assertFails(anonimo.doc('users/' + UID_A + '/records/r1').get());
    await assertFails(anonimo.doc('pannello/' + UID_A).get());
  });

  await prova(10, 'senza autenticazione non si scrive', async () => {
    await assertFails(anonimo.doc('users/' + UID_A + '/datasets/current').set(datiValidi()));
    await assertFails(anonimo.doc('users/qualsiasi/datasets/current').set(datiValidi()));
    await assertFails(anonimo.doc('pannello/' + UID_A).set({ payload: '{}' }));
  });

  /* ─── 11: UID falsificato nel payload ─────────────────────────────────────
     La proprietà si deduce dal percorso, non da un campo. Scrivere
     `uid: 'utente-b'` dentro un documento che sta sotto `users/utente-a`
     deve essere rifiutato: se passasse, un backup esportato mentirebbe su
     chi lo possiede. E scrivere sotto il percorso di B dichiarandosi B non
     deve funzionare comunque. */

  await prova(11, 'UID falsificato nel documento: rifiutato', async () => {
    await assertFails(a.doc('users/' + UID_A + '/records/bugiardo')
      .set({ id: 'bugiardo', uid: UID_B, schema: 6 }));
    await assertFails(a.doc('users/' + UID_B + '/records/bugiardo')
      .set({ id: 'bugiardo', uid: UID_B, schema: 6 }));
    /* dichiararsi proprietario correttamente invece funziona */
    await assertSucceeds(a.doc('users/' + UID_A + '/records/onesto')
      .set({ id: 'onesto', uid: UID_A, schema: 6 }));
  });

  /* ─── 12: percorsi manipolati ─────────────────────────────────────────── */

  await prova(12, 'percorso manipolato: rifiutato', async () => {
    /* il contenitore users/{uid} non è leggibile né scrivibile */
    await assertFails(a.doc('users/' + UID_A).get());
    await assertFails(a.doc('users/' + UID_A).set({ qualcosa: 1 }));
    /* una collezione non prevista, dentro il proprio spazio */
    await assertFails(a.doc('users/' + UID_A + '/inventata/x').set({ a: 1 }));
    /* una collezione non prevista alla radice */
    await assertFails(a.doc('altro/x').set({ a: 1 }));
    await assertFails(a.doc('config/globale').get());
    /* l'id del record deve coincidere col nome del documento */
    await assertFails(a.doc('users/' + UID_A + '/records/r5').set({ id: 'r6', schema: 6 }));
  });

  /* ─── 13: schema e campi non validi ───────────────────────────────────── */

  await prova(13, 'dati non validi: rifiutati', async () => {
    /* record senza id */
    await assertFails(a.doc('users/' + UID_A + '/records/senzaid').set({ schema: 6 }));
    /* id non stringa */
    await assertFails(a.doc('users/' + UID_A + '/records/n').set({ id: 123, schema: 6 }));
    /* id troppo lungo */
    await assertFails(a.doc('users/' + UID_A + '/records/lungo')
      .set({ id: 'x'.repeat(200), schema: 6 }));
    /* timestamp nel futuro */
    await assertFails(a.doc('users/' + UID_A + '/datasets/current')
      .set(datiValidi({ aggiornatoIl: new Date(Date.now() + 86400000) })));
    /* payload oltre il limite */
    await assertFails(a.doc('users/' + UID_A + '/datasets/current')
      .set(datiValidi({ payload: 'x'.repeat(950000) })));
    /* schema che regredisce */
    await assertFails(a.doc('users/' + UID_A + '/datasets/current')
      .set(datiValidi({ schema: 3 })));
    /* una copia di sicurezza non si modifica */
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/' + UID_A + '/backups/fisso').set(datiValidi());
    });
    await assertFails(a.doc('users/' + UID_A + '/backups/fisso').update({ schema: 6 }));
    /* una lapide non si modifica */
    await assertFails(a.doc('users/' + UID_A + '/tombstones/r0').update({ schema: 6 }));
    /* nel percorso delle versioni precedenti non si scrive più */
    await assertFails(a.doc('pannello/' + UID_A).set({ payload: '{}' }));
  });

  /* ─── 14: nessuna enumerazione globale ────────────────────────────────────
     Il punto per cui la struttura è `users/{uid}/…` e non una collezione
     piatta. Con una collezione piatta, una query senza filtro — o con un
     filtro che il client può cambiare — restituirebbe i documenti di tutti. */

  await prova(14, 'enumerazione globale: rifiutata', async () => {
    await assertFails(a.collection('users').get());
    await assertFails(a.collection('pannello').get());
    await assertFails(anonimo.collection('users').get());
    /* nemmeno una query che finge di filtrare sul proprio UID */
    await assertFails(a.collectionGroup('datasets').get());
    await assertFails(a.collectionGroup('records').get());
    /* la propria collezione, invece, si legge */
    await assertSucceeds(a.collection('users/' + UID_A + '/records').get());
  });

  await env.cleanup();

  console.log('\npassati: ' + passati + '  falliti: ' + falliti);
  if (falliti) {
    console.log('\nDettaglio dei fallimenti:');
    problemi.forEach(p => console.log('  - ' + p));
    console.log('\nSEC-002 NON può essere dichiarato COMPLETATO.');
    process.exit(1);
  }
  console.log('\nTutte le 14 prove superate. SEC-002 può passare a COMPLETATO,');
  console.log('allegando questo output al rapporto.');
  process.exit(0);
}

main().catch(e => {
  console.error('\nErrore nell\'esecuzione del collaudo: ' + (e && e.message || e));
  console.error('Se l\'emulatore non è in ascolto, avvialo con:');
  console.error('  npx firebase emulators:exec --only firestore,auth --project ' + PROGETTO + ' \\');
  console.error('      "node tests/security/regole.test.js"');
  process.exit(1);
});
