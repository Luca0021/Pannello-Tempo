/* coda.js — coda delle modifiche offline (SYN-003).
   Ogni modifica locale viene registrata; quando la rete torna, la coda parte in
   ordine. Non si perde niente chiudendo il pannello, perché la coda vive
   accanto ai dati. */

function coda(){
  S.data.coda = Array.isArray(S.data.coda) ? S.data.coda : [];
  return S.data.coda;
}
function inCoda(){ return coda().length; }

/* Registra un'operazione. Operazioni identiche ravvicinate non si accumulano:
   salvare dieci volte lo stesso stato produce una sola voce. */
function accodaModifica(tipo, riferimento){
  var c = coda();
  var ultima = c[c.length-1];
  var adesso = Date.now();
  if (ultima && ultima.tipo === tipo && ultima.rif === riferimento &&
      adesso - ultima.quando < 4000) {
    ultima.quando = adesso;
    ultima.volte = (ultima.volte || 1) + 1;
    return;
  }
  c.push({ id: uid(), tipo: tipo, rif: riferimento || null, quando: adesso, tentativi: 0 });
  if (c.length > 300) S.data.coda = c.slice(-300);
  S.data.syncMeta = S.data.syncMeta || {};
  S.data.syncMeta.inAttesa = true;
}

function svuotaCoda(){
  S.data.coda = [];
  S.data.syncMeta = S.data.syncMeta || {};
  S.data.syncMeta.inAttesa = false;
  S.data.syncMeta.ultimaSync = new Date().toISOString();
}

/* Stato leggibile, richiesto da SYN-002: mai una sola icona. */
function statoSync(){
  if (!syncReady())
    return { id:"locale", testo:"Salvato su questo dispositivo",
             nota:"Nessun servizio collegato: i dati non escono da qui." };
  if (!Platform.rete.online())
    return { id:"offline", testo:"Senza rete",
             nota: inCoda() ? inCoda()+" modifiche in attesa: partiranno da sole quando torna la rete."
                            : "Le modifiche restano sul dispositivo." };
  if (sync.busy) return { id:"corso", testo:"Sincronizzazione in corso", nota:"" };
  if (sync.conflict)
    return { id:"conflitto", testo:"Versioni diverse",
             nota:"Il pannello ha trovato dati diversi altrove: scegli quale tenere." };
  if (sync.status === "errore")
    return { id:"errore", testo:"Errore di sincronizzazione",
             nota: sync.err ? sync.err.causa : "" };
  if (inCoda())
    return { id:"attesa", testo: inCoda()+(inCoda()===1?" modifica in attesa":" modifiche in attesa"),
             nota:"Partono al prossimo salvataggio." };
  return { id:"ok", testo:"Sincronizzato",
           nota: (S.data.syncMeta && S.data.syncMeta.ultimaSync)
             ? "Ultimo invio: "+oraDa(S.data.syncMeta.ultimaSync) : "" };
}
function oraDa(iso){
  try {
    var d = new Date(iso);
    return d.toLocaleDateString("it-IT",{day:"numeric",month:"short"})+" "+
           d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
  } catch (e) { return ""; }
}

/* Quando la rete torna, la coda riparte. Con attesa crescente sugli errori,
   per non martellare il servizio (SEC-008). */
var ATTESA_RIPROVA = 0;
function provaSvuotare(){
  if (!syncReady() || !Platform.rete.online() || !inCoda() || sync.busy) return;
  if (ATTESA_RIPROVA && Date.now() < ATTESA_RIPROVA) return;
  pushNow(true);
}
/* Gli ascoltatori si agganciano solo se l'ambiente li offre davvero: in un
   contesto senza `addEventListener` questo modulo interrompeva il caricamento
   di tutti quelli successivi, e la pagina restava bianca. */
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("online", function(){ ATTESA_RIPROVA = 0; provaSvuotare(); render(); });
  window.addEventListener("offline", function(){ render(); });
}
