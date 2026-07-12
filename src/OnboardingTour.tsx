import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const TOUR_STEPS = [
  {
    emoji: '👋',
    title: 'ברוכים הבאים!',
    text: 'האפליקציה מנהלת את המשימות היומיות של הילדים. כל ילד רואה את המשימות שלו ומסמן כשהוא מסיים.',
  },
  {
    emoji: '⏰',
    title: 'משימות לפי שעה',
    text: 'המשימות מחולקות לבוקר, צהריים וערב. האפליקציה מזהה אוטומטית את השעה ומציגה את המשימות הרלוונטיות.',
  },
  {
    emoji: '🎮',
    title: 'תגמול זמן מסך',
    text: 'כשהילד מסיים את כל משימות החובה - הוא מרוויח זמן מסך! כל משימת רשות נוספת מוסיפה דקות בונוס.',
  },
  {
    emoji: '😊',
    title: 'סמיילים ומתנות',
    text: 'בסוף כל יום שהילד מסיים את כל משימות הערב - הוא מקבל סמיילי! ב-10 סמיילים מגיעה מתנה מאבא ואמא.',
  },
  {
    emoji: '🔒',
    title: 'לוח בקרה להורים',
    text: 'לחצו על "בקרה להורים" והזינו את ה-PIN שהגדרתם. משם תוכלו לערוך משימות, לנהל סמיילים ולשלוט בזמן מסך.',
  },
  {
    emoji: '📱',
    title: 'התקנה על טאבלט',
    text: 'פתחו את הכתובת בטאבלט → לחצו על ⋮ → "הוסף למסך הבית". ככה האפליקציה תיפתח כמו אפליקציה רגילה!',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const isLast = step === TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4" dir="rtl">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl shadow-2xl border border-[#D6CFC4] p-8 max-w-md w-full text-center space-y-5"
      >
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-[#8A9A5B] w-6' : i < step ? 'bg-[#8A9A5B]' : 'bg-[#E9E4DB]'}`} />
          ))}
        </div>

        <motion.span 
          className="text-5xl block"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
        >
          {current.emoji}
        </motion.span>

        <h2 className="text-xl font-bold text-[#5D4037]">{current.title}</h2>
        <p className="text-sm text-[#8C8479] leading-relaxed">{current.text}</p>

        <div className="flex gap-3 justify-center pt-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-2.5 border border-[#D6CFC4] rounded-xl text-sm font-bold text-[#8C8479] hover:bg-slate-50 transition-all"
            >
              ← חזרה
            </button>
          )}
          
          {!isLast ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-8 py-2.5 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl text-sm font-bold transition-all"
            >
              המשך →
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-8 py-2.5 bg-[#5D4037] hover:bg-[#432d27] text-white rounded-xl text-sm font-bold transition-all"
            >
              🚀 בואו נתחיל!
            </button>
          )}
        </div>

        <button
          onClick={onComplete}
          className="text-[10px] text-[#8C8479] hover:text-[#5D4037] transition-all"
        >
          דלג על ההדרכה
        </button>
      </motion.div>
    </div>
  );
}
