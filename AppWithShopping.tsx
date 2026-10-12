import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import App from './src/App';
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from './src/firebase';
import { loadShopping, changeShopping, addShoppingItem, type ShoppingItem, type ShoppingDoc } from './shoppingList';
function ShoppingList({ familyCode: initialCode, onClose }: { familyCode: string; onClose: () => void }) {
  const [familyCode, setFamilyCode] = useState(initialCode);
  const [codeInput, setCodeInput] = useState(initialCode);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/families/${encodeURIComponent(familyCode)}/dailyTasks/shopping-current?key=${FIREBASE_API_KEY}`;
  const refresh = async () => {
    if (!familyCode) return;
    setBusy(true); setError('');
    try { setItems((await loadShopping(url)).doc.items); setLoaded(true); }
    catch (e: any) { setError(e.message || 'שגיאה בטעינת הרשימה'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [familyCode]);
  const change = async (fn: (doc: ShoppingDoc) => void) => {
    setBusy(true); setError('');
    try { setItems((await changeShopping(url, fn)).items); return true; }
    catch (e: any) { setError(e.message || 'שגיאה בשמירת הרשימה'); return false; }
    finally { setBusy(false); }
  };
  const open = items.filter(i => !i.bought);
  const bought = items.filter(i => i.bought);
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" dir="rtl">
    <section role="dialog" aria-modal="true" aria-label="רשימת קניות" className="bg-[#FAF8F5] w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl border border-[#D6CFC4] p-5 shadow-xl text-[#5D4037]">
      <div className="flex justify-between items-center gap-3 mb-4"><h2 className="text-xl font-bold">🛒 רשימת קניות</h2><button onClick={onClose} aria-label="סגירת רשימת קניות" className="p-3 rounded-xl bg-white border border-[#D6CFC4]"><X size={20} /></button></div>
      <details className="mb-4"><summary className="cursor-pointer text-sm">קוד משפחה לרשימה</summary><form className="flex gap-2 mt-2" onSubmit={e => { e.preventDefault(); if (/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codeInput)) setFamilyCode(codeInput); }}><input aria-label="קוד משפחה לרשימת קניות" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} maxLength={9} pattern="[A-Z2-9]{4}-[A-Z2-9]{4}" required className="min-w-0 flex-1 rounded-xl border p-3" /><button className="rounded-xl bg-[#8A9A5B] text-white px-3">פתח רשימה</button></form><p className="text-xs mt-2">הבחירה כאן משנה רק את רשימת הקניות, בלי לשנות סנכרון משימות.</p></details>
      {!familyCode ? <p>כדי להשתמש ברשימה המשפחתית יש להזין קוד משפחה באזור הסנכרון.</p> : <>
        <p className="text-sm text-[#8C8479] mb-4">רשימה משותפת לכל מכשירי המשפחה. פריטים שנקנו יורדים מהרשימה הפעילה.</p>
        <form className="flex gap-2 mb-4" onSubmit={async e => { e.preventDefault(); if (await change(doc => addShoppingItem(doc, name, 'other', 'manual'))) setName(''); }}>
          <input aria-label="שם פריט לקניות" placeholder="מה צריך לקנות?" value={name} maxLength={120} onChange={e => setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#D6CFC4] bg-white p-3" />
          <button disabled={busy || !name.trim()} className="rounded-xl bg-[#8A9A5B] text-white px-4 disabled:opacity-50">הוסף</button>
        </form>
        {error && <p role="alert" className="text-red-700 mb-3">{error}</p>}
        <div className="flex justify-between items-center mb-3"><span className="font-bold">לקנות ({open.length})</span><button disabled={busy} onClick={refresh} className="p-2 underline disabled:opacity-50">{busy ? 'שומר / טוען...' : 'רענון'}</button></div>
        {loaded && !open.length && <p className="rounded-2xl bg-white p-5 text-center">הכול נקנה 🎉 אין פריטים ברשימה הפעילה.</p>}
        <ul className="space-y-2">{open.map(item => <li key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-[#D6CFC4]"><div className="min-w-0"><p className="font-bold break-words">{item.name}</p><p className="text-xs text-[#8C8479]">{item.source === 'missing-report' ? 'מדיווח חוסרים' : 'נוסף ידנית'}</p></div><button disabled={busy} aria-label={`נקנה: ${item.name}`} onClick={() => change(doc => { const found = doc.items.find(i => i.id === item.id); if (found) { found.bought = true; found.boughtAt = Date.now(); } })} className="shrink-0 rounded-xl bg-[#8A9A5B] text-white px-4 py-3 disabled:opacity-50">נקנה ✓</button></li>)}</ul>
        {bought.length > 0 && <details className="mt-5"><summary className="cursor-pointer p-2">נקנו ({bought.length})</summary><ul className="text-sm text-[#8C8479] space-y-2 p-2">{bought.map(i => <li key={i.id} className="line-through break-words">{i.name}</li>)}</ul><button disabled={busy} onClick={() => change(doc => { doc.items = doc.items.filter(i => !i.bought); })} className="border border-[#D6CFC4] bg-white rounded-xl p-3 mt-2 disabled:opacity-50">נקה פריטים שנקנו</button></details>}
      </>}
    </section>
  </div>;
}

export default function AppWithShopping() {
  const [show, setShow] = useState(false);
  const [nav, setNav] = useState<HTMLElement | null>(null);
  useEffect(() => { setNav(document.querySelector('header > div:last-child')); }, []);
  return <><App />{nav && createPortal(<button onClick={() => setShow(true)} className="px-3 py-2 border border-[#DCD4C7] rounded-xl text-xs font-bold text-[#5D4037] bg-[#F2EDE4] shrink-0" aria-label="רשימת קניות">🛒 <span className="hidden sm:inline">רשימת קניות</span><span className="sm:hidden">קניות</span></button>, nav)}{show && <ShoppingList familyCode={localStorage.getItem('hallel_family_code') || ''} onClose={() => setShow(false)} />}</>;
}
