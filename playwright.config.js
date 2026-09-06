/* playwright.config.js
 *
 * Due scelte che vale la pena spiegare:
 *
 * 1. `baseURL` punta a 127.0.0.1 e non a `file://`. Da `file://` il
 *    browser non registra i service worker e non applica la Content
 *    Security Policy: collaudare così non dimostra niente, ed è l'errore
 *    che ha lasciato passare una CSP che rompeva l'agenda.
 *
 * 2. `retries` è 0 in locale e 1 in CI. Non 2: una prova che passa al
 *    terzo tentativo non passa, e alzare i tentativi trasforma un difetto
 *    intermittente in un difetto invisibile.
 */

const { defineConfig, devices } = require('@playwright/test');

const BASE = process.env.PT_BASE_URL || 'http://127.0.0.1:8765';
const inCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  /* i collaudi unitari e di integrazione girano col runner di Node, non qui */
  testIgnore: ['**/unit/**', '**/integration/**', '**/runner.js', '**/avvio.test.js',
               '**/security/regole.test.js'],
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 1 : 0,
  workers: inCI ? 2 : undefined,
  reporter: inCI
    ? [['github'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/esito.json' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE,
    /* tracce e scatti solo quando serve: un artefatto per ogni prova
       riuscita sono gigabyte che nessuno guarda */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    /* Il video richiede il binario ffmpeg, che Playwright scarica dallo
       stesso CDN dei browser. Dove quel CDN è bloccato — vedi `PT_CANALE`
       più sotto — ffmpeg non c'è, e OGNI prova falliva su
       `browserContext.newPage`: «Executable doesn't exist … ffmpeg-win64.exe».
       Otto prove su otto rosse per un artefatto diagnostico, non per il
       prodotto. Quando si ripiega su un browser di sistema il video si
       spegne; traccia e scatti restano, e bastano a capire un fallimento. */
    video: process.env.PT_CANALE ? 'off' : 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome'
  },

  /* Gli scatti di riferimento NON si scrivono per inerzia.
   *
   * Il valore predefinito di Playwright è `missing`: un riferimento che non
   * c'è viene creato, e la prova falla una volta sola. Alla seconda
   * esecuzione passa — contro uno scatto che nessuno ha guardato. È il modo
   * più rapido di trasformare la regressione visiva in un controllo che
   * approva se stesso.
   *
   * Con `none` un riferimento assente non viene creato. Chi vuole
   * approvarli lo dichiara: `npm run test:visivi:approva` passa
   * `--update-snapshots`, che ha la precedenza su questa riga, oppure si
   * imposta PT_APPROVA_SCATTI.
   *
   * Il caso «riferimento assente» è comunque intercettato prima, in
   * tests/ui/ui006.spec.js: là il confronto viene saltato e annotato. Questa
   * riga è la seconda difesa, per le suite che quella guardia non ha. */
  updateSnapshots: process.env.PT_APPROVA_SCATTI ? 'all' : 'none',

  /* La regressione visiva tollera un pixel su cento: sotto quella soglia
     le differenze sono rendering del testo fra una versione del browser e
     l'altra, non cambiamenti dell'interfaccia. */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      scale: 'css'
    }
  },

  /* `PT_CANALE` fa usare un browser GIÀ INSTALLATO sul sistema — `chrome`
     o `msedge` — invece di quello che Playwright scarica.

     Serve dove il download dei browser non riesce: su una rete che
     interrompe i trasferimenti lunghi, `npx playwright install` fallisce
     con «Download failure» anche quando i CDN rispondono e servono byte a
     una richiesta diretta. Senza questa via d'uscita l'intera suite in
     browser resta ineseguibile, e «ineseguibile» diventa in fretta
     «mai eseguita».

     In CI la variabile non è impostata e il comportamento non cambia: si
     usano i browser di Playwright, che è la scelta giusta quando si
     possono scaricare, perché la versione è riproducibile. Con un canale
     di sistema la versione è quella della macchina, e va dichiarata
     nell'esito. */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PT_CANALE ? { channel: process.env.PT_CANALE } : {})
      }
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } }
  ],

  /* Se il server non è già in piedi, Playwright lo avvia. `reuseExisting`
     evita di litigare con quello che la pipeline ha già avviato. */
  webServer: {
    command: 'npx http-server . -p 8765 -c-1 --silent',
    url: BASE + '/build.json',
    reuseExistingServer: true,
    timeout: 30000
  }
});
