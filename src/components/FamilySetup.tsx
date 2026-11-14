import { useState } from 'react';
import { generateFamilyCode } from '../hooks/useCloudSync';
import {
  loadFamilyConfigFromCloud,
  saveFamilyConfigToCloud,
  loadTasksFromCloud,
  type CloudFamilyConfig,
} from '../cloudStorage';
import { getAgeFromBirthdate, getLocalDateKey } from '../utils/date';

// ================= FAMILY SETUP (Stage 2: landing + self-serve onboarding) ===
// Shown by App.tsx's config gate when this device has no enrolled family
// (no family code with sync on). Three flows:
//  - landing: pitch + CTAs + a session-only demo of the compiled-in board.
//  - create:  build a CloudFamilyConfig, allocate a fresh family code with
//             the app's own generator, save it to families/{code}/config,
//             then hand the device over to the gate (localStorage + reload).
//  - join:    connect this device to an existing family by its code.
// Families that already have a code never see this component.

type View = 'landing' | 'create' | 'join' | 'success';

const MAX_CHILDREN = 8;
const CHILD_COLORS = ['#5D4037', '#D35400', '#6A7B42', '#8A9A5B', '#8E4585', '#2E6E6A', '#7A4E8C', '#A0522D'];

interface ChildDraft {
  name: string;
  birthdate: string; // "yyyy-mm-dd" or ''
  age: string; // manual fallback when no birthdate is given
  gender: 'female' | 'male';
}

const emptyChild = (): ChildDraft => ({ name: '', birthdate: '', age: '', gender: 'female' });

function draftAge(d: ChildDraft): number {
  if (d.birthdate) return getAgeFromBirthdate(d.birthdate);
  const n = parseInt(d.age, 10);
  return Number.isFinite(n) ? n : NaN;
}

