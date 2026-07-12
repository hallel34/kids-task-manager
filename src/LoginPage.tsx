import React, { useState } from 'react';
import { motion } from 'motion/react';

interface LoginPageProps {
  onGoogleSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onShowPricing?: () => void;
}

export function LoginPage({ onGoogleSignIn, onEmailSignIn, onShowPricing }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError('');
    try {
      await onGoogleSignIn();
    } catch (e: any) {
      setError(e.message || 'שגיאה בהתחברות');
    }
    setIsLoading(false);
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      await onEmailSignIn(email, password);
    } catch (err: any) {
      const msg = err.code === 'auth/wrong-password' ? 'סיסמה שגויה' 
        : err.code === 'auth/invalid-email' ? 'כתובת אימייל לא תקינה'
        : err.code === 'auth/weak-password' ? 'הסיסמה חייבת להכיל לפחות 6 תווים'
        : err.message || 'שגיאה בהתחברות';
      setError(msg);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] to-[#E9E4DB] flex flex-col items-center justify-center p-6" dir="rtl">
      
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg mx-auto space-y-6"
      >
        <span className="text-6xl block">📋</span>
        <h1 className="text-4xl font-bold text-[#5D4037] font-serif">לוח משימות הבית</h1>
        <p className="text-lg text-[#8C8479]">
          אפליקציה לניהול משימות יומיות לילדים על טאבלט בבית
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-3 text-right">
          {[
            { emoji: '✅', text: 'משימות לפי שעה' },
            { emoji: '🎮', text: 'תגמול זמן מסך' },
            { emoji: '😊', text: 'סמיילים ומתנות' },
            { emoji: '📸', text: 'הוכחה בצילום' },
            { emoji: '🕯️', text: 'משימות יום שישי' },
            { emoji: '🔒', text: 'לוח בקרה להורים' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-xl text-sm">
              <span>{f.emoji}</span>
              <span className="text-[#5D4037] font-bold text-xs">{f.text}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-3xl shadow-xl border border-[#D6CFC4] p-8 mt-8 w-full max-w-md space-y-4"
      >
        <h2 className="text-xl font-bold text-[#5D4037] text-center">התחברות / הרשמה</h2>
        <p className="text-xs text-[#8C8479] text-center">הרשמה חדשה? פשוט הזינו פרטים ונפתח לכם חשבון</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs font-bold px-4 py-2 rounded-xl border border-red-200 text-center">
            ❌ {error}
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogle}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-[#D6CFC4] rounded-xl hover:bg-slate-50 transition-all text-sm font-bold text-[#5D4037] disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>התחברות עם Google</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E3DCD2]"></div>
          <span className="text-[10px] text-[#8C8479] font-bold">או</span>
          <div className="h-px flex-1 bg-[#E3DCD2]"></div>
        </div>

        {!showEmailForm ? (
          <button
            onClick={() => setShowEmailForm(true)}
            className="w-full px-4 py-3 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl text-sm font-bold transition-all"
          >
            📧 התחברות עם אימייל
          </button>
        ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="כתובת אימייל"
              className="w-full px-4 py-2.5 border border-[#D6CFC4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]"
              required
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="סיסמה (לפחות 6 תווים)"
              className="w-full px-4 py-2.5 border border-[#D6CFC4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]"
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-[#5D4037] hover:bg-[#432d27] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {isLoading ? '⏳ מתחבר...' : '🚀 התחבר / הרשם'}
            </button>
          </form>
        )}

        <p className="text-[9px] text-[#8C8479] text-center mt-4">
          משתמש חדש? הרשמו ותגדירו את המשפחה שלכם בקלות
        </p>
      </motion.div>

      {/* Footer */}
      {onShowPricing && (
        <button
          onClick={onShowPricing}
          className="mt-6 text-sm text-[#8A9A5B] hover:text-[#6A7B42] font-bold transition-all"
        >
          💰 צפו בתוכניות ומחירים
        </button>
      )}
      <p className="text-xs text-[#8C8479] mt-4">© 2026 לוח משימות הבית</p>
    </div>
  );
}
