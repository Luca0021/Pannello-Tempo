/* drag.js — trascinamento nell'agenda
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- trascinamento ---------- */
function bindDrag(){
  var drag = null;
  document.querySelectorAll(".agblk").forEach(function(el){
    /* BUG: bindDrag() gira a ogni disegno. Prima del rendering incrementale i
       nodi venivano ricreati ogni volta e i vecchi listener sparivano con
       loro; ora i nodi sopravvivono, e senza questo controllo si accumulava
       un ascoltatore per ogni ridisegno — decine dopo pochi minuti d'uso,
       tutti attivi sullo stesso trascinamento. */
    if (el.getAttribute && el.getAttribute("data-drag-ok") === "1") return;
    if (el.setAttribute) el.setAttribute("data-drag-ok", "1");
    var hold = null;
    function attiva(e, mode, it){
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      el.style.touchAction = "none";
      el.setAttribute("data-drag", "1");
      drag = { el:el, id:it.id, mode:mode, y:e.clientY,
               start:it.start, dur:it.dur||0.5, moved:false };
      S.dragging = true;
    }
    function down(e, mode){
      e.stopPropagation();
      var it = itemById(el.getAttribute("data-blk"));
      if (!it) return;
      /* col dito il trascinamento parte dopo una pressione prolungata,
         così la lista resta scorrevole anche sopra i blocchi */
      if (e.pointerType === "touch" && mode === "move") {
        var e0 = { pointerId:e.pointerId, clientY:e.clientY, pointerType:"touch" };
        hold = setTimeout(function(){ hold = null; attiva(e0, mode, it); }, 320);
        return;
      }
      attiva(e, mode, it);
    }
    function annulla(){
      if (hold) { clearTimeout(hold); hold = null; }
      el.style.touchAction = "";
      el.removeAttribute("data-drag");
    }
    el.addEventListener("pointerdown", function(e){ down(e, "move"); });
    var grip = el.querySelector(".grip");
    if (grip) grip.addEventListener("pointerdown", function(e){ down(e, "resize"); });
    el.addEventListener("pointermove", function(e){
      if (hold) { clearTimeout(hold); hold = null; }
      if (!drag || drag.el !== el) return;
      var dy = e.clientY - drag.y;
      if (Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      var it = itemById(drag.id);
      if (!it) return;
      if (drag.mode === "move") {
        /* converte la posizione in ore attraversando la mappa, così resta
           esatta anche sopra le fasce compresse */
        var ns = snap(hourAt(yOf(drag.start) + dy));
        it.start = Math.max(0, Math.min(24 - drag.dur, ns));
        el.style.top = (yOf(it.start)+1)+"px";
      } else {
        var ne = snap(hourAt(yOf(drag.start + drag.dur) + dy));
        it.dur = Math.max(0.25, Math.min(24 - drag.start, ne - drag.start));
        el.style.height = Math.max(yOf(it.start+it.dur)-yOf(it.start)-2,18)+"px";
      }
    });
    function up(){
      annulla();
      if (!drag || drag.el !== el) return;
      var moved = drag.moved, id = drag.id;
      drag = null; S.dragging = false;
      if (!moved) { flushPending(); S.editFrom = "agenda"; S.editId = S.editId === id ? null : id; render(); return; }
      commit();
    }
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", function(){ annulla(); drag = null; S.dragging = false; });
  });
}