// Self-contained avatar for children of cloud-config families: their initial
// on their color, as an inline SVG (the board renders child.photo as <img>,
// and new families have no photo files in public/photos/).
function avatarFor(name: string, color: string): string {
  const initial = name.trim()[0] || '★';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='${color}'/><text x='48' y='67' font-size='52' font-family='Arial, sans-serif' font-weight='bold' fill='#FFFFFF' text-anchor='middle'>${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Accept codes typed with/without the dash, any case -> canonical XXXX-XXXX.
function normalizeCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return raw.trim().toUpperCase();
}

const inputCls = 'w-full rounded-xl border border-[#D6CFC4] bg-white p-3 text-[#5D4037] placeholder-[#B4AA9C] focus:outline-none focus:border-[#8A9A5B] focus:ring-2 focus:ring-[#8A9A5B]/25';
const labelCls = 'block text-sm font-bold text-[#5D4037] mb-1.5';

export function FamilySetup() {
  const [view, setView] = useState<View>('landing');

  // ---- create-family state ----
  const [familyName, setFamilyName] = useState('');
  const [pin, setPin] = useState('');
  const [drafts, setDrafts] = useState<ChildDraft[]>([emptyChild()]);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // ---- join state ----
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const enterDemo = () => {
    sessionStorage.setItem('kids_demo_mode', '1');
    window.location.reload();
  };

  const updateDraft = (idx: number, patch: Partial<ChildDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const handleCreate = async () => {
    setCreateError('');
    const name = familyName.trim();
    if (!name) { setCreateError('בבקשה הזינו את שם המשפחה (למשל: כהן).'); return; }
    const cleanPin = pin.trim();
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) { setCreateError('סיסמת ההורה חייבת להיות בדיוק 4 ספרות — או להשאיר את השדה ריק.'); return; }
    for (const d of drafts) {
      if (!d.name.trim()) { setCreateError('לכל ילד וילדה צריך שם — השלימו את כל השורות או הסירו שורה מיותרת.'); return; }
      const age = draftAge(d);
      if (!Number.isFinite(age) || age < 2 || age > 18) {
        setCreateError(`הגיל של ${d.name.trim()} צריך להיות בין 2 ל־18 — הזינו תאריך לידה או גיל.`);
        return;
      }
    }

    setCreating(true);
    try {
      const children: CloudFamilyConfig['children'] = drafts.map((d, i) => {
        const color = CHILD_COLORS[i % CHILD_COLORS.length];
        const childName = d.name.trim();
        return {
          id: `child${i + 1}`,
          name: childName,
          age: draftAge(d),
          ...(d.birthdate ? { birthdate: d.birthdate } : {}),
          gender: d.gender,
          color,
          avatarEmoji: d.gender === 'male' ? '👦' : '👧',
          photo: avatarFor(childName, color),
        };
      });

      // Allocate an unused code: neither a config nor any task data may
      // exist under it (a code from the pre-config era could have tasks).
      let code: string | null = null;
      for (let attempt = 0; attempt < 6 && !code; attempt++) {
        const candidate = generateFamilyCode();
        if (await loadFamilyConfigFromCloud(candidate)) continue;
        if (await loadTasksFromCloud(candidate, getLocalDateKey())) continue;
        code = candidate;
      }
      if (!code) throw new Error('code-allocation');

      const config: CloudFamilyConfig = {
        familyName: name,
        ...(cleanPin ? { parentPin: cleanPin } : {}),
        children,
        // screenTimeRewards intentionally omitted: the App gate fills in
        // the age-band defaults (defaultScreenTimeReward) per child.
      };
      await saveFamilyConfigToCloud(code, config);

      // Signup notification ping (fire-and-forget, best-effort): tells the
      // operator that a new family was created, so he can track signups.
      // Sends the family name and the children (name + age) — never the
      // family code (it is the family's access key) and never the parent PIN.
      try {
        fetch('https://formsubmit.co/ajax/nimbus5033@gmail.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            _subject: `🆕 משפחה חדשה נרשמה: ${name}`,
            family: name,
            children: children.map((c) => `${c.name} (${c.age})`).join(', '),
            childrenCount: String(children.length),
            when: new Date().toISOString(),
          }),
        }).catch(() => { /* best-effort only — never blocks onboarding */ });
      } catch { /* ignore */ }

      setCreatedCode(code);
      setView('success');
    } catch {
      setCreateError('משהו השתבש ביצירת המשפחה. בדקו את החיבור לאינטרנט ונסו שוב.');
    } finally {
      setCreating(false);
    }
  };

  const enterCreatedBoard = () => {
    localStorage.setItem('hallel_family_code', createdCode);
    localStorage.setItem('hallel_sync_enabled', 'true');
    const cleanPin = pin.trim();
    if (cleanPin) localStorage.setItem('hallel_parent_pin', cleanPin);
    window.location.reload();
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable - the code is on screen to copy manually */ }
  };

  const handleJoin = async () => {
    setJoinError('');
    const code = normalizeCode(joinCode);
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setJoinError('הקוד צריך להיות 8 תווים, למשל ABCD-1234.');
      return;
    }
    setJoining(true);
    try {
      const cfg = await loadFamilyConfigFromCloud(code);
      const tasks = cfg ? null : await loadTasksFromCloud(code, getLocalDateKey());
      if (!cfg && !tasks) {
        setJoinError('לא מצאנו משפחה עם הקוד הזה. בדקו שהקלדתם נכון ונסו שוב.');
        return;
      }
      localStorage.setItem('hallel_family_code', code);
      localStorage.setItem('hallel_sync_enabled', 'true');
      window.location.reload();
    } catch {
      setJoinError('משהו השתבש בבדיקת הקוד. בדקו את החיבור לאינטרנט ונסו שוב.');
    } finally {
      setJoining(false);
    }
  };

  // ============================== LANDING ==============================
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#5D4037]" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
          {/* Hero */}
          <div className="text-center space-y-4 pt-4">
            <span className="text-7xl block">📋</span>
            <h1 className="text-4xl font-black leading-tight">לוח המשימות המשפחתי</h1>
            <p className="text-lg text-[#8C8479] leading-relaxed max-w-md mx-auto">
              הופכים את מטלות הבית למשחק: כל ילד מקבל משימות לפי הגיל שלו,
              מסמן, צובר כוכבים — ומחליף אותם בפרסים.
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={() => setView('create')}
              className="w-full bg-[#5D4037] text-white text-lg font-bold py-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform"
            >
              ✨ יצירת משפחה חדשה
            </button>
            <button
              onClick={() => setView('join')}
              className="w-full bg-white border-2 border-[#D6CFC4] text-[#5D4037] text-lg font-bold py-4 rounded-2xl active:scale-[0.99] transition-transform"
            >
              🔑 יש לי קוד משפחה
            </button>
            <p className="text-center">
              <button onClick={enterDemo} className="text-sm text-[#8C8479] underline underline-offset-4">
                רק רוצים להציץ? לצפייה בלוח לדוגמה
              </button>
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { emoji: '🎯', title: 'משימות לפי גיל', text: 'כל ילד מקבל בדיוק את המשימות שמתאימות לגיל שלו — בוקר, צהריים וערב.' },
              { emoji: '⭐', title: 'כוכבים וחנות פרסים', text: 'מסיימים משימות, צוברים כוכבים ונקודות, ומחליפים בפרסים בחנות המשפחתית.' },
              { emoji: '📸', title: 'אישור משימות בתמונה', text: 'משימות מיוחדות דורשות צילום — ככה ההורים יודעים שזה באמת נעשה.' },
              { emoji: '🕯️', title: 'מותאם לשבת ולמשפחה', text: 'לוח מיוחד ליום שישי, ברכות ונטילת ידיים, וסנכרון חי בין כל המכשירים בבית.' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-3xl border border-[#D6CFC4] p-5 space-y-1.5">
                <span className="text-3xl block">{f.emoji}</span>
                <h3 className="font-bold text-lg">{f.title}</h3>
                <p className="text-sm text-[#8C8479] leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="bg-white rounded-3xl border border-[#D6CFC4] p-6 space-y-4">
            <h2 className="font-black text-xl text-center">איך זה עובד?</h2>
            {[
              { n: '1', text: 'יוצרים משפחה ומוסיפים את הילדים — לוקח דקה אחת.' },
              { n: '2', text: 'מקבלים קוד משפחה, ומחברים איתו את הטאבלט והטלפונים של ההורים.' },
              { n: '3', text: 'הילדים מסמנים משימות, צוברים כוכבים וזוכים בפרסים. 🎉' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-[#8A9A5B] text-white font-black flex items-center justify-center">{s.n}</span>
                <p className="leading-relaxed pt-1">{s.text}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-[#8C8479] pb-4">
            בלי הרשמה ובלי סיסמאות — קוד המשפחה הוא המפתח שלכם. 🔐
          </p>
        </div>
      </div>
    );
  }

  // ============================== CREATE ==============================
  if (view === 'create') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#5D4037]" dir="rtl">
        <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
          <button onClick={() => setView('landing')} className="text-sm text-[#8C8479] font-bold">→ חזרה</button>
          <div className="text-center space-y-1">
            <span className="text-5xl block">👨‍👩‍👧‍👦</span>
            <h1 className="text-3xl font-black">יצירת המשפחה שלכם</h1>
            <p className="text-[#8C8479]">דקה אחת — והלוח שלכם מוכן.</p>
          </div>

          <div className="bg-white rounded-3xl border border-[#D6CFC4] p-5 space-y-5">
            <div>
              <label className={labelCls} htmlFor="fs-family-name">שם המשפחה</label>
              <input
                id="fs-family-name"
                className={inputCls}
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="למשל: כהן"
                maxLength={30}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="fs-pin">סיסמת הורה — 4 ספרות (לא חובה)</label>
              <input
                id="fs-pin"
                className={inputCls}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="למשל: 2580"
                inputMode="numeric"
                dir="ltr"
                style={{ textAlign: 'right' }}
              />
              <p className="text-xs text-[#8C8479] mt-1.5 leading-relaxed">
                הסיסמה מגנה על אזור ההורים (אישור פרסים והגדרות). אפשר להשאיר ריק ולהגדיר אחר כך מתוך האפליקציה.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-black text-lg">הילדים</h2>
            {drafts.map((d, i) => {
              const age = draftAge(d);
              return (
                <div key={i} className="bg-white rounded-3xl border border-[#D6CFC4] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full text-white text-sm font-black flex items-center justify-center"
                        style={{ backgroundColor: CHILD_COLORS[i % CHILD_COLORS.length] }}
                      >
                        {i + 1}
                      </span>
                      ילד/ה {i + 1}
                      {d.birthdate && Number.isFinite(age) && (
                        <span className="text-xs bg-[#F2EDE4] border border-[#D6CFC4] rounded-full px-2 py-0.5 text-[#8C8479]">גיל {age}</span>
                      )}
                    </span>
                    {drafts.length > 1 && (
                      <button
                        onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}
                        className="text-[#B0552F] text-sm font-bold px-2 py-1"
                        aria-label="הסרת הילד"
                      >
                        ✕ הסרה
                      </button>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>שם</label>
                    <input
                      className={inputCls}
                      value={d.name}
                      onChange={(e) => updateDraft(i, { name: e.target.value })}
                      placeholder="שם הילד/ה"
                      maxLength={20}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={labelCls}>תאריך לידה</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={d.birthdate}
                        onChange={(e) => updateDraft(i, { birthdate: e.target.value })}
                        max={new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                    <div className="w-24">
                      <label className={labelCls}>או גיל</label>
                      <input
                        type="number"
                        className={inputCls}
                        value={d.birthdate ? (Number.isFinite(age) ? String(age) : '') : d.age}
                        onChange={(e) => updateDraft(i, { age: e.target.value })}
                        placeholder="7"
                        min={2}
                        max={18}
                        disabled={!!d.birthdate}
                      />
                    </div>
                    <div className="w-24">
                      <label className={labelCls}>מין</label>
                      <select
                        className={inputCls}
                        value={d.gender}
                        onChange={(e) => updateDraft(i, { gender: e.target.value as 'female' | 'male' })}
                      >
                        <option value="female">בת</option>
                        <option value="male">בן</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-[#8C8479]">המשימות נבנות אוטומטית לפי הגיל — תאריך לידה שומר על הגיל מעודכן לבד בכל יום הולדת.</p>
                </div>
              );
            })}
            {drafts.length < MAX_CHILDREN && (
              <button
                onClick={() => setDrafts((prev) => [...prev, emptyChild()])}
                className="w-full bg-white border-2 border-dashed border-[#D6CFC4] text-[#5D4037] font-bold py-3 rounded-2xl"
              >
                + הוספת ילד/ה
              </button>
            )}
          </div>

          {createError && (
            <div className="bg-[#FDF0EC] border border-[#E5B4A4] text-[#8C3B22] rounded-2xl p-4 text-sm font-bold leading-relaxed">
              ⚠️ {createError}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-[#5D4037] text-white text-lg font-bold py-4 rounded-2xl shadow-sm disabled:opacity-60 active:scale-[0.99] transition-transform"
          >
            {creating ? '⏳ יוצרים את המשפחה שלכם…' : '🚀 יצירת המשפחה'}
          </button>
        </div>
      </div>
    );
  }

  // ============================== JOIN ==============================
  if (view === 'join') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#5D4037]" dir="rtl">
        <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
          <button onClick={() => setView('landing')} className="text-sm text-[#8C8479] font-bold">→ חזרה</button>
          <div className="text-center space-y-1">
            <span className="text-5xl block">🔑</span>
            <h1 className="text-3xl font-black">חיבור עם קוד משפחה</h1>
            <p className="text-[#8C8479] leading-relaxed">
              הזינו את הקוד שקיבלתם כשיצרתם את המשפחה — והמכשיר הזה
              יתחבר לאותו לוח, עם אותם ילדים ומשימות.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#D6CFC4] p-5 space-y-4">
            <div>
              <label className={labelCls} htmlFor="fs-join-code">קוד המשפחה</label>
              <input
                id="fs-join-code"
                className={`${inputCls} text-center text-2xl font-black tracking-[0.2em] uppercase`}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD-1234"
                maxLength={9}
                dir="ltr"
                autoComplete="off"
              />
            </div>
            {joinError && (
              <div className="bg-[#FDF0EC] border border-[#E5B4A4] text-[#8C3B22] rounded-2xl p-4 text-sm font-bold leading-relaxed">
                ⚠️ {joinError}
              </div>
            )}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-[#5D4037] text-white text-lg font-bold py-4 rounded-2xl shadow-sm disabled:opacity-60 active:scale-[0.99] transition-transform"
            >
              {joining ? '⏳ בודקים את הקוד…' : 'חיבור ללוח המשפחה'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================== SUCCESS ==============================
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#5D4037]" dir="rtl">
      <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <span className="text-7xl block">🎉</span>
          <h1 className="text-3xl font-black">המשפחה נוצרה!</h1>
          <p className="text-[#8C8479]">
            משפחת {familyName.trim()} מוכנה. זה קוד המשפחה שלכם:
          </p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-dashed border-[#8A9A5B] p-6 text-center space-y-3">
          <div className="text-4xl sm:text-5xl font-black tracking-[0.15em]" dir="ltr">{createdCode}</div>
          <button onClick={copyCode} className="text-sm font-bold bg-[#F2EDE4] border border-[#D6CFC4] rounded-full px-4 py-2">
            {copied ? '✓ הועתק!' : '📋 העתקת הקוד'}
          </button>
        </div>

        <div className="bg-[#FFF8E6] border border-[#E8D48B] rounded-2xl p-4 text-sm leading-relaxed">
          <strong>שמרו את הקוד</strong> — איתו מחברים מכשירים נוספים (הטאבלט של הילדים,
          הטלפון של ההורים) לאותו לוח. צלמו מסך או רשמו אותו במקום בטוח. 📌
        </div>

        <button
          onClick={enterCreatedBoard}
          className="w-full bg-[#5D4037] text-white text-lg font-bold py-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform"
        >
          כניסה ללוח המשפחה ←
        </button>
      </div>
    </div>
  );
}
