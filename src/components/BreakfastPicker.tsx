import React, { useEffect, useState } from 'react';
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '../firebase';
import { CHILDREN } from '../data/tasksData';

// Breakfast pick for tomorrow. Opened from the mandatory evening task
// "breakfast_choice"; the task can only be completed through onDone, which
// fires only after one vegetable, one fruit, a bread type and at least one spread
// were chosen and saved. Choices are stored in the existing family-code
// Firestore sync as dailyTasks/breakfast-YYYY-MM-DD (same doc shape the
// rules already allow), so the evening parent summary can read them.

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const docUrl = (code: string, key: string) => `${FS_BASE}/families/${code}/dailyTasks/${key}?key=${FIREBASE_API_KEY}`;

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const VEG = ['🥒 מלפפון', '🍅 עגבנייה', '🥕 גזר', '🫑 פלפל', '🥬 חסה', '🥦 ברוקולי', '🥗 סלט ירקות'];
// Seasonal fruit (Israel), by month of the day the breakfast is for.
const FRUIT_BY_SEASON: Record<string, string[]> = {
  winter: ['🍌 בננה', '🍎 תפוח', '🍐 אגס', '🥝 קיווי', '🍇 ענבים'],
  spring: ['🍌 בננה', '🍎 תפוח', '🍐 אגס', '🥝 קיווי', '🍇 ענבים'],
  summer: ['🍌 בננה', '🍎 תפוח', '🍐 אגס', '🥝 קיווי', '🍇 ענבים'],
  autumn: ['🍌 בננה', '🍎 תפוח', '🍐 אגס', '🥝 קיווי', '🍇 ענבים'],
};
const SEASON_LABEL: Record<string, string> = { winter: 'חורף', spring: 'אביב', summer: 'קיץ', autumn: 'סתיו' };
const seasonOf = (d: Date) => { const m = d.getMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };
const BREAD = ['🌾 פיתה מקמח מלא 💚', '🫓 פיתה רגילה', '🍞 לחם מלא 💚', '🥪 טוסט'];
const SPREAD = ['🥑 אבוקדו 💚', '🧀 גבינה לבנה 💚', '🫒 טחינה 💚', '🧆 חומוס 💚', '🥚 ביצה קשה 💚', '🍳 חביתה', '🥜 חמאת בוטנים', '🧈 גבינת שמנת', '🍯 דבש', '🍫 שוקולד'];
const LUNCH = ['🍝 פסטה', '🍚 אורז עם עוף', '🍗 שניצל עם ירקות', '🍳 חביתה וסלט', '🥙 פיתה עם חומוס וסלט', '🍲 מרק'];

// Missing-items reports. Doc families/{code}/dailyTasks/missing-YYYY-MM-DD (date of report),
// field tasks = JSON string {"items":[{id,kind:'fruit'|'veg'|'other',name,childId,childName,at,notified:false,notifiedAt:null}]}.
// A watcher sends WhatsApp for items with notified===false, then PATCHes them to notified:true + notifiedAt.
type Missing = { id: string; kind: 'fruit' | 'veg' | 'other'; name: string; childId: string; childName: string; at: number; notified: boolean; notifiedAt: number | null };
async function loadMissing(code: string, dateKey: string): Promise<{ items: Missing[] }> {
  try {
    const r = await fetch(docUrl(code, 'missing-' + dateKey));
    if (!r.ok) return { items: [] };
    const d = await r.json();
    const o = JSON.parse(d?.fields?.tasks?.stringValue || '{}');
    return { ...o, items: Array.isArray(o.items) ? o.items : [] };
  } catch { return { items: [] }; }
}

type Pick = { veg: string; fruit: string; bread: string; spreads?: string[]; spread?: string; lunch?: string; specialRequest?: string; at: number };

async function loadDay(code: string, dateKey: string): Promise<Record<string, Pick>> {
  try {
    const r = await fetch(docUrl(code, 'breakfast-' + dateKey));
    if (!r.ok) return {};
    const d = await r.json();
    return JSON.parse(d?.fields?.tasks?.stringValue || '{}');
  } catch { return {}; }
}

