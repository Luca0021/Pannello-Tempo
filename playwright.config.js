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
    video: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome'
  },

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

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } }
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
