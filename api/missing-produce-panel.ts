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
<title>ניטור חוסרים - פירות וירקות</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 640px; margin: 24px auto; padding: 0 12px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  td, th { border: 1px solid #ccc; padding: 6px 8px; text-align: right; font-size: 14px; }
  input, select, button { font-size: 15px; padding: 6px 8px; }
  .err { color: #b00; } .ok { color: #080; } .muted { color: #777; }
  #panel { display: none; }
</style>
</head>
<body>
<h2>🛒 ניטור חוסרים בבית</h2>
<div id="login">
  <label>טוקן: <input type="password" id="token" size="40" autocomplete="off"></label>
  <button id="connect">התחבר</button>
  <p id="loginmsg" class="err"></p>
</div>
<div id="panel">
  <p class="muted" id="dateinfo"></p>
  <div id="content"></div>
  <h3>הוספת פריט</h3>
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
  var c = document.getElementById('content');
  if (!d.docExists || !d.items || !d.items.length) {
    c.innerHTML = '<p class="muted">אין דיווחי חוסרים להיום.</p>';
    return;
  }
  var h = '<table><tr><th>שם</th><th>סוג</th><th>ילד</th><th>סטטוס</th><th></th></tr>';
  d.items.forEach(function(m) {
    h += '<tr><td>' + m.name + '</td><td>' + kindLabel(m.kind) + '</td><td>' + (m.childName || '') + '</td><td>' +
      (m.notified ? 'טופל ✓' : 'ממתין') + '</td><td>' +
      (m.notified ? '' : '<button data-id="' + m.id + '" class="markbtn">סמן כמטופל</button>') + '</td></tr>';
  });
  c.innerHTML = h + '</table>';
  var btns = document.querySelectorAll('.markbtn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].onclick = function() {
      var id = this.getAttribute('data-id');
      msg('panelmsg', 'מסמן...', 'muted');
      api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markNotified', ids: [id] }) })
        .then(function(r) { return r.json(); })
        .then(function(d2) { msg('panelmsg', d2.ok ? 'סומן ✓' : 'שגיאה: ' + (d2.error || ''), d2.ok ? 'ok' : 'err'); load(); })
        .catch(function(e) { msg('panelmsg', 'שגיאה: ' + e, 'err'); });
    };
  }
}
function load() {
  api(API).then(function(r) {
    if (r.status === 401) { throw new Error('unauthorized'); }
    return r.json();
  }).then(function(d) {
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
  msg('panelmsg', 'מוסיף...', 'muted');
  api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', name: name, kind: kind }) })
    .then(function(r) { return r.json(); })
    .then(function(d2) { msg('panelmsg', d2.ok ? 'נוסף ✓' : 'שגיאה: ' + (d2.error || ''), d2.ok ? 'ok' : 'err'); document.getElementById('newname').value = ''; load(); })
    .catch(function(e) { msg('panelmsg', 'שגיאה: ' + e, 'err'); });
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
