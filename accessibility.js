/* accessibility.js — confinamento del fuoco nelle schermate modali.
   Senza questo, con la tastiera si esce dalla schermata e si finisce a
   navigare la pagina sotto, che il lettore di schermo non dovrebbe vedere. */

var SELETTORE_FUOCO = 'a[href],button:not([disabled]),input:not([disabled]),'+
  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function schermataAperta(){
  return !!(S.onboarding || S.chiusura || S.revisione);
}
function elementiFocalizzabili(){
  var cont = document.getElementById("app");
  var box = cont && cont.querySelector ? cont.querySelector(".schcorpo") : null;
  if (!box || !box.querySelectorAll) return [];
  var tutti = [];
  box.querySelectorAll(SELETTORE_FUOCO).forEach(function(el){
    /* scarto ciò che è nascosto: entrarci col tabulatore confonde */
    if (el.offsetParent === null && el.getAttribute("type") !== "hidden") return;
    tutti.push(el);
  });
  return tutti;
}
/* Il tabulatore gira dentro la schermata invece di uscirne. */
function confinaFuoco(ev){
  if (!schermataAperta() || ev.key !== "Tab") return;
  var el = elementiFocalizzabili();
  if (!el.length) return;
  var primo = el[0], ultimo = el[el.length - 1];
  var attivo = document.activeElement;
  if (ev.shiftKey && (attivo === primo || el.indexOf(attivo) < 0)) {
    ev.preventDefault(); ultimo.focus();
  } else if (!ev.shiftKey && attivo === ultimo) {
    ev.preventDefault(); primo.focus();
  }
}
/* Aprendo una schermata il fuoco entra dentro; chiudendola torna da dove veniva. */
var _fuocoPrecedente = null;
function ricordaFuoco(){
  try { _fuocoPrecedente = document.activeElement; } catch (e) { _fuocoPrecedente = null; }
}
function entraNellaSchermata(){
  var el = elementiFocalizzabili();
  if (el.length) { try { el[0].focus({ preventScroll:true }); } catch (e) { el[0].focus(); } }
}
function ripristinaFuoco(){
  if (_fuocoPrecedente && _fuocoPrecedente.focus) {
    try { _fuocoPrecedente.focus({ preventScroll:true }); } catch (e) {}
  }
  _fuocoPrecedente = null;
}

/* Annunci per i lettori di schermo: salvataggi, errori, sincronizzazione. */
function annuncia(testo){
  var zona = document.getElementById("annunci");
  if (!zona) return;
  zona.textContent = "";
  setTimeout(function(){ zona.textContent = testo; }, 30);
}

document.addEventListener("keydown", confinaFuoco, true);
