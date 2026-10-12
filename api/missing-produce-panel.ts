// Minimal HTML panel for the missing-produce monitor API.
// Served at /api/missing-produce/panel (vercel.json rewrite). The page itself
// is public but shows nothing without a valid MONITOR_TOKEN: the token is
// entered in the password field (an agent fills it from the vault), kept in
// sessionStorage, and sent as Authorization: Bearer to /api/missing-produce.
// All data access goes through that API; wrong token => error, no data.
// Not linked from the public app.

const HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ניטור חוסרים ורשימת קניות</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 760px; margin: 24px auto; padding: 0 12px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  td, th { border: 1px solid #ccc; padding: 6px 8px; text-align: right; font-size: 14px; }
  input, select, button { font-size: 15px; padding: 10px; max-width: 100%; box-sizing: border-box; }
  .err { color: #b00; } .ok { color: #080; } .muted { color: #777; }
  #panel { display: none; }
</style>
</head>
<body>
<h2>🛒 ניטור חוסרים ורשימת קניות</h2>
<div id="login">
  <label>טוקן: <input type="password" id="token" size="40" autocomplete="off"></label>
  <button id="connect">התחבר</button>
  <p id="loginmsg" class="err"></p>
</div>
<div id="panel">
  <p class="muted" id="dateinfo"></p>
  <div id="content"></div>
  <h3>רשימת הקניות הנוכחית</h3><div id="shopping"></div>
  <h3>הוספה ידנית לרשימת הקניות</h3>
  <input id="newname" placeholder="שם הפריט (למשל 🍎 תפוח)">
  <select id="newkind">
    <option value="fruit">פרי</option>
    <option value="veg">ירק</option>
    <option value="other">אחר</option>
  </select>
  <button id="addbtn">הוסף</button>
  <p id="panelmsg"></p>
</div>
<script>
var API = '/api/missing-produce';
function tok() { return sessionStorage.getItem('mp_token') || ''; }
function msg(id, text, cls) { var e = document.getElementById(id); e.textContent = text; e.className = cls || ''; }
function api(path, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ 'Authorization': 'Bearer ' + tok() }, opts.headers || {});
  return fetch(path, opts);
}
function kindLabel(k) { return k === 'fruit' ? 'פרי' : k === 'veg' ? 'ירק' : 'אחר'; }
function render(d) {
  document.getElementById('dateinfo').textContent = 'תאריך: ' + d.date + ' | קוד משפחה: ' + d.familyCode;
  var c = document.getElementById('content'); c.replaceChildren();
  if (!d.items || !d.items.length) { var empty = document.createElement('p'); empty.textContent = 'אין דיווחי חוסרים להיום.'; c.appendChild(empty); }
  (d.items || []).forEach(function(m) {
    var row = document.createElement('div'); row.style.cssText = 'padding:12px;border-bottom:1px solid #ddd;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    var text = document.createElement('span'); text.textContent = m.name + ' | ' + kindLabel(m.kind) + ' | ' + (m.childName || '') + ' | ' + (m.notified ? 'טופל ✓' : 'ממתין'); row.appendChild(text);
    if (!m.notified) {
      var manual = m.childId === 'manual-shopping';
      var add = document.createElement('button'); add.textContent = 'הוסף לרשימת הקניות';
      add.onclick = function() { post({action:'addToShoppingList', name:m.name, kind:m.kind, source:'missing-report'}); }; if (!manual) row.appendChild(add);
      var mark = document.createElement('button'); mark.textContent = 'סמן כמטופל';
      mark.onclick = function() { post({action:'markNotified', ids:[m.id]}); }; row.appendChild(mark);
    }
    c.appendChild(row);
  });
  var shopping = document.getElementById('shopping'); shopping.replaceChildren();
  var items = (d.shoppingList || []).filter(function(i) { return !i.bought; });
  var list = document.createElement('ul');
  items.forEach(function(i) { var li = document.createElement('li'); li.textContent = i.name + ' (' + (i.source === 'manual' ? 'ידני' : 'דיווח חוסרים') + ')' + (i.addedAt ? ' | ' + new Date(i.addedAt).toLocaleString('he-IL', {timeZone:'Asia/Jerusalem'}) : ''); list.appendChild(li); });
  if (!items.length) { var empty = document.createElement('p'); empty.textContent = 'אין פריטים פתוחים ברשימת הקניות.'; shopping.appendChild(empty); } else shopping.appendChild(list);
}
function post(body) {
  msg('panelmsg', 'שומר...', 'muted');
  return api(API, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
    .then(function(r) { return r.json(); }).then(function(d) {
      if (!d.ok) throw new Error(d.error || 'שגיאה');
      msg('panelmsg', 'נשמר ✓', 'ok'); load(); return true;
    }).catch(function(e) { msg('panelmsg', 'שגיאה: ' + e.message, 'err'); return false; });
}

function load() {
  api(API).then(function(r) {
    if (r.status === 401) { throw new Error('unauthorized'); }
    return r.json();
  }).then(function(d) {
    if (!d.ok) throw new Error(d.error || 'שגיאה');
    document.getElementById('login').style.display = 'none';
    document.getElementById('panel').style.display = 'block';
    render(d);
  }).catch(function() {
    sessionStorage.removeItem('mp_token');
    document.getElementById('login').style.display = 'block';
    document.getElementById('panel').style.display = 'none';
    msg('loginmsg', 'הטוקן שגוי או שאין גישה. לא מוצגים נתונים.', 'err');
  });
}
document.getElementById('connect').onclick = function() {
  var v = document.getElementById('token').value.trim();
  if (!v) { msg('loginmsg', 'יש להזין טוקן', 'err'); return; }
  sessionStorage.setItem('mp_token', v);
  msg('loginmsg', '', '');
  load();
};
document.getElementById('addbtn').onclick = function() {
  var name = document.getElementById('newname').value.trim();
  var kind = document.getElementById('newkind').value;
  if (!name) { msg('panelmsg', 'יש להזין שם פריט', 'err'); return; }
  post({action:'addToShoppingList', name:name, kind:kind, source:'manual'}).then(function(ok) { if (ok) document.getElementById('newname').value = ''; });
};
if (tok()) load();
</script>
</body>
</html>`;

export default function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(HTML);
}
