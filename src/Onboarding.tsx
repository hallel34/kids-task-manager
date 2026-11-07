import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { FamilyData, FamilyChild } from './useAuth';

interface OnboardingProps {
  onComplete: (data: FamilyData) => void;
  userName?: string;
}

const COLORS = ['#5D4037', '#D35400', '#6A7B42', '#8A9A5B', '#2E86AB', '#A23B72', '#F18F01', '#C73E1D'];
const EMOJIS_GIRLS = ['👧', '👩', '💃', '🧒'];
const EMOJIS_BOYS = ['👦', '🧑', '🕺', '👶'];

export function Onboarding({ onComplete, userName }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState('');
  const [parentPin, setParentPin] = useState('1234');
  const [children, setChildren] = useState<FamilyChild[]>([
    { id: 'child_1', name: '', age: 8, gender: 'male', color: COLORS[0], avatarEmoji: '👦', photo: '' },
  ]);

  const addChild = () => {
    const idx = children.length + 1;
    setChildren(prev => [...prev, {
      id: `child_${idx}`,
      name: '',
      age: 7,
      gender: 'male',
      color: COLORS[idx % COLORS.length],
      avatarEmoji: '👦',
      photo: '',
    }]);
  };

  const removeChild = (idx: number) => {
    if (children.length <= 1) return;
    setChildren(prev => prev.filter((_, i) => i !== idx));
  };

  const updateChild = (idx: number, field: keyof FamilyChild, value: any) => {
    setChildren(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, [field]: value };
      if (field === 'gender') {
        updated.avatarEmoji = value === 'female' ? '👧' : '👦';
      }
      return updated;
    }));
  };

  const handleComplete = () => {
    const mappedChildren = children.map((c, i) => ({ 
      ...c, 
      id: `child_${i + 1}`, 
      initial: c.name[0] || String(i + 1) 
    }));
    
    const screenTimeRewards: Record<string, { base: number; bonusPerOptional: number }> = {};
    mappedChildren.forEach(c => {
      const base = c.age >= 12 ? 60 : c.age >= 8 ? 45 : c.age >= 6 ? 30 : 20;
      screenTimeRewards[c.id] = { base, bonusPerOptional: 5 };
    });

    const data = {
      familyName,
      parentPin,
      children: mappedChildren,
      screenTimeRewards,
      createdAt: Date.now(),
    };
    
    onComplete(data);
  };

  const steps = [
    // Step 0: Welcome + Family name
    <div key="welcome" className="space-y-6 text-center">
      <span className="text-5xl block">👨‍👩‍👧‍👦</span>
      <h2 className="text-2xl font-bold text-[#5D4037]">ברוכים הבאים{userName ? `, ${userName}` : ''}!</h2>
      <p className="text-sm text-[#8C8479]">בואו נגדיר את המשפחה שלכם</p>
      
      <div className="text-right space-y-3">
        <label className="text-sm font-bold text-[#5D4037] block">שם המשפחה:</label>
        <input
          type="text"
          value={familyName}
          onChange={e => setFamilyName(e.target.value)}
          placeholder="לדוגמה: כהן, ישראלי..."
          className="w-full px-4 py-3 border border-[#D6CFC4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]"
        />
      </div>

      <div className="text-right space-y-3">
        <label className="text-sm font-bold text-[#5D4037] block">קוד PIN להורים:</label>
        <input
          type="text"
          value={parentPin}
          onChange={e => setParentPin(e.target.value)}
          placeholder="קוד גישה ללוח ההורים"
          className="w-full px-4 py-3 border border-[#D6CFC4] rounded-xl text-sm font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]"
        />
        <p className="text-[10px] text-[#8C8479]">הילדים לא יכולים לגשת ללוח ההורים בלי הקוד הזה</p>
      </div>
    </div>,

    // Step 1: Children
    <div key="children" className="space-y-6">
      <div className="text-center">
        <span className="text-4xl block">🧒</span>
        <h2 className="text-xl font-bold text-[#5D4037] mt-2">הוסיפו את הילדים</h2>
        <p className="text-xs text-[#8C8479]">הוסיפו כל ילד עם שם, גיל ומגדר</p>
      </div>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {children.map((child, idx) => (
          <div key={idx} className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#D6CFC4] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#5D4037]">ילד/ה {idx + 1}</span>
              {children.length > 1 && (
                <button onClick={() => removeChild(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={child.name}
                onChange={e => updateChild(idx, 'name', e.target.value)}
                placeholder="שם הילד/ה"
                className="px-3 py-2 border border-[#D6CFC4] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#8A9A5B]"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={child.age}
                  onChange={e => updateChild(idx, 'age', parseInt(e.target.value) || 5)}
                  min={2}
                  max={18}
                  className="w-16 px-2 py-2 border border-[#D6CFC4] rounded-xl text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#8A9A5B]"
                />
                <span className="text-xs text-[#8C8479] self-center">גיל</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => updateChild(idx, 'gender', 'male')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  child.gender === 'male' ? 'bg-blue-100 border-2 border-blue-400 text-blue-800' : 'bg-white border border-[#D6CFC4] text-[#8C8479]'
                }`}
              >
                👦 בן
              </button>
              <button
                onClick={() => updateChild(idx, 'gender', 'female')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  child.gender === 'female' ? 'bg-pink-100 border-2 border-pink-400 text-pink-800' : 'bg-white border border-[#D6CFC4] text-[#8C8479]'
                }`}
              >
                👧 בת
              </button>
            </div>

            {/* Color picker */}
            <div className="flex gap-1.5">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateChild(idx, 'color', color)}
                  className={`w-6 h-6 rounded-full transition-all ${child.color === color ? 'ring-2 ring-offset-1 ring-[#5D4037] scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addChild}
        className="w-full py-3 border-2 border-dashed border-[#D6CFC4] rounded-xl text-sm font-bold text-[#8C8479] hover:border-[#8A9A5B] hover:text-[#6A7B42] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        <span>הוסף ילד/ה</span>
      </button>
    </div>,

    // Step 2: Summary
    <div key="summary" className="space-y-6 text-center">
      <span className="text-5xl block">🎉</span>
      <h2 className="text-xl font-bold text-[#5D4037]">הכל מוכן!</h2>
      <p className="text-sm text-[#8C8479]">משפחת {familyName || '---'}</p>

      <div className="grid grid-cols-2 gap-3">
        {children.filter(c => c.name).map((child, i) => (
          <div key={i} className="bg-white p-3 rounded-2xl border border-[#D6CFC4] text-center">
            <span className="text-2xl block">{child.avatarEmoji}</span>
            <span className="text-sm font-bold text-[#5D4037] block mt-1">{child.name}</span>
            <span className="text-[10px] text-[#8C8479]">{child.gender === 'female' ? 'בת' : 'בן'} {child.age}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#D6CFC4] text-right space-y-2">
        <p className="text-xs text-[#5D4037]"><strong>PIN הורים:</strong> {parentPin}</p>
        <p className="text-xs text-[#5D4037]"><strong>זמן מסך:</strong> מותאם אוטומטית לפי גיל</p>
        <p className="text-xs text-[#5D4037]"><strong>משימות:</strong> נוצרות אוטומטית לפי גיל כל ילד</p>
      </div>
    </div>,
  ];

  const canProceed = step === 0 ? familyName.length > 0 && parentPin.length >= 4
    : step === 1 ? children.every(c => c.name.length > 0)
    : true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] to-[#E9E4DB] flex items-center justify-center p-6" dir="rtl">
      <div className="bg-white rounded-3xl shadow-xl border border-[#D6CFC4] p-8 w-full max-w-lg">
        
        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? 'bg-[#8A9A5B]' : 'bg-[#E9E4DB]'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8 gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 border border-[#D6CFC4] rounded-xl text-sm font-bold text-[#8C8479] hover:bg-slate-50 transition-all"
            >
              ← חזרה
            </button>
          )}
          <div className="flex-1" />
          {step < 2 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed}
              className="px-8 py-3 bg-[#8A9A5B] hover:bg-[#6A7B42] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all"
            >
              המשך →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-8 py-3 bg-[#5D4037] hover:bg-[#432d27] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>בואו נתחיל!</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
