import React, { useEffect, useState } from 'react';
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '../firebase';
import { CHILDREN } from '../data/tasksData';

// Breakfast pick for tomorrow. Opened from the mandatory evening task
// "breakfast_choice"; the task can only be completed through onDone, which
// fires only after one vegetable, one fruit, a bread type and a spread type
// were chosen and saved. Choices are stored in the existing family-code
// Firestore sync as dailyTasks/breakfast-YYYY-MM-DD (same doc shape the
// rules already allow), so the evening parent summary can read them.

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const docUrl = (code: string, key: string) => `${FS_BASE}/families/${code}/dailyTasks/${key}?key=${FIREBASE_API_KEY}`;

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const VEG = ['🥒 מלפפון', '🍅 עגבנייה', '🥕 גזר', '🫑 פלפל', '🥬 חסה', '🥦 ברוקולי'];
const FRUIT = ['🍎 תפוח', '🍌 בננה', '🍇 ענבים', '🍊 תפוז', '🍓 תות', '🥝 קיווי', '🍐 אגס'];
const BREAD = ['🌾 פיתה מקמח מלא 💚', '🫓 פיתה רגילה', '🍞 לחם מלא 💚'];
const SPREAD = ['🥑 אבוקדו 💚', '🧀 גבינה לבנה 💚', '🫒 טחינה 💚', '🧆 חומוס 💚', '🥚 ביצה קשה 💚', '🥜 חמאת בוטנים', '🧈 גבינת שמנת', '🍯 דבש', '🍫 שוקולד'];
const LUNCH = ['🍝 פסטה', '🍚 אורז עם עוף', '🍗 שניצל עם ירקות', '🍳 חביתה וסלט', '🥙 פיתה עם חומוס וסלט', '🍲 מרק'];

type Pick = { veg: string; fruit: string; bread: string; spread: string; lunch?: string; at: number };

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
  const [bread, setBread] = useState(''); const [spread, setSpread] = useState('');
  const [lunch, setLunch] = useState('');
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDay(familyCode, dateKey).then(d => {
      const p = d[childId]; if (!p) return;
      setVeg(p.veg || ''); setFruit(p.fruit || ''); setBread(p.bread || ''); setSpread(p.spread || ''); setLunch(p.lunch || '');
    });
  }, []);

  const complete = !!(veg && fruit && bread && spread);

  const save = async () => {
    if (!complete) return;
    setSaving(true); setErr('');
    try {
      const fresh = await loadDay(familyCode, dateKey);
      const entry: Pick = { veg, fruit, bread, spread, at: Date.now() };
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

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-3" dir="rtl">
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#D6CFC4] shadow-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#5D4037]">🥣 ארוחת הבוקר של {child?.name} ליום {dayName}</h3>
            <p className="text-xs text-[#8C8479]">חובה לבחור אחד מכל סוג. 💚 = בחירה בריאה במיוחד</p>
          </div>
          <button onClick={onClose} className="text-[#8C8479] text-xl px-2">✕</button>
        </div>
        {group('🥕 ירק (אחד)', VEG, veg, setVeg)}
        {group('🍎 פרי (אחד)', FRUIT, fruit, setFruit)}
        {group('🫓 סוג לחם', BREAD, bread, setBread)}
        {group('🧈 סוג ממרח', SPREAD, spread, setSpread)}
        {needsLunch && group('🍽️ ארוחת צהריים ליום ראשון', LUNCH, lunch, setLunch)}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={!complete || saving}
          className={`w-full py-3 rounded-2xl font-bold text-white ${complete && !saving ? 'bg-[#6A7B42]' : 'bg-gray-300'}`}>
          {saving ? 'שומר...' : complete ? 'שמור וסיים ✓' : 'בחרו ירק, פרי, לחם וממרח'}
        </button>
      </div>
    </div>
  );
}
