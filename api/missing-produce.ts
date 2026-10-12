// Shared REST storage for the app and the protected monitor. A separate
// dailyTasks document uses the existing family-code capability rules.
// updateTime preconditions prevent concurrent devices from losing changes.
type ShoppingItem = { id: string; name: string; kind: 'fruit' | 'veg' | 'other'; source: 'missing-report' | 'manual'; addedAt: number; bought: boolean; boughtAt: number | null };
type ShoppingDoc = { items: ShoppingItem[] };
async function loadShopping(url: string): Promise<{ doc: ShoppingDoc; version?: string }> {
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status === 404) return { doc: { items: [] } };
  if (!r.ok) throw new Error('לא ניתן לטעון את רשימת הקניות (' + r.status + ')');
  const data = await r.json();
  const doc = JSON.parse(data?.fields?.tasks?.stringValue || '{"items":[]}');
  if (!Array.isArray(doc.items)) throw new Error('נתוני רשימת הקניות אינם תקינים');
  return { doc, version: data.updateTime };
}
async function changeShopping(url: string, change: (doc: ShoppingDoc) => void): Promise<ShoppingDoc> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { doc, version } = await loadShopping(url);
    change(doc);
    if (doc.items.length > 500) throw new Error('הרשימה מלאה. יש לנקות פריטים שנקנו');
    const separator = url.includes('?') ? '&' : '?';
    const guard = version ? 'currentDocument.updateTime=' + encodeURIComponent(version) : 'currentDocument.exists=false';
    const r = await fetch(url + separator + guard, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { tasks: { stringValue: JSON.stringify(doc) }, updatedAt: { integerValue: String(Date.now()) } } }) });
    if (r.ok) return doc;
    if (![409, 412, 400].includes(r.status)) throw new Error('לא ניתן לשמור את רשימת הקניות (' + r.status + ')');
    const error = await r.json();
    if (!['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS'].includes(error?.error?.status)) throw new Error('לא ניתן לשמור את רשימת הקניות (' + r.status + ')');
  }
  throw new Error('הרשימה עודכנה במכשיר אחר. נסו שוב');
}
function addShoppingItem(doc: ShoppingDoc, name: string, kind: ShoppingItem['kind'], source: ShoppingItem['source']): void {
  const clean = name.trim();
  if (!clean || clean.length > 120) throw new Error('שם הפריט צריך להכיל 1 עד 120 תווים');
  const normalized = (s: string) => s.normalize('NFKC').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('he');
  if (doc.items.some(i => !i.bought && normalized(i.name) === normalized(clean))) return;
  doc.items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, name: clean, kind, source, addedAt: Date.now(), bought: false, boughtAt: null });
}

// Server-side monitor API for the missing fruit/veg reports (דיווחו שחסר).
// The kids' app stores reports in Firestore doc
// families/{code}/dailyTasks/missing-YYYY-MM-DD, field tasks = JSON string
// {"items":[{id,kind:'fruit'|'veg'|'other',name,childId,childName,at,notified,notifiedAt}]}.
// This route lets the monitor agent read that state (GET) and add an item to
// the shopping list / mark items notified (POST) without exposing writes to
// the public app. Protected by the MONITOR_TOKEN env var: Authorization: Bearer <token>
// only (no query-string token). Not linked from the public app.

const FIREBASE_API_KEY = 'AIzaSyBN4NhRe0bgOB80_MWszPNDlTMZMrzPqPo';
const FIREBASE_PROJECT_ID = 'kids-task-manager-fe682';
const DEFAULT_FAMILY_CODE = 'UHES-TWL7';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const pad = (n: number) => String(n).padStart(2, '0');

function dateKeyIL(d: Date): string {
  // The app keys docs by the family's local (Asia/Jerusalem) calendar date.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function docUrl(code: string, key: string): string {
  return `${FS_BASE}/families/${code}/dailyTasks/${key}?key=${FIREBASE_API_KEY}`;
}

type Missing = { id: string; kind: 'fruit' | 'veg' | 'other'; name: string; childId: string; childName: string; at: number; notified: boolean; notifiedAt: number | null };
type MissingDoc = { items: Missing[] };

