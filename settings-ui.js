/* settings-ui.js — le impostazioni, raccolte in otto sezioni (SET-001).
   Estratta da render.js (ARC-001). Ogni scheda finisce in un cassetto e i
   cassetti vengono concatenati nell'ordine richiesto: l'ordine visibile non
   dipende dall'ordine del codice.
   Dipende da: state.js (S, P, folded), modules.js (PROFILI, MODULI),
   fascia.js, privacy.js, backup.js, sync.js, plans.js, notifiche.js.
   Non conosce le altre aree della home. */

function zonaImpostazioni(){
  var d = S.data;
  var h = "";

  var SEZ = { uso:"", giornata:"", account:"", calendario:"", aspetto:"",
              backup:"", privacy:"", info:"" };
  var sezCorrente = "aspetto";           /* cassetto di destinazione predefinito */
  function inSezione(nome){ sezCorrente = nome; }
  /* `SEZ[sezCorrente] += x` continua a funzionare: intercetto l'assegnazione con una
     funzione al posto dell'operatore nei punti che ho toccato. */
  /* calendario */
  var timedCount = d.items.filter(function(i){ return typeof i.start === "number"; }).length;
  inSezione("uso");
  SEZ[sezCorrente] += '<div class="card"><h2 data-ico="impostazioni"><span>Come vuoi usare il pannello</span></h2>'+
       '<ul class="promessa">'+PROMESSA_PARTI.map(function(p){
      return '<li><b>'+esc(p.verbo)+'</b><span class="sub">'+esc(p.come)+'</span></li>';
    }).join("")+'</ul>'+
    '<p class="hint" style="margin-top:0">Scegli un punto di partenza. Poi puoi accendere o '+
       'spegnere ogni singola parte qui sotto: spegnerne una nasconde la sezione, '+
       '<b>non cancella i dati</b>.</p>'+
       /* SET-002 — i tre concetti sono diversi e vanno detti, altrimenti
          «modalità» e «profilo» sembrano la stessa cosa. */
       '<dl class="concetti">'+
       '<dt>Profilo</dt><dd>Il punto di partenza: accende un insieme di parti in un colpo solo.</dd>'+
       '<dt>Parti del pannello</dt><dd>Il controllo fine: ogni parte si accende e si spegne '+
       'da sola, e la tua scelta vince sul profilo.</dd>'+
       '<dt>Modalità</dt><dd>Quanto dettaglio mostrare <b>dentro</b> le parti attive. '+
       'Non decide quali parti esistono.</dd></dl>'+
       Object.keys(PROFILI).map(function(k3){
         var p3 = PROFILI[k3], sel = (pref("profilo") === k3);
         var ant = anteprimaProfilo(k3);
         return '<button type="button" class="profilo'+(sel?" scelto":"")+'" '+
           'data-act="profilo" data-v="'+k3+'" aria-pressed="'+sel+'">'+
           '<span class="pnome">'+esc(p3.nome)+(sel ? ' <span class="slot">attivo</span>' : '')+'</span>'+
           '<span class="sub">'+esc(p3.per)+
           (ant && !sel
             ? '<br><b>Sceglierlo:</b> '+
               (ant.accesi.length ? 'accende '+ant.accesi.length+
                  (ant.accesi.length===1?' parte':' parti') : '') +
               (ant.accesi.length && ant.spenti.length ? ', ' : '') +
               (ant.spenti.length ? 'spegne '+ant.spenti.length+
                  (ant.spenti.length===1?' parte':' parti') : '') +
               (!ant.accesi.length && !ant.spenti.length ? 'non cambia niente' : '') +
               (ant.scelteAzzerate ? '. Dimentica '+ant.scelteAzzerate+
                  (ant.scelteAzzerate===1?' scelta fatta a mano':' scelte fatte a mano') : '') +
               '. I dati non si toccano.'
             : '')+'</span></button>';
       }).join("")+
       (sceltePersonali()
         ? '<div class="row"><button class="tiny" data-act="preset-ripristina">'+
           'Torna al preset del profilo</button>'+
           '<span class="hint" style="margin:0;align-self:center">'+sceltePersonali()+
           (sceltePersonali()===1 ? ' parte è' : ' parti sono')+
           ' diversa dal profilo scelto.</span></div>'
         : '')+
       '<p class="lbl" style="margin:16px 0 6px">Le parti del pannello</p>'+
       '<ul class="linklist moduli">'+MODULI.map(function(mo){
         var att = moduloAttivo(mo.id);
         var dip = (mo.dipende || []).map(function(d){
           var md = modulo(d); return md ? md.nome : d;
         });
         var cons = att ? conseguenzeSpegnimento(mo.id) : null;
         return '<li><span class="txt">'+esc(mo.nome)+
           '<span class="sub">'+esc(mo.cosa)+
           (dip.length ? '<br><b>Richiede:</b> '+esc(dip.join(", ")) : '')+
           (cons ? '<br><b>Spegnendola:</b> '+esc(cons.testo) : '')+'</span></span>'+
           '<span class="acts">'+
           (mo.core
             ? '<span class="slot" title="Senza questa parte non esiste un pannello">sempre attiva</span>'
             : '<button class="tiny'+(att?" pos":"")+'" data-act="modulo" data-v="'+mo.id+'" '+
               'role="switch" aria-checked="'+att+'">'+(att ? "attiva" : "spenta")+'</button>')+
           '</span></li>';
       }).join("")+'</ul></div>';

  inSezione("aspetto");
  /* UI-002 — quanto rumore nello sfondo */
  SEZ.aspetto += '<div class="card"><h2 data-ico="impostazioni"><span>Sfondo e rumore visivo</span></h2>'+
    '<p class="hint" style="margin-top:0">Quanta trama vuoi dietro al testo. La griglia è '+
    'gradevole a colpo d\'occhio, ma è rumore costante: se leggi a lungo, «tinta unita» '+
    'stanca meno.</p>'+
    '<div class="row"><span class="lbl" id="sfl" style="align-self:center;margin:0">Sfondo</span>'+
    '<span class="seg" role="group" aria-labelledby="sfl">'+
    [["griglia","Griglia"],["carta","Carta"],["unito","Tinta unita"]].map(function(sf){
      var attivo = (pref("sfondo") || "griglia") === sf[0];
      return '<button data-act="sfondo" data-v="'+sf[0]+'" data-on="'+(attivo?1:0)+'" '+
             'aria-pressed="'+attivo+'">'+esc(sf[1])+'</button>';
    }).join("")+'</span></div>'+
    '<p class="hint">Se il tuo sistema chiede meno effetti visivi la trama viene tolta '+
    'comunque: la tua impostazione di sistema vale più di questa.</p></div>';


  SEZ[sezCorrente] += '<div class="card'+(folded("setrit") ? " chiusa" : "")+'">'+
       '<h2 data-ico="riepilogo" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setrit" '+
       'aria-expanded="'+(!folded("setrit"))+'"><span>Revisione e benessere</span>'+
       '<span class="caret">'+(folded("setrit") ? "▸" : "▾")+'</span></button></h2>'+
       '<div class="ctrls">'+
       '<div class="ctrl"><label class="lbl" for="stora">Chiusura di giornata alle</label>'+
       '<input type="time" id="stora" data-chg="set-chiusuraOra" value="'+esc(pref("chiusuraOra"))+'"></div>'+
       '<div class="ctrl"><label class="lbl" for="stgio">Revisione settimanale</label>'+
       '<select id="stgio" data-chg="set-revisioneGiorno">'+
       [0,1,2,3,4,5,6].map(function(g){
         return '<option value="'+g+'"'+(pref("revisioneGiorno")===g?" selected":"")+'>'+
                GIORNI_ESTESI[g].replace(/^(il|la) /,"")+'</option>';
       }).join("")+'</select></div></div>'+
       '<label class="riga-flag"><input type="checkbox" data-chg="set-chiusuraAttiva"'+
       (pref("chiusuraAttiva")?" checked":"")+'> Proponimi la chiusura automaticamente</label>'+
       '<label class="riga-flag"><input type="checkbox" data-chg="set-revisioneAttiva"'+
       (pref("revisioneAttiva")?" checked":"")+'> Proponimi la revisione settimanale</label>'+
       '<div class="ctrls" style="margin-top:12px">'+
       '<div class="ctrl"><label class="lbl" for="stsog">Segnala se il lavoro supera</label>'+
       '<select id="stsog" data-chg="set-sogliaLavoro">'+
       ['',50,60,70,75,80,90].map(function(x){
         return '<option value="'+x+'"'+((pref("sogliaLavoro")||"")==x?" selected":"")+'>'+
                (x===""?"mai":x+"%")+'</option>';
       }).join("")+'</select></div></div>'+
       '<p class="hint">La percentuale è calcolata sul <b>tempo pianificato registrato</b>: '+
       'le attività senza durata non entrano nel conteggio, a meno che tu non lo chieda.</p>'+
       '<div class="row"><button class="tiny" data-act="rv-apri">Vedi la settimana</button>'+
       '<button class="tiny" data-act="onb-apri">Rivedi la presentazione</button>'+
       (ciSonoDemo() ? '<button class="tiny danger" data-act="demo-togli">Togli i dati di esempio</button>' : '')+
       '</div></div>';

  inSezione("calendario");

  SEZ[sezCorrente] += '<div class="card'+(folded("setcal") ? " chiusa" : "")+'"><h2 data-ico="campana" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setcal" aria-expanded="'+(!folded("setcal"))+'"><span>Calendario e notifiche</span><span class="caret">'+(folded("setcal") ? '▸' : '▾')+'</span><span class="cnt">'+timedCount+' slot</span></button></h2>'+
       '<p class="hint" style="margin-top:0">Il pannello non può avvisarti quando è chiuso. '+
       'Esporta gli slot nel calendario: le notifiche le manda lui, anche a telefono bloccato.</p>'+
       '<div class="row"><select data-chg="alarm">'+
       [["0","Senza avviso"],["5","Avviso 5 min prima"],["10","Avviso 10 min prima"],
        ["15","Avviso 15 min prima"],["30","Avviso 30 min prima"]].map(function(o){
         return '<option value="'+o[0]+'"'+(S.ui.alarm===o[0]?" selected":"")+'>'+o[1]+'</option>';
       }).join("")+'</select><button class="add" data-act="ics">Aggiungi al calendario</button>'+
       (S.ics ? '<button class="add ghost" data-act="icshide">Nascondi testo</button>' : '')+
       '<span class="hint" style="margin:0;align-self:center">scarica un file .ics</span></div>'+
       (function(){
         var st = statoNotifiche();
         return '<p class="grp">Avvisi mentre il pannello è aperto</p>'+
           '<label class="riga-flag"><input type="checkbox" data-chg="set-notifiche"'+
           (pref("notificheAperto") ? " checked" : "")+(st.perche ? " disabled" : "")+
           '> Avvisami poco prima di un blocco</label>'+
           (st.perche ? '<p class="hint">'+esc(st.perche)+'</p>'
             : '<p class="hint">Funziona con il pannello aperto, anche in una scheda in '+
               'sottofondo. A pannello chiuso serve il calendario: nessuna pagina web può '+
               'programmarsi un avviso da sola.</p>')+
           (pref("notificheAperto")
             ? '<div class="ctrls"><div class="ctrl"><label class="lbl" for="antic">Quanto prima</label>'+
               '<select id="antic" data-chg="set-anticipo">'+[5,10,15,30].map(function(x){
                 return '<option value="'+x+'"'+((pref("notificheAnticipo")||10)===x?" selected":"")+
                        '>'+x+' minuti</option>';
               }).join("")+'</select></div></div>'
             : '');
       })();
  if (S.ics)
    SEZ[sezCorrente] += '<p class="hint">Se il download non parte, copia il testo e salvalo come <b>pannello-tempo.ics</b>.</p>'+
         '<textarea class="icsbox" readonly>'+esc(S.ics)+'</textarea>';
  SEZ[sezCorrente] += '</div>';

  /* sincronizzazione */
  if (modoAvanzato()) {
  inSezione("account");
  SEZ[sezCorrente] += '<div class="card'+(folded("setsync") ? " chiusa" : "")+'"><h2 data-ico="sync" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setsync" aria-expanded="'+(!folded("setsync"))+'"><span>Sincronizzazione</span><span class="caret">'+(folded("setsync") ? '▸' : '▾')+'</span><span class="cnt">'+
       /* SET-003 — nel riepilogo compare il testo leggibile, non l'identificativo */
       (syncReady() ? esc(testoStato(sync.status) || "In attesa")+(sync.at ? " · "+sync.at : "")
                    : "Non collegata")+
       '</span></button></h2>';
  /* il dettaglio dello stato: che cosa è successo e se devi fare qualcosa */
  if (!folded("setsync") && syncReady() && dettaglioStato(sync.status))
    SEZ[sezCorrente] += '<p class="hint statodett" data-livello="'+
      esc(statoLeggibile(sync.status).livello)+'">'+esc(dettaglioStato(sync.status))+'</p>';
  if (sync.err)
    SEZ[sezCorrente] += '<div class="errbox"><p class="errtit">'+esc(sync.err.titolo)+'</p>'+
           '<p class="errcausa">'+esc(sync.err.causa)+'</p>'+
           '<p class="errcosa"><b>Cosa fare:</b> '+esc(sync.err.cosa)+'</p>'+
           (sync.err.tecnico ? '<p class="errtec">'+esc(sync.err.tecnico)+'</p>' : '')+
           '<div class="row"><button class="tiny" data-act="syncprova">Verifica collegamento</button>'+
           '<button class="tiny" data-act="errchiudi">Chiudi</button></div></div>';
  if (sync.prova)
    SEZ[sezCorrente] += '<div class="provabox"><p class="lbl" style="margin:0 0 8px">Verifica del collegamento</p>'+
           '<ul class="provalist">'+sync.prova.passi.map(function(p){
             return '<li data-ok="'+(p.ok?1:0)+'"><span class="provaico">'+(p.ok?'✓':'✗')+'</span>'+
                    '<span><b>'+esc(p.nome)+'</b>'+(p.nota?'<span class="sub">'+esc(p.nota)+'</span>':'')+
                    '</span></li>';
           }).join("")+'</ul>'+
           (sync.prova.corso ? '<p class="hint">Verifica in corso…</p>'
                             : '<div class="row"><button class="tiny" data-act="syncprovachiudi">Chiudi</button></div>')+
           '</div>';
  if (!syncReady()) {
    if (accountDisponibile() && !syncReady()) {
      SEZ[sezCorrente] += '<p class="hint" style="margin-top:0">Entra con un account per ritrovare i tuoi dati '+
        'su telefono e computer. Non devi configurare niente.</p>'+
        '<div class="row"><input type="email" id="ac1" data-keep="ac1" placeholder="La tua email"></div>'+
        '<div class="row"><input type="password" id="ac2" data-keep="ac2" placeholder="Password (almeno 6 caratteri)">'+
        '<button class="add" data-act="account-entra">Entra</button>'+
        '<button class="add ghost" data-act="account-crea">Crea account</button></div>'+
        /* SEC-001 — «Resta collegato» è stato rimosso nella Release 2B.
           Conservare il token di rinnovo significa lasciarlo leggibile a
           qualunque script della pagina, e senza un server non esiste un posto
           più sicuro. Meglio dire che la sessione finisce, che offrire una
           persistenza che non possiamo proteggere. */
        '<p class="hint"><b>La sessione dura finché il pannello è aperto.</b> '+
        'Chiudendolo dovrai rientrare con la password: sul dispositivo non resta '+
        'nulla che permetta di rientrare al posto tuo. '+
        'Una sessione che sopravvive alla chiusura richiede un cookie protetto, '+
        'quindi un server, che questa installazione non ha.</p>'+
        '<p class="grp">Oppure collega un tuo servizio</p>';
    }
    SEZ[sezCorrente] += '<p class="hint" style="margin-top:0">Collega un servizio per ritrovare gli stessi dati su '+
         'telefono e computer. Le credenziali restano su questo dispositivo: non finiscono '+
         'nel file HTML né nei backup.</p>'+
         '<p class="hint"><b>Sulla chiave API:</b> quella di un progetto Firebase non è un '+
         'segreto. Identifica il progetto, non autorizza nulla: sono le regole di sicurezza '+
         'a decidere chi legge cosa, ed è per questo che la guida qui sotto ti fa pubblicare '+
         'una regola che lega ogni documento al suo proprietario. Puoi comunque limitare la '+
         'chiave al tuo dominio dalla console Google Cloud.</p>';
    SEZ[sezCorrente] += '<p class="hint" style="margin-top:0"><span role="button" tabindex="0" class="linkish" '+
         'data-act="fold" data-v="guidasync">'+(folded("guidasync") ? "▸" : "▾")+
         ' Come si prepara Firebase, passo per passo</span></p>';
    if (!folded("guidasync"))
      SEZ[sezCorrente] += '<ol class="guida">'+[
        "Vai su console.firebase.google.com e crea un progetto (nome libero).",
        "Nel progetto apri <b>Build → Firestore Database</b> e premi <b>Crea database</b>, modalità produzione, area europea.",
        "Apri <b>Build → Authentication → Sign-in method</b> e abilita <b>Email/Password</b>.",
        "Vai in <b>Authentication → Users → Add user</b> e crea un utente con una tua email e una password di almeno sei caratteri. Questo utente sei tu: non serve registrarsi da nessuna parte.",
        "Apri <b>⚙ Impostazioni progetto → Generali</b>. Copia l\'<b>ID progetto</b> (minuscole e trattini).",
        "Nella stessa pagina, in basso, sezione <b>Le tue app</b>: premi l\'icona web <b>&lt;/&gt;</b>, dai un nome, registra. Copia il valore di <b>apiKey</b>.",
        "In <b>Firestore → Rules</b> incolla la regola qui sotto e premi <b>Pubblica</b>.",
        "Torna qui, incolla chiave, ID progetto, email e password, e premi <b>Collega</b>. Poi usa <b>Verifica collegamento</b>."
      ].map(function(p){ return '<li>'+p+'</li>'; }).join("")+'</ol>'+
      '<textarea class="icsbox" readonly rows="8">rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /pannello/{uid} {\n      allow read, write: if request.auth != null && request.auth.uid == uid;\n    }\n  }\n}</textarea>';
    SEZ[sezCorrente] += '<div class="seg mini">'+[["gist","GitHub Gist"],["firebase","Firebase"]].map(function(p){
      return '<button data-act="provider" data-v="'+p[0]+'" aria-pressed="'+(sync.provider===p[0])+'" '+
             'data-on="'+(sync.provider===p[0]?1:0)+'">'+p[1]+'</button>';
    }).join("")+'</div>';
    if (sync.provider === "gist") {
      SEZ[sezCorrente] += '<div class="row"><input type="text" id="f1" data-keep="f1" placeholder="Identificativo del gist"></div>'+
           '<div class="row"><input type="password" id="f2" data-keep="f2" placeholder="Token GitHub (permesso gist)">'+
           '<button class="add" data-act="synclink">Collega</button></div>';
    } else {
      SEZ[sezCorrente] += '<div class="row"><input type="text" id="f1" data-keep="f1" placeholder="Chiave API del progetto (apiKey)"></div>'+
           '<div class="row"><input type="text" id="f2" data-keep="f2" placeholder="Identificativo progetto (projectId)"></div>'+
           '<div class="row"><input type="text" id="f3" data-keep="f3" placeholder="Email dell\'utente Firebase"></div>'+
           '<div class="row"><input type="password" id="f4" data-keep="f4" placeholder="Password">'+
           '<button class="add" data-act="synclink">Collega</button></div>';
    }
  } else if (sync.conflict) {
    SEZ[sezCorrente] += '<p class="warn" style="margin-top:0">I dati remoti sono stati modificati altrove e anche qui ci sono '+
         'modifiche non inviate. Scegli quale versione tenere: l\'altra andrà persa.</p>'+
         '<p class="hint">Versione remota salvata il '+
         esc(new Date(sync.conflict.savedAt||Date.now()).toLocaleString("it-IT"))+'.</p>'+
         '<div class="row"><button class="add" data-act="keeplocal">Tieni questo dispositivo</button>'+
         '<button class="add ghost" data-act="keepremote">Prendi la versione remota</button></div>';
  } else {
    SEZ[sezCorrente] += '<p class="hint" style="margin-top:0">'+providerName()+' · '+
         (sync.auto ? "automatica: ogni modifica parte dopo qualche secondo."
                    : "manuale: invii e scarichi quando vuoi tu.")+
         (sync.dirty ? " Ci sono modifiche non ancora inviate." : "")+'</p>'+
         '<div class="row"><button class="tiny" data-act="syncauto" data-on="'+(sync.auto?1:0)+'">'+
         (sync.auto ? "Automatica ✓" : "Automatica")+'</button>'+
         '<button class="tiny" data-act="syncpull">Scarica ora</button>'+
         '<button class="tiny" data-act="syncprova">Verifica</button>'+
         '<button class="tiny" data-act="syncpush">Invia ora</button>'+
         '<button class="tiny" data-act="syncoff">Scollega</button></div>';
  }
  SEZ[sezCorrente] += '</div>';
  }

  /* dati */
  var lb = d.lastBackup;
  var giorniBk = lb && validKey(lb)
    ? Math.round((new Date().setHours(0,0,0,0) - keyToDate(lb)) / 86400000) : null;
  var pz = S.data.pause || {};
  inSezione("aspetto");
  SEZ[sezCorrente] += '<div class="card'+(folded("setpausa") ? " chiusa" : "")+'"><h2 data-ico="pausa" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setpausa" aria-expanded="'+(!folded("setpausa"))+'"><span>Pausa</span><span class="caret">'+(folded("setpausa") ? '▸' : '▾')+'</span><span class="cnt">'+(inPausa() ? "attiva" : "")+'</span></button></h2>'+
       '<p class="hint" style="margin-top:0">Durante una pausa il pannello smette di segnalare '+
       'ritardi e non conta come mancate le abitudini saltate. La routine resta, semplicemente '+
       'non ti rimprovera.</p>'+
       '<div class="row"><label class="lbl" style="align-self:center;margin:0">Dal</label>'+
       '<input type="date" data-chg="p-from" value="'+esc(pz.from||"")+'">'+
       '<label class="lbl" style="align-self:center;margin:0">al</label>'+
       '<input type="date" data-chg="p-to" value="'+esc(pz.to||"")+'">'+
       (pz.from || pz.to ? '<button class="tiny" data-act="pclear2">togli</button>' : '')+
       '</div>'+
       '<div class="ctrls"><div class="ctrl"><label class="lbl">Motivo</label>'+
       '<select data-chg="p-motivo"><option value="">Nessuno</option>'+
       MOTIVI.map(function(o){
         return '<option value="'+o[0]+'"'+(pz.motivo===o[0]?" selected":"")+'>'+o[1]+'</option>';
       }).join("")+'</select></div>'+
       '<div class="ctrl"><label class="lbl">Sospendi</label>'+
       '<select data-chg="p-area"><option value="">Lavoro e vita</option>'+
       ['lavoro','vita'].map(function(a){
         return '<option value="'+a+'"'+(pz.area===a?" selected":"")+'>Solo '+AREAS[a].label+'</option>';
       }).join("")+'</select></div></div>'+
       '<p class="hint">In ferie di norma si sospende <b>solo il lavoro</b>: gli impegni personali '+
       'del viaggio continuano a comparire regolarmente.</p>'+
       '</div>';
  var daSost = contaLink(S.sostDa);
  if (modoAvanzato()) {
  inSezione("aspetto");
  SEZ[sezCorrente] += '<div class="card'+(folded("setind") ? " chiusa" : "")+'"><h2 data-ico="dati" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setind" aria-expanded="'+(!folded("setind"))+'"><span>Ho cambiato servizio</span><span class="caret">'+(folded("setind") ? '▸' : '▾')+'</span>'+
       '<span class="cnt">'+(S.sostDa ? daSost.length : "")+'</span></button></h2>'+
       '<p class="hint" style="margin-top:0">Se cambi banca o fornitore: sostituisce l\'indirizzo '+
       'in tutte le voci che lo contengono. L\'operazione è annullabile.</p>'+
       '<div class="row"><input type="text" data-keep="sost-da" data-chg="sost-da" '+
       'placeholder="Indirizzo attuale, anche parziale — es. bmedonline" value="'+esc(S.sostDa||"")+'"></div>'+
       '<div class="row"><input type="text" data-keep="sost-a" data-chg="sost-a" '+
       'placeholder="Nuovo indirizzo — es. https://www.nuovabanca.it" value="'+esc(S.sostA||"")+'"></div>'+
       (S.sostDa
         ? (daSost.length
             ? '<p class="hint">Verrà cambiato in <b>'+daSost.length+
               (daSost.length===1?' voce':' voci')+'</b>: '+
               esc(daSost.slice(0,4).map(function(i){ return i.label; }).join(", "))+
               (daSost.length>4 ? ' e altre '+(daSost.length-4) : '')+'.</p>'
             : '<p class="hint">Nessuna voce contiene questo indirizzo.</p>')
         : '')+
       '<div class="row"><button class="add" data-act="sostituisci">Sostituisci</button>'+
       (S.sostDa || S.sostA ? '<button class="add ghost" data-act="sostpulisci">Pulisci</button>' : '')+
       '</div></div>';
  }

  if (modoAvanzato()) {
  inSezione("aspetto");
  SEZ[sezCorrente] += '<div class="card'+(folded("setmod") ? " chiusa" : "")+'">'+
    '<h2 data-ico="ripeti" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setmod" '+
    'aria-expanded="'+(!folded("setmod"))+'"><span>Modelli di giornata</span>'+
    '<span class="caret">'+(folded("setmod") ? "▸" : "▾")+'</span>'+
    '<span class="cnt">'+(S.data.modelli||[]).length+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0">Salva la forma di una giornata tipo e riapplicala '+
    'quando serve. Applicare un modello <b>non crea doppioni</b>: le voci già presenti '+
    'vengono saltate.</p>'+
    '<div class="row"><input type="text" id="modnome" data-keep="modnome" '+
    'placeholder="Nome del modello (es. Giornata in ufficio)">'+
    '<button class="add" data-act="mod-salva">Salva questa giornata</button></div>';
  if ((S.data.modelli||[]).length)
    SEZ[sezCorrente] += '<ul class="linklist">'+S.data.modelli.map(function(md){
      var ant = anteprimaModello(md.id, S.cursorKey);
      return '<li><span class="txt">'+esc(md.nome)+
        '<span class="sub">'+md.voci.length+(md.voci.length===1?" voce":" voci")+
        (md.priorita.length ? " · "+md.priorita.length+" priorità" : "")+
        (ant ? " · qui creerebbe "+ant.nuove.length+" e salterebbe "+ant.gia.length : "")+
        '</span></span><span class="acts">'+
        '<button class="tiny pos" data-act="mod-applica" data-id="'+md.id+'">applica</button>'+
        '<button class="tiny" data-act="mod-duplica" data-id="'+md.id+'">duplica</button>'+
        '<button class="tiny danger" data-act="mod-elimina" data-id="'+md.id+'">×</button>'+
        '</span></li>';
    }).join("")+'</ul>';
  else
    SEZ[sezCorrente] += '<p class="empty">Nessun modello salvato.</p>';
  SEZ[sezCorrente] += '</div>';

  inSezione("aspetto");

  SEZ[sezCorrente] += '<div class="card'+(folded("setics") ? " chiusa" : "")+'">'+
    '<h2 data-ico="prossimi" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setics" '+
    'aria-expanded="'+(!folded("setics"))+'"><span>Importa dal calendario</span>'+
    '<span class="caret">'+(folded("setics") ? "▸" : "▾")+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0">Scegli un file <b>.ics</b> esportato dal tuo '+
    'calendario: te ne mostro il contenuto e scegli tu cosa importare. '+
    'Il file viene letto sul dispositivo e non esce da qui.</p>'+
    '<div class="row"><button class="add ghost" data-act="ics-scegli">Scegli un file</button>'+
    '<input type="file" id="icsfile" accept="text/calendar,.ics" style="display:none">'+
    '<span class="hint" style="margin:0;align-self:center">Il collegamento diretto con '+
    'Google o Microsoft richiede un servizio account che questa versione non ha.</span></div>';
  if (S.icsAnteprima) {
    var ev = S.icsAnteprima.eventi;
    SEZ[sezCorrente] += '<p class="grp">'+ev.length+(ev.length===1?" evento trovato":" eventi trovati")+
      (S.icsAnteprima.scartati ? " · "+S.icsAnteprima.scartati+" righe non leggibili" : "")+'</p>'+
      '<ul class="linklist">'+ev.map(function(e, n){
        return '<li><span class="lgrip">'+
          '<input type="checkbox" data-chg="ics-scelto" data-n="'+n+'"'+
          (e.scelto?" checked":"")+(e.esisteGia?" disabled":"")+
          ' aria-label="Importa '+esc(e.titolo)+'"></span>'+
          '<span class="txt">'+esc(e.titolo)+'<span class="sub">'+esc(shortDate(e.inizio))+
          (e.ora !== null ? " · "+esc(fmt(e.ora)) : "")+
          (e.esisteGia ? " · già presente" : "")+'</span></span>'+
          '<span class="acts"><select data-chg="ics-area" data-n="'+n+'">'+
          ["lavoro","vita"].map(function(a){
            return '<option value="'+a+'"'+(e.area===a?" selected":"")+'>'+AREAS[a].label+'</option>';
          }).join("")+'</select></span></li>';
      }).join("")+'</ul>'+
      '<div class="row"><button class="add" data-act="ics-importa">Importa i selezionati</button>'+
      '<button class="tiny" data-act="ics-annulla">annulla</button></div>';
  }
  SEZ[sezCorrente] += '</div>';

  inSezione("aspetto");

  SEZ[sezCorrente] += '<div class="card'+(folded("setpiano") ? " chiusa" : "")+'">'+
    '<h2 data-ico="impostazioni" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setpiano" '+
    'aria-expanded="'+(!folded("setpiano"))+'"><span>Piano</span>'+
    '<span class="caret">'+(folded("setpiano") ? "▸" : "▾")+'</span>'+
    '<span class="cnt">'+esc(PIANI[pianoAttivo()].nome)+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0">In questa installazione <b>nessuna funzione è '+
    'bloccata</b>: non esiste un sistema di pagamento collegato, quindi sarebbe un muro '+
    'senza porta. I piani qui sotto descrivono come sarà organizzato.</p>'+
    Object.keys(PIANI).map(function(k2){
      var p2 = PIANI[k2];
      return '<div class="onbriga"><span class="onbnome">'+esc(p2.nome)+
        '<span class="sub">'+esc(p2.prezzo)+(p2.periodo ? " "+esc(p2.periodo) : "")+
        (p2.promessa ? '<br>'+esc(p2.promessa) : '')+'</span></span>'+
        (k2 === pianoAttivo() ? '<span class="slot">attivo</span>' : '')+'</div>';
    }).join("")+
    '<p class="hint">Riservate al Premium: '+esc(FUNZIONI_PREMIUM.join(", ").replace(/-/g," "))+'.</p>'+
    '</div>';
  }

  inSezione("info");
  /* la guida, raggiungibile da dentro il pannello */
  SEZ.info += '<div class="card"><h2 data-ico="appunti"><span>Guida</span></h2>'+
    '<p class="hint" style="margin-top:0">Come funziona il pannello, che cosa fa e '+
    'che cosa non fa. È generata dal pannello stesso: se una funzione cambia nome, '+
    'cambia anche lì.</p>'+
    '<div class="row"><button class="add ghost" data-act="guida" data-v="">Apri la guida</button>'+
    '</div></div>';


  SEZ[sezCorrente] += '<div class="card'+(folded("setinfo") ? " chiusa" : "")+'">'+
    '<h2 data-ico="impostazioni" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setinfo" '+
    'aria-expanded="'+(!folded("setinfo"))+'"><span>Informazioni sull\'app</span>'+
    '<span class="caret">'+(folded("setinfo") ? "▸" : "▾")+'</span>'+
    '<span class="cnt">'+esc(BUILD.app)+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0">'+esc(PROMESSA)+'</p>'+
    '<ul class="linklist">'+[
      ["Versione", BUILD.app],
      ["Impronta dei sorgenti", BUILD.sorgenti],
      ["Commit", BUILD.commit || "non disponibile (fuori da un repository)"],
      ["Schema dati", "v"+BUILD.schema],
      ["Cache del service worker", BUILD.cache],
      ["Costruito il", BUILD.costruito]
    ].map(function(x){
      return '<li><span class="txt">'+esc(x[0])+'</span>'+
             '<span class="acts"><code class="tec">'+esc(String(x[1]))+'</code></span></li>';
    }).join("")+'</ul>'+
    '<div class="row"><button class="tiny" data-act="copia-info">Copia queste informazioni</button>'+
    '<span class="hint" style="margin:0;align-self:center">utile per segnalare un problema: '+
    'non contiene alcun dato personale</span></div>'+
    '<p class="hint">Confronta l\'impronta con quella del file <code class="tec">build.json</code> '+
    'pubblicato accanto al pannello: se coincidono, stai usando la build che credi.</p></div>';

  inSezione("privacy");

  SEZ[sezCorrente] += '<div class="card'+(folded("setpriv") ? " chiusa" : "")+'">'+
    '<h2 data-ico="dati" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setpriv" '+
    'aria-expanded="'+(!folded("setpriv"))+'"><span>Privacy e dati</span>'+
    '<span class="caret">'+(folded("setpriv") ? "▸" : "▾")+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0"><b>Dove stanno i tuoi dati.</b> Nella memoria di '+
    'questo browser, su questo dispositivo. '+
    (syncReady()
      ? 'In più vengono inviati al servizio che hai collegato tu: '+
        esc(sync.provider === "gist" ? "il tuo Gist su GitHub" : "il tuo progetto Firebase")+'.'
      : 'Non esiste alcun server nostro che li riceva, perché non esiste alcun server nostro.')+
    '</p>'+
    '<p class="grp">Porta via i tuoi dati</p>'+
    '<p class="hint" style="margin-top:0">Sempre disponibile, in ogni piano. Le esportazioni '+
    'non contengono credenziali.</p>'+
    '<div class="row">'+
    '<button class="tiny" data-act="exp-json">Tutto (JSON)</button>'+
    '<button class="tiny" data-act="exp-csv">Attività (CSV)</button>'+
    '<button class="tiny" data-act="exp-ics">Impegni (ICS)</button></div>'+
    '<p class="grp">Analisi personali</p>'+
    '<label class="riga-flag"><input type="checkbox" data-chg="set-analisi"'+
    (analisiAttive() ? " checked" : "")+'> Fammi notare gli schemi che emergono dai miei dati</label>'+
    '<p class="hint">Il calcolo avviene su questo dispositivo e non esce da qui. '+
    'Ogni osservazione dichiara su quanti dati si basa. Spegnendola il pannello continua '+
    'a funzionare in tutto il resto.</p>'+
    (analisiAttive()
      ? '<ul class="linklist">'+datiUsatiDalleAnalisi().map(function(x){
          return '<li><span class="txt">'+esc(x.nome)+'<span class="sub">'+esc(x.cosa)+'</span></span>'+
                 '<span class="acts"><span class="slot">'+x.quante+'</span></span></li>';
        }).join("")+'</ul>'
      : '')+
    '<p class="grp">Cancella</p>'+
    '<div class="row">'+
    '<button class="tiny" data-act="del-cronologia">Cancella la cronologia</button>'+
    '<button class="tiny danger" data-act="del-tutto">Cancella tutto</button></div>'+
    '<p class="hint">«Cancella la cronologia» toglie completamenti, chiusure e analisi e '+
    'lascia attività e routine. «Cancella tutto» rimuove dati, credenziali e copie di '+
    'sicurezza da questo dispositivo: prima ti chiedo conferma e ti dico cosa succede.</p>'+
    '</div>';

  /* AGD-001 — fascia attiva della giornata */
  inSezione("giornata");
  SEZ[sezCorrente] += '<div class="card'+(folded("setfascia") ? " chiusa" : "")+'" id="setfascia">'+
    '<h2 data-ico="agenda" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setfascia" '+
    'aria-expanded="'+(!folded("setfascia"))+'"><span>La tua giornata</span>'+
    '<span class="caret">'+(folded("setfascia") ? "▸" : "▾")+'</span>'+
    '<span class="cnt">'+esc(fmt(fasciaDi(cursor()).da))+'–'+esc(fmt(fasciaDi(cursor()).a))+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0">Da che ora a che ora conta il tuo tempo. Serve a '+
    'calcolare quanto ne hai davvero: prima il pannello contava le ventiquattr\'ore e '+
    'annunciava ore libere che non esistevano.</p>'+
    (function(){
      var f = pref("fascia") || {};
      var da = (typeof f.da === "number") ? f.da : FASCIA_PREDEFINITA.da;
      var a  = (typeof f.a  === "number") ? f.a  : FASCIA_PREDEFINITA.a;
      var out = '<div class="ctrls">'+
        '<div class="ctrl"><label class="lbl" for="fda">Comincio alle</label>'+
        '<input type="time" id="fda" data-keep="fda" step="900" value="'+esc(oraHHMM(da))+'"></div>'+
        '<div class="ctrl"><label class="lbl" for="fa">Finisco alle</label>'+
        '<input type="time" id="fa" data-keep="fa" step="900" value="'+esc(oraHHMM(a))+'"></div>'+
        '<div class="ctrl"><label class="lbl">&nbsp;</label>'+
        '<button class="add" data-act="fascia-salva">Salva</button></div></div>'+
        '<p class="grp">Giorni con orari diversi</p><ul class="linklist">';
      [1,2,3,4,5,6,0].forEach(function(g){
        var ecc = f.giorni && f.giorni[g];
        out += '<li><span class="txt">'+esc(GIORNI_LUNGHI[g])+
          '<span class="sub">'+(ecc ? esc(fmt(ecc.da))+"–"+esc(fmt(ecc.a))
                                    : "come il resto della settimana")+'</span></span>'+
          '<span class="acts">'+
          '<input type="time" step="900" data-chg="fg-da" data-n="'+g+'" '+
          'value="'+esc(oraHHMM(ecc ? ecc.da : da))+'" aria-label="Inizio di '+esc(GIORNI_LUNGHI[g])+'">'+
          '<input type="time" step="900" data-chg="fg-a" data-n="'+g+'" '+
          'value="'+esc(oraHHMM(ecc ? ecc.a : a))+'" aria-label="Fine di '+esc(GIORNI_LUNGHI[g])+'">'+
          (ecc ? '<button class="tiny" data-act="fascia-azzera" data-n="'+g+'">togli</button>' : '')+
          '</span></li>';
      });
      return out + '</ul>';
    })()+
    '<p class="hint">'+esc(tempoTesto(cursor()))+'</p></div>';

  /* PRV-001 — privacy e dati */
  SEZ[sezCorrente] += '<div class="card'+(folded("setpriv") ? " chiusa" : "")+'">'+
    '<h2 data-ico="dati" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setpriv" '+
    'aria-expanded="'+(!folded("setpriv"))+'"><span>Privacy e dati</span>'+
    '<span class="caret">'+(folded("setpriv") ? "▸" : "▾")+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0"><b>Dove stanno i tuoi dati.</b> Nella memoria di '+
    'questo browser. '+(syncReady()
      ? 'In più vengono inviati al servizio che hai collegato tu.'
      : 'Non esiste alcun server nostro che li riceva.')+'</p>'+
    '<p class="grp">Porta via i tuoi dati</p>'+
    '<div class="row"><button class="tiny" data-act="exp-json">Tutto (JSON)</button>'+
    '<button class="tiny" data-act="exp-csv">Attività (CSV)</button>'+
    '<button class="tiny" data-act="exp-ics">Impegni (ICS)</button></div>'+
    '<p class="grp">Analisi personali</p>'+
    '<label class="riga-flag"><input type="checkbox" data-chg="set-analisi"'+
    (analisiAttive() ? " checked" : "")+'> Fammi notare gli schemi che emergono dai miei dati</label>'+
    '<p class="hint">Il calcolo avviene su questo dispositivo. Ogni osservazione dichiara su '+
    'quanti dati si basa.</p>'+
    '<p class="grp">Cancella</p>'+
    '<div class="row"><button class="tiny" data-act="del-cronologia">Cancella la cronologia</button>'+
    '<button class="tiny danger" data-act="del-tutto">Cancella tutto</button></div></div>';


  inSezione("backup");
  /* BCK-002 — le azioni distruttive, ciascuna con il proprio effetto */
  SEZ.backup += '<div class="card'+(folded("setdistr") ? " chiusa" : "")+'">'+
    '<h2 data-ico="ritardo" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setdistr" '+
    'aria-expanded="'+(!folded("setdistr"))+'"><span>Rimuovere e ripristinare</span>'+
    '<span class="caret">'+(folded("setdistr") ? "▸" : "▾")+'</span></button></h2>'+
    '<p class="hint" style="margin-top:0">Sei comandi distinti, non un «ripristina» generico: '+
    'ognuno dice che cosa toglie e che cosa lascia.</p>'+
    '<ul class="linklist distruttive">'+AZIONI_DISTRUTTIVE.map(function(a){
      return '<li><span class="txt">'+esc(a.nome)+
        '<span class="sub"><b>Elimina:</b> '+esc(a.elimina)+'<br>'+
        '<b>Conserva:</b> '+esc(a.conserva)+
        (a.backup ? '<br><b>Copia di sicurezza</b> prima di procedere.' : '')+
        (a.annullabile ? ' Annullabile.' : '')+'</span></span>'+
        '<span class="acts"><button class="tiny'+(a.conferma === 3 ? " danger" : "")+'" '+
        'data-act="distr" data-v="'+a.id+'">'+
        (a.conferma === 3 ? "Elimina" : a.conferma === 2 ? "Procedi" : "Fai")+'</button></span></li>';
    }).join("")+'</ul></div>';


  SEZ[sezCorrente] += '<div class="card'+(folded("setdati") ? " chiusa" : "")+'"><h2 data-ico="dati" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="setdati" aria-expanded="'+(!folded("setdati"))+'"><span>Backup e ripristino</span><span class="caret">'+(folded("setdati") ? '▸' : '▾')+'</span><span class="cnt">'+d.items.length+' voci</span></button></h2>'+
       '<p class="hint" style="margin-top:0">Tutto è salvato su questo dispositivo. '+
       'Per spostarlo su un altro, esporta il file e importalo là.</p>'+
       (!syncReady() && (giorniBk === null || giorniBk >= 14)
         ? '<p class="warn">'+(giorniBk === null
             ? "Non hai mai fatto un backup e la sincronizzazione non è attiva: i dati vivono solo in questo browser."
             : "Ultimo backup "+giorniBk+" giorni fa.")+'</p>' : '')+
       (giorniBk !== null ? '<p class="hint">Ultimo backup: '+esc(shortDate(lb))+'.</p>' : '')+
       '<div class="row"><label class="lbl" style="align-self:center;margin:0">Città predefinita</label>'+
       '<input type="text" data-keep="city" data-chg="city" value="'+esc(d.city||"")+'" '+
       'placeholder="Es. Milano" style="min-width:120px">'+
       '<span class="hint" style="margin:0;align-self:center">completa i luoghi indicati col solo nome</span></div>'+
       '<div class="row"><button class="add" data-act="export">Esporta backup</button>'+
       '<button class="add ghost" data-act="wipe">Svuota tutto</button>'+
       '<button class="add ghost" data-act="importclick">Importa backup</button>'+
       '<input type="file" id="importfile" accept="application/json,.json" style="display:none"></div></div>';


  h += '<!--Z:settings-->';
  h += '<div class="card setcard"><h2 data-ico="impostazioni" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="settings" '+
       'aria-expanded="'+(!folded("settings"))+'">'+
       '<span>Impostazioni</span>'+
       '<span class="caret">'+(folded("settings") ? '▸' : '▾')+'</span></button></h2>'+
       (folded("settings")
         ? '<p class="hint" style="margin:0">Calendario e notifiche · sincronizzazione · pausa · backup e dati</p>'
         : '')+'</div>';
  if (!folded("settings")) {
    var ORDINE_SEZ = [
      ["uso",        "1. Modalità d'uso",              "Il punto di partenza e le parti del pannello che vuoi vedere."],
      ["giornata",   "2. La tua giornata",             "Da che ora a che ora conta il tuo tempo."],
      ["account",    "3. Account e sincronizzazione",  "Dove finiscono i dati, se scegli di ritrovarli altrove."],
      ["calendario", "4. Calendario e notifiche",      "Promemoria nel calendario e avvisi a pannello aperto."],
      ["aspetto",    "5. Aspetto e strumenti",         "Tema, modelli, importazioni, collegamenti, pausa."],
      ["backup",     "6. Backup e dati",               "Copie di sicurezza, esportazioni, ripristino."],
      ["privacy",    "7. Privacy",                     "Che cosa viene salvato, dove, e come cancellarlo."],
      ["info",       "8. Informazioni sull'app",       "Versione, impronta della build, schema dei dati."]
    ];
    ORDINE_SEZ.forEach(function(s){
      if (!SEZ[s[0]]) return;            /* una sezione vuota non si annuncia */
      h += '<p class="sezione">'+esc(s[1])+'<span>'+esc(s[2])+'</span></p>'+SEZ[s[0]];
    });
  }
  return h;
}