export function BreakfastPicker({ childId, familyCode, onClose, onDone }: { childId: string; familyCode: string; onClose: () => void; onDone: () => void }) {
  const child = CHILDREN.find(c => c.id === childId);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = keyOf(tomorrow);
  const dayName = DAY_NAMES[tomorrow.getDay()];
  const needsLunch = childId === 'arava' && tomorrow.getDay() === 0;
  const [veg, setVeg] = useState(''); const [fruit, setFruit] = useState('');
  const [bread, setBread] = useState(''); const [spreads, setSpreads] = useState<string[]>([]);
  const [lunch, setLunch] = useState(''); const [specialRequest, setSpecialRequest] = useState('');
  const FRUIT = (() => { const base = FRUIT_BY_SEASON[seasonOf(tomorrow)]; return fruit && !base.includes(fruit) ? [...base, fruit] : base; })();
  const MISSING_VEG = VEG.filter(v => !v.includes('סלט'));
  const [missOpen, setMissOpen] = useState(false); const [missSel, setMissSel] = useState<string[]>([]);
  const [missOther, setMissOther] = useState(''); const [missMsg, setMissMsg] = useState(''); const [missSaving, setMissSaving] = useState(false);
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDay(familyCode, dateKey).then(d => {
      const p = d[childId]; if (!p) return;
      setVeg(p.veg || ''); setFruit(p.fruit || ''); setBread(p.bread || '');
      // Older entries stored one string in `spread`; continue displaying them.
      setSpreads(Array.isArray(p.spreads) ? p.spreads : (p.spread ? [p.spread] : []));
      setLunch(p.lunch || ''); setSpecialRequest(p.specialRequest || '');
    });
  }, []);

  const complete = !!(veg && fruit && bread && spreads.length > 0);

  const save = async () => {
    if (!complete) return;
    setSaving(true); setErr('');
    try {
      const fresh = await loadDay(familyCode, dateKey);
      const entry: Pick = { veg, fruit, bread, spreads, specialRequest, at: Date.now() };
      if (needsLunch && lunch) entry.lunch = lunch;
      fresh[childId] = entry;
      const r = await fetch(docUrl(familyCode, 'breakfast-' + dateKey), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { tasks: { stringValue: JSON.stringify(fresh) }, updatedAt: { integerValue: String(Date.now()) } } }),
      });
      if (!r.ok) throw new Error('save');
      onDone();
    } catch { setErr('לא הצלחנו לשמור, נסו שוב'); setSaving(false); }
  };

  const reportMissing = async () => {
    const todayKey = keyOf(new Date());
    const names: { kind: Missing['kind']; name: string }[] = [
      ...missSel.map(n => ({ kind: (FRUIT_BY_SEASON[seasonOf(tomorrow)].includes(n) ? 'fruit' : 'veg') as Missing['kind'], name: n })),
      ...(missOther.trim() ? [{ kind: 'other' as const, name: missOther.trim() }] : []),
    ];
    if (!names.length) return;
    setMissSaving(true); setMissMsg('');
    try {
      const doc = await loadMissing(familyCode, todayKey);
      names.forEach(({ kind, name }, i) => {
        const exists = doc.items.some(m => !m.notified && m.kind === kind && m.name === name);
        if (!exists) doc.items.push({ id: `${Date.now()}-${childId}-${i}`, kind, name, childId, childName: child?.name || childId, at: Date.now(), notified: false, notifiedAt: null });
      });
      const r = await fetch(docUrl(familyCode, 'missing-' + todayKey), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { tasks: { stringValue: JSON.stringify(doc) }, updatedAt: { integerValue: String(Date.now()) } } }),
      });
      if (!r.ok) throw new Error('save');
      setMissSel([]); setMissOther(''); setMissMsg('נשלח להורים ✓');
    } catch { setMissMsg('לא הצלחנו לשלוח, נסו שוב'); }
    setMissSaving(false);
  };

  const group = (title: string, items: string[], val: string, set: (v: string) => void) => (
    <div>
      <h4 className="font-bold text-[#5D4037] mb-1.5">{title} {val ? '✓' : ''}</h4>
      <div className="flex gap-1.5 flex-wrap">
        {items.map(i => (
          <button key={i} onClick={() => set(i)}
            className={`px-3 py-2 rounded-xl text-sm font-bold border ${val === i ? 'bg-[#6A7B42] text-white border-[#6A7B42]' : 'bg-white text-[#5D4037] border-[#D6CFC4]'}`}>{i}</button>
        ))}
      </div>
    </div>
  );

  const spreadGroup = (
    <div>
      <h4 className="font-bold text-[#5D4037] mb-1.5">🧈 סוג ממרח {spreads.length ? '✓' : ''}</h4>
      <div className="flex gap-1.5 flex-wrap">
        {SPREAD.map(i => {
          const selected = spreads.includes(i);
          return (
            <button key={i} onClick={() => setSpreads(selected ? spreads.filter(s => s !== i) : [...spreads, i])}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${selected ? 'bg-[#6A7B42] text-white border-[#6A7B42]' : 'bg-white text-[#5D4037] border-[#D6CFC4]'}`}>{i}</button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-3" dir="rtl">
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#D6CFC4] shadow-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#5D4037]">🥣 ארוחת הבוקר של {child?.name} ליום {dayName}</h3>
            <p className="text-xs text-[#8C8479]">חובה לבחור ירק, פרי, לחם ולפחות ממרח אחד. 💚 = בחירה בריאה במיוחד</p>
          </div>
          <button onClick={onClose} className="text-[#8C8479] text-xl px-2">✕</button>
        </div>
        {group('🥕 ירק (אחד)', VEG, veg, setVeg)}
        {group('🍎 פרי (אחד)', FRUIT, fruit, setFruit)}
        {group('🫓 סוג לחם', BREAD, bread, setBread)}
        {spreadGroup}
        {needsLunch && group('🍽️ ארוחת צהריים ליום ראשון', LUNCH, lunch, setLunch)}
        <div>
          <label htmlFor="breakfast-special-request" className="block font-bold text-[#5D4037] mb-1.5">משהו מיוחד</label>
          <textarea id="breakfast-special-request" value={specialRequest} onChange={e => setSpecialRequest(e.target.value)}
            rows={2} className="w-full rounded-xl border border-[#D6CFC4] bg-white px-3 py-2 text-sm text-[#5D4037]"
            placeholder="בקשה מיוחדת (לא חובה)" />
        </div>
        <div className="border-t border-[#D6CFC4] pt-3">
          <button onClick={() => setMissOpen(!missOpen)} className="w-full text-right font-bold text-[#5D4037]">🛒 חסרים פירות או ירקות בבית? {missOpen ? '▲' : '▼'}</button>
          {missOpen && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-[#8C8479]">פירות העונה ({SEASON_LABEL[seasonOf(tomorrow)]}) וירקות. סמנו מה חסר וההורים יקבלו הודעה.</p>
              <div className="flex gap-1.5 flex-wrap">
                {[...FRUIT_BY_SEASON[seasonOf(tomorrow)], ...MISSING_VEG].map(i => {
                  const sel = missSel.includes(i);
                  return <button key={i} onClick={() => setMissSel(sel ? missSel.filter(x => x !== i) : [...missSel, i])}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border ${sel ? 'bg-[#B5651D] text-white border-[#B5651D]' : 'bg-white text-[#5D4037] border-[#D6CFC4]'}`}>{i}</button>;
                })}
              </div>
              <input value={missOther} onChange={e => setMissOther(e.target.value)} placeholder="משהו אחר שחסר (לא חובה)"
                className="w-full rounded-xl border border-[#D6CFC4] bg-white px-3 py-2 text-sm text-[#5D4037]" />
              <button onClick={reportMissing} disabled={missSaving || (!missSel.length && !missOther.trim())}
                className={`w-full py-2 rounded-2xl font-bold text-white ${!missSaving && (missSel.length || missOther.trim()) ? 'bg-[#B5651D]' : 'bg-gray-300'}`}>{missSaving ? 'שולח...' : 'דווחו שחסר'}</button>
              {missMsg && <p className="text-sm text-[#5D4037]">{missMsg}</p>}
            </div>
          )}
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={!complete || saving}
          className={`w-full py-3 rounded-2xl font-bold text-white ${complete && !saving ? 'bg-[#6A7B42]' : 'bg-gray-300'}`}>
          {saving ? 'שומר...' : complete ? 'שמור וסיים ✓' : 'בחרו ירק, פרי, לחם וממרח'}
        </button>
      </div>
    </div>
  );
}
