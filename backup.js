/* backup.js — copie di sicurezza automatiche sul dispositivo (BCK-001).
   Vengono create prima di ogni operazione che può far perdere dati. Sono
   ruotate: le vecchie escono per non riempire lo spazio disponibile. */

var CHIAVE_BACKUP_AUTO = "pannello-tempo:backup";
var MAX_BACKUP = 5;

function elencoBackup(){
  try {
    var l = JSON.parse(Platform.archivio.leggi(CHIAVE_BACKUP_AUTO) || "[]");
    return Array.isArray(l) ? l : [];
  } catch (e) { return []; }
}

/* Impronta semplice per accorgersi di un backup troncato o corrotto. */
function impronta(testo){
  var h = 0x811c9dc5;
  for (var i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h.toString(16);
}

function salvaBackupAutomatico(motivo){
  var testo;
  try { testo = JSON.stringify(S.data); } catch (e) { return false; }
  var lista = elencoBackup();
  lista.push({ quando: new Date().toISOString(), motivo: String(motivo||"").slice(0,120),
               byte: testo.length, impronta: impronta(testo), dati: testo });
  while (lista.length > MAX_BACKUP) lista.shift();
  /* se lo spazio non basta, tolgo i più vecchi invece di fallire in silenzio */
  var tentativi = 0;
  while (tentativi++ < MAX_BACKUP) {
    if (Platform.archivio.scrivi(CHIAVE_BACKUP_AUTO, JSON.stringify(lista))) return true;
    if (lista.length <= 1) return false;
    lista.shift();
  }
  return false;
}

function backupIntegro(b){
  return !!(b && b.dati && b.impronta && impronta(b.dati) === b.impronta);
}

function ripristinaBackup(n){
  var lista = elencoBackup();
  var b = lista[n];
  if (!b) return { ok:false, motivo:"Copia non trovata." };
  if (!backupIntegro(b)) return { ok:false, motivo:"Questa copia risulta danneggiata e non viene applicata." };
  var d;
  try { d = JSON.parse(b.dati); } catch (e) { return { ok:false, motivo:"Copia illeggibile." }; }
  salvaBackupAutomatico("prima di un ripristino");
  snapshot("Hai ripristinato una copia del "+shortDate(b.quando.slice(0,10))+".",
           "Vuoi annullare il ripristino?");
  S.data = Object.assign(seed(), d);
  var m2 = migra(S.data);
  S.data = m2.dati;
  normalizeData();
  S.disegnoCompleto = "dataset-sostituito"; forzaProssimoCompleto();
  registraOperazione("ripristino", "copia del "+b.quando);
  commit();
  return { ok:true };
}
