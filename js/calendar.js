/* calendar.js — esportazione ICS
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- esportazione calendario ---------- */
function icsEsc(s){ return String(s).replace(/([\\;,])/g,"\\$1").replace(/\n/g,"\\n"); }
/* Lo standard conta gli ottetti, non i caratteri: con accenti e simboli
   una riga di 73 caratteri può superare il limite. */
function byteLen(x){
  var n = 0;
  for (var i = 0; i < x.length; i++) {
    var c = x.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xD800 && c <= 0xDBFF) ? 2 : 3;
  }
  return n;
}
function fold(l){
  if (byteLen(l) <= 74) return l;
  var out = [], cur = "", lim = 73;
  for (var i = 0; i < l.length; i++) {
    var ch = l[i];
    if (byteLen(cur + ch) > lim) { out.push(cur); cur = " "; lim = 72; }
    cur += ch;
  }
  if (cur.trim() !== "") out.push(cur);
  return out.join("\r\n");
}
function stampLocal(d){
  return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+"T"+
         pad(d.getHours())+pad(d.getMinutes())+"00";
}
/* Scorre i giorni finché non trova la prima occorrenza reale:
   funziona con giorni multipli, intervalli e fine mese. */
function firstOccurrence(item, ref){
  var d = new Date(ref); d.setHours(0,0,0,0);
  for (var k = 0; k < 400; k++) {
    if (onDay(item, d)) {
      var s = new Date(d);
      s.setHours(Math.floor(item.start), Math.round((item.start%1)*60), 0, 0);
      if (s >= ref) return s;
    }
    d.setDate(d.getDate() + 1);
  }
  var f = new Date(ref);
  f.setHours(Math.floor(item.start), Math.round((item.start%1)*60), 0, 0);
  return f;
}
function buildIcs(items, ref, seq, alarmMin){
  var dtstamp = new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  var L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pannello Tempo//IT//",
           "CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Pannello tempo"];
  items.forEach(function(item){
    var s = firstOccurrence(item, ref);
    var e = new Date(s.getTime() + (item.dur||0.5)*3600000);
    var rrule = item.freq === "once" ? null
      : item.freq === "daily" ? "FREQ=DAILY"+((item.every > 1) ? ";INTERVAL="+item.every : "")
      : item.freq === "yearly" ? "FREQ=YEARLY;BYMONTH="+(((item.mon===undefined)?0:item.mon)+1)+
                                 ";BYMONTHDAY="+(domOf(item) === 0 ? "-1" : domOf(item))
      : item.freq === "weekly" ? "FREQ=WEEKLY;BYDAY="+daysOf(item).map(function(n){ return ICSDAY[n]; }).join(",")+
                                 ((item.every > 1) ? ";INTERVAL="+item.every : "")
      : "FREQ=MONTHLY;BYMONTHDAY="+(domOf(item) === 0 ? "-1" : domOf(item));
    L.push("BEGIN:VEVENT","UID:"+item.id+"@pannello-tempo","DTSTAMP:"+dtstamp,
           "SEQUENCE:"+seq,"DTSTART:"+stampLocal(s),"DTEND:"+stampLocal(e));
    if (rrule) {
      if (validKey(item.fine)) rrule += ";UNTIL="+item.fine.replace(/-/g,"")+"T235959";
      L.push("RRULE:"+rrule);
    }
    var passi = (Array.isArray(item.steps) && item.steps.length)
      ? "Passi:\n" + item.steps.map(function(p){ return "- " + p.t; }).join("\n")
      : "";
    var desc = [item.note, passi, safeUrl(item.link) ? item.link : "",
                "Pannello tempo · "+AREAS[item.area].label].filter(Boolean).join("\n");
    L.push("SUMMARY:"+icsEsc(item.label), "CATEGORIES:"+AREAS[item.area].label,
           "DESCRIPTION:"+icsEsc(desc));
    if (item.place) L.push("LOCATION:"+icsEsc(item.place));
    if (safeUrl(item.link)) L.push("URL:"+item.link);
    var av = (item.alarm === undefined) ? String(alarmMin) : String(item.alarm);
    if (av !== "0") {
      L.push("BEGIN:VALARM","TRIGGER:-PT"+av+"M","ACTION:DISPLAY",
             "DESCRIPTION:"+icsEsc(item.label),"END:VALARM");
    }
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n");
}
function download(text, name, mime){
  try {
    var url = URL.createObjectURL(new Blob([text], { type: mime }));
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    return true;
  } catch (e) { return false; }
}

