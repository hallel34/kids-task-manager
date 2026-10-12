// Shared REST storage for the app and the protected monitor. A separate
// dailyTasks document uses the existing family-code capability rules.
// updateTime preconditions prevent concurrent devices from losing changes.
export type ShoppingItem = { id: string; name: string; kind: 'fruit' | 'veg' | 'other'; source: 'missing-report' | 'manual'; addedAt: number; bought: boolean; boughtAt: number | null };
export type ShoppingDoc = { items: ShoppingItem[] };
export async function loadShopping(url: string): Promise<{ doc: ShoppingDoc; version?: string }> {
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status === 404) return { doc: { items: [] } };
  if (!r.ok) throw new Error('לא ניתן לטעון את רשימת הקניות (' + r.status + ')');
  const data = await r.json();
  const doc = JSON.parse(data?.fields?.tasks?.stringValue || '{"items":[]}');
  if (!Array.isArray(doc.items)) throw new Error('נתוני רשימת הקניות אינם תקינים');
  return { doc, version: data.updateTime };
}
export async function changeShopping(url: string, change: (doc: ShoppingDoc) => void): Promise<ShoppingDoc> {
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
export function addShoppingItem(doc: ShoppingDoc, name: string, kind: ShoppingItem['kind'], source: ShoppingItem['source']): void {
  const clean = name.trim();
  if (!clean || clean.length > 120) throw new Error('שם הפריט צריך להכיל 1 עד 120 תווים');
  const normalized = (s: string) => s.normalize('NFKC').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('he');
  if (doc.items.some(i => !i.bought && normalized(i.name) === normalized(clean))) return;
  doc.items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, name: clean, kind, source, addedAt: Date.now(), bought: false, boughtAt: null });
}