async function loadMissing(code: string, dateKey: string): Promise<{ doc: MissingDoc; exists: boolean }> {
  const r = await fetch(docUrl(code, 'missing-' + dateKey));
  if (r.status === 404) return { doc: { items: [] }, exists: false };
  if (!r.ok) throw new Error('firestore read failed: ' + r.status);
  const d = await r.json();
  let o: any = {};
  try { o = JSON.parse(d?.fields?.tasks?.stringValue || '{}'); } catch { o = {}; }
  return { doc: { ...o, items: Array.isArray(o.items) ? o.items : [] }, exists: true };
}

async function saveMissing(code: string, dateKey: string, doc: MissingDoc): Promise<void> {
  const r = await fetch(docUrl(code, 'missing-' + dateKey), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        tasks: { stringValue: JSON.stringify(doc) },
        updatedAt: { integerValue: String(Date.now()) },
      },
    }),
  });
  if (!r.ok) throw new Error('firestore write failed: ' + r.status);
}

function authorized(req: any): boolean {
  const expected = process.env.MONITOR_TOKEN;
  if (!expected) return false;
  // Authorization: Bearer only - no ?token= query param (it lands in access logs).
  const h = (req.headers?.authorization as string) || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : '';
  return bearer.length > 0 && bearer === expected;
}

export default async function handler(req: any, res: any) {
  if (!process.env.MONITOR_TOKEN) {
    res.status(500).json({ ok: false, error: 'MONITOR_TOKEN not configured' });
    return;
  }
  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const code = (req.query?.code as string) || DEFAULT_FAMILY_CODE;
  const dateKey = (req.query?.date as string) || dateKeyIL(new Date());

  try {
    if (req.method === 'GET') {
      const { doc, exists } = await loadMissing(code, dateKey);
      res.status(200).json({
        ok: true,
        familyCode: code,
        date: dateKey,
        docExists: exists,
        count: doc.items.length,
        items: doc.items,
        unnotified: doc.items.filter(m => !m.notified),
        shoppingList: (await loadShopping(docUrl(code, 'shopping-current'))).doc.items,
      });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = body.action || 'add';
      if (action === 'addToShoppingList') {
        const name = String(body.name || '').trim();
        if (!name || name.length > 120) { res.status(400).json({ ok: false, error: 'name must contain 1-120 characters' }); return; }
        const kind = body.kind === 'fruit' || body.kind === 'veg' ? body.kind : 'other';
        const source = body.source === 'manual' ? 'manual' : 'missing-report';
        const shopping = await changeShopping(docUrl(code, 'shopping-current'), doc => addShoppingItem(doc, name, kind, source));
        res.status(200).json({ ok: true, shoppingList: shopping.items });
        return;
      }
      const { doc } = await loadMissing(code, dateKey);

      if (action === 'add') {
        const name = String(body.name || '').trim();
        if (!name) { res.status(400).json({ ok: false, error: 'name is required' }); return; }
        const kind = body.kind === 'fruit' || body.kind === 'veg' ? body.kind : 'other';
        const exists = doc.items.some(m => !m.notified && m.kind === kind && m.name === name);
        if (!exists) {
          doc.items.push({
            id: `${Date.now()}-monitor-0`,
            kind, name,
            childId: String(body.childId || 'monitor'),
            childName: String(body.childName || 'מערכת'),
            at: Date.now(), notified: false, notifiedAt: null,
          });
        }
        await saveMissing(code, dateKey, doc);
        res.status(200).json({ ok: true, date: dateKey, added: !exists, count: doc.items.length, items: doc.items });
        return;
      }

      if (action === 'markNotified') {
        const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
        if (!ids.length) { res.status(400).json({ ok: false, error: 'ids[] is required' }); return; }
        const now = Date.now();
        let marked = 0;
        doc.items.forEach(m => { if (ids.includes(m.id) && !m.notified) { m.notified = true; m.notifiedAt = now; marked++; } });
        await saveMissing(code, dateKey, doc);
        res.status(200).json({ ok: true, date: dateKey, marked, count: doc.items.length, items: doc.items });
        return;
      }

      res.status(400).json({ ok: false, error: 'unknown action (use add, markNotified or addToShoppingList)' });
      return;
    }

    res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: String(e?.message || e) });
  }
}
