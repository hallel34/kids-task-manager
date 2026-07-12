import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Check, Star } from 'lucide-react';

interface PricingPageProps {
  onSelectPlan: (plan: 'free' | 'family' | 'premium') => void;
  currentPlan?: string;
  onBack?: () => void;
}

const PLANS = [
  {
    id: 'free' as const,
    name: 'חינם',
    emoji: '🆓',
    price: 0,
    priceLabel: 'חינם לנצח',
    color: '#8C8479',
    features: [
      'עד 2 ילדים',
      'משימות בסיסיות לפי גיל',
      'מעקב התקדמות',
      'תמיכה בעברית מלאה',
    ],
    limitations: [
      'בלי צילום הוכחות',
      'בלי סמיילים ומתנות',
      'בלי משימות יום שישי',
    ],
  },
  {
    id: 'family' as const,
    name: 'משפחה',
    emoji: '⭐',
    price: 19,
    priceLabel: '₪19 / חודש',
    color: '#8A9A5B',
    popular: true,
    features: [
      'ילדים ללא הגבלה',
      'משימות מותאמות לפי גיל',
      'צילום הוכחות מהמצלמה',
      'מערכת סמיילים ומתנות',
      'משימות יום שישי',
      'תגמול זמן מסך',
      'הקראה קולית לקטנים',
      'לוח בקרה להורים',
    ],
    limitations: [],
  },
  {
    id: 'premium' as const,
    name: 'פרימיום',
    emoji: '👑',
    price: 29,
    priceLabel: '₪29 / חודש',
    color: '#D35400',
    features: [
      'הכל בתוכנית משפחה',
      'סנכרון בין מכשירים',
      'נעילת מסך אוטומטית',
      'חיבור למערכת משוב',
      'דוחות שבועיים להורים',
      'תמיכה מועדפת',
      'ללא פרסומות',
    ],
    limitations: [],
  },
];

export function PricingPage({ onSelectPlan, currentPlan, onBack }: PricingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] to-[#E9E4DB] p-6 md:p-12" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Back button */}
        {onBack && (
          <button onClick={onBack} className="text-sm text-[#8C8479] hover:text-[#5D4037] font-bold transition-all">
            ← חזרה
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-[#5D4037]">בחרו את התוכנית שלכם</h1>
          <p className="text-[#8C8479] text-lg">7 ימי ניסיון חינם בכל תוכנית!</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white rounded-3xl border-2 p-6 space-y-5 relative ${
                plan.popular ? 'border-[#8A9A5B] shadow-xl scale-105' : 'border-[#D6CFC4] shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8A9A5B] text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  <span>הכי פופולרי</span>
                </div>
              )}

              <div className="text-center space-y-2">
                <span className="text-4xl block">{plan.emoji}</span>
                <h3 className="text-xl font-bold text-[#5D4037]">{plan.name}</h3>
                <div className="text-2xl font-bold" style={{ color: plan.color }}>
                  {plan.priceLabel}
                </div>
              </div>

              <div className="space-y-2">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-[#4A4540]">{f}</span>
                  </div>
                ))}
                {plan.limitations.map(l => (
                  <div key={l} className="flex items-center gap-2 text-sm opacity-50">
                    <span className="w-4 h-4 shrink-0 text-center text-red-400">✕</span>
                    <span className="text-[#8C8479]">{l}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => onSelectPlan(plan.id)}
                disabled={currentPlan === plan.id}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  currentPlan === plan.id
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : plan.popular
                    ? 'bg-[#8A9A5B] hover:bg-[#6A7B42] text-white shadow-md'
                    : 'bg-[#F2EDE4] hover:bg-[#E9E4DB] text-[#5D4037]'
                }`}
              >
                {currentPlan === plan.id ? '✓ התוכנית הנוכחית' : plan.price === 0 ? 'התחילו בחינם' : `הרשמה ל-${plan.priceLabel}`}
              </button>
              
              {/* PayPal button for paid plans */}
              {plan.price > 0 && currentPlan !== plan.id && (
                <PayPalButton planId={plan.id} price={plan.price} onSuccess={() => onSelectPlan(plan.id)} />
              )}
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-3xl border border-[#D6CFC4] p-6 space-y-4 max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-[#5D4037] text-center">שאלות נפוצות</h3>
          {[
            { q: 'האם אפשר לבטל בכל עת?', a: 'כן! אפשר לבטל בלחיצה אחת ללא התחייבות.' },
            { q: 'האם יש תקופת ניסיון?', a: 'כן, 7 ימי ניסיון חינם בכל תוכנית בתשלום.' },
            { q: 'האם הנתונים מסונכרנים?', a: 'בתוכנית פרימיום - כן! הנתונים מסונכרנים בין כל המכשירים.' },
            { q: 'איך משלמים?', a: 'כרטיס אשראי או PayPal. התשלום מאובטח דרך Stripe.' },
          ].map(faq => (
            <div key={faq.q} className="border-b border-[#F2EDE4] pb-3 last:border-0">
              <p className="text-sm font-bold text-[#5D4037]">{faq.q}</p>
              <p className="text-xs text-[#8C8479] mt-1">{faq.a}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#8C8479]">© 2026 לוח משימות הבית | כל הזכויות שמורות</p>
      </div>
    </div>
  );
}

// PayPal Subscription Button Component
function PayPalButton({ planId, price, onSuccess }: { planId: string; price: number; onSuccess: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    const paypal = (window as any).paypal;
    if (!paypal || !containerRef.current || renderedRef.current) return;
    renderedRef.current = true;

    paypal.Buttons({
      style: {
        shape: 'pill',
        color: 'gold',
        layout: 'vertical',
        label: 'subscribe',
        height: 40,
      },
      createSubscription: function(_data: any, actions: any) {
        return actions.subscription.create({
          plan_id: planId === 'family' ? 'FAMILY_PLAN_ID' : 'PREMIUM_PLAN_ID', // Replace with real PayPal plan IDs
          application_context: {
            shipping_preference: 'NO_SHIPPING',
          }
        });
      },
      onApprove: function(data: any) {
        console.log('Subscription approved:', data.subscriptionID);
        alert(`🎉 התשלום הושלם בהצלחה! מזהה מנוי: ${data.subscriptionID}`);
        onSuccess();
      },
      onError: function(err: any) {
        console.error('PayPal error:', err);
        alert('שגיאה בתהליך התשלום. נסו שוב.');
      }
    }).render(containerRef.current);
  }, [planId, onSuccess]);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] text-center text-[#8C8479]">או שלמו עם PayPal:</p>
      <div ref={containerRef} className="paypal-button-container"></div>
    </div>
  );
}
