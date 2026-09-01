/* priorities.js — le priorità di oggi
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- priorità ---------- */
function norm3(v){
  if (!v) return { t:"", id:null, done:false };
  if (typeof v === "string") return { t:v, id:null, done:false };
  return { t:v.t||"", id:v.id||null, done:!!v.done };
}
function top3(){
  var t = S.data.top3 || {};
  var list = t.key === dk() ? (t.list||[]) : [];
  return [0,1,2].map(function(n){ return norm3(list[n]); });
}
function putTop3(list){ S.data.top3 = { key: dk(), list: list }; commit(); }
function prioIndex(item){
  var l = top3();
  for (var n = 0; n < 3; n++) if (l[n].id === item.id) return n;
  return -1;
}

