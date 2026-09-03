/* sw.js — service worker di Pannello Tempo.
   Strategie distinte: lo scheletro dell'app va dalla cache (è statico e
   versionato), le chiamate ai servizi esterni vanno sempre in rete e non
   vengono mai messe in cache, perché conterrebbero dati personali. */
var VERSIONE = 'pt-035c16ab';
var SCHELETRO = [
  './', './index.html', './offline.html', './landing.html',
  './manifest.webmanifest', './build.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/mobile.css',
  './css/desktop.css',
  './css/accessibility.css',
  './js/config.js',
  './js/promessa.js',
  './js/versione.js',
  './js/platform.js',
  './js/utils.js',
  './js/migrations.js',
  './js/backup.js',
  './js/lavoro.js',
  './js/sicurezza.js',
  './js/seed.js',
  './js/state.js',
  './js/modules.js',
  './js/plans.js',
  './js/sharing.js',
  './js/versioni.js',
  './js/conflitti.js',
  './js/stati.js',
  './js/sync.js',
  './js/sync-provider.js',
  './js/coda.js',
  './js/account.js',
  './js/privacy.js',
  './js/routine.js',
  './js/serie.js',
  './js/validazione.js',
  './js/tasks.js',
  './js/priorities.js',
  './js/fascia.js',
  './js/balance.js',
  './js/daily-closing.js',
  './js/weekly-review.js',
  './js/onboarding.js',
  './js/attivazione.js',
  './js/templates.js',
  './js/actions.js',
  './js/calendar.js',
  './js/notifiche.js',
  './js/ics-import.js',
  './js/features/modals-ui.js',
  './js/accessibility.js',
  './js/rendering.js',
  './js/features/task-list-ui.js',
  './js/features/agenda-ui.js',
  './js/accumulo.js',
  './js/arretrati.js',
  './js/features/riprogrammare-ui.js',
  './js/suggerimenti.js',
  './js/features/priorita-ui.js',
  './js/distruttive.js',
  './js/guida.js',
  './js/features/settings-ui.js',
  './js/features/conflitti-ui.js',
  './js/navigazione.js',
  './js/render.js',
  './js/drag.js',
  './js/events.js',
  './js/boot.js',
  './js/pwa-boot.js',
  './icons/icona-192.png', './icons/icona-512.png'
];
/* domini che non devono mai finire in cache: contengono dati personali */
var MAI_IN_CACHE = /api\.github\.com|googleapis\.com|firebaseio|identitytoolkit/;

self.addEventListener('install', function(e){
  /* niente skipWaiting automatico: l'aggiornamento lo decide l'utente,
     così non perde ciò che sta scrivendo */
  e.waitUntil(
    caches.open(VERSIONE).then(function(c){
      return Promise.all(SCHELETRO.map(function(u){
        return c.add(u).catch(function(){ /* un file mancante non blocca l'installazione */ });
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(chiavi){
      return Promise.all(chiavi.map(function(k){
        if (k !== VERSIONE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  if (MAI_IN_CACHE.test(req.url)) return;            /* sincronizzazione: sempre rete */

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* risorse esterne: non le gestisco */

  /* navigazione: rete se c'è, altrimenti la copia in cache, altrimenti la pagina offline */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function(){
        return caches.match('./index.html').then(function(r){
          return r || caches.match('./offline.html');
        });
      })
    );
    return;
  }

  /* DIFETTO CORRETTO — schermo bianco dopo un aggiornamento.

     Prima: la navigazione andava alla rete (quindi index.html era quello nuovo)
     mentre le risorse statiche venivano servite dalla cache. Risultato: HTML
     della build nuova insieme ai moduli della build vecchia. Una funzione che
     la nuova pagina chiama e il vecchio modulo non definisce produce un
     ReferenceError, e la pagina resta bianca.

     Ora codice e stile seguono la stessa regola della pagina che li chiede:
     prima la rete, la cache solo se la rete non c'è. Offline continua a
     funzionare, e non si mescolano più due build. Immagini e icone restano
     cache-first: non cambiano fra una build e l'altra e non possono
     disallinearsi con il resto. */
  var codice = /\.(js|css)$/.test(url.pathname) || /build\.json$/.test(url.pathname);

  if (codice) {
    e.respondWith(
      fetch(req).then(function(r){
        if (r && r.status === 200) {
          var copia = r.clone();
          caches.open(VERSIONE).then(function(c){ c.put(req, copia); });
        }
        return r;
      }).catch(function(){ return caches.match(req); })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(colpo){
      var rete = fetch(req).then(function(r){
        if (r && r.status === 200) {
          var copia = r.clone();
          caches.open(VERSIONE).then(function(c){ c.put(req, copia); });
        }
        return r;
      }).catch(function(){ return colpo; });
      return colpo || rete;
    })
  );
});

/* l'aggiornamento avviene solo su richiesta esplicita della pagina */
self.addEventListener('message', function(e){
  if (e.data === 'aggiorna-ora') self.skipWaiting();
  if (e.data === 'versione' && e.source) e.source.postMessage({ versione: VERSIONE });
});
