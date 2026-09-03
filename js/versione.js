/* versione.js — normalmente generato da build.py. Questa identità è stata
   ricalcolata a mano dopo le correzioni di collaudo, perché senza cambiarla
   `sw.js` non si sarebbe mai accorto dell'aggiornamento: il service worker
   riconosce una versione nuova solo se il proprio file cambia, e la stessa
   `cache` avrebbe continuato a servire i file vecchi.

   `sorgenti` è l'impronta SHA-256 dei 74 file del sito — percorso più
   contenuto, in ordine alfabetico — troncata a 12 caratteri. Restano fuori i
   quattro file che l'impronta la contengono (build.json, questo, sw.js,
   index.html): includerli renderebbe il calcolo circolare.

   NON è lo stesso calcolo di build.py: alla prossima build vera uscirà un
   valore diverso, ed è normale. `base` dice da quale build pubblicata
   derivano queste correzioni.

   La stessa identità compare in sw.js, build.json, index.html e nella
   schermata «Informazioni» del pannello: se una delle quattro non coincide,
   qualcosa è stato modificato senza rifare l'impronta. */
var BUILD = {
  "app": "1.0.0",
  "sorgenti": "035c16ab8a8f",
  "base": "29868d4bf9df",
  "commit": "",
  "schema": 5,
  "cache": "pt-035c16ab",
  "costruito": "2026-09-03T09:46:02Z"
};
