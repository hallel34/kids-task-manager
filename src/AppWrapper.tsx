import React, { useState } from 'react';
import { useAuth } from './useAuth';
import { LoginPage } from './LoginPage';
import { Onboarding } from './Onboarding';
import { OnboardingTour } from './OnboardingTour';
import { PricingPage } from './PricingPage';
import App from './App';
import type { FamilyData } from './useAuth';

export default function AppWrapper() {
  const { user, loading, familyData, signInWithGoogle, signInWithEmail, signOut, saveFamilyData, isNewUser } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <span className="text-5xl block animate-bounce">📋</span>
          <p className="text-[#8C8479] font-bold">טוען...</p>
        </div>
      </div>
    );
  }

  // Pricing page (accessible from anywhere)
  if (showPricing) {
    return (
      <PricingPage 
        currentPlan="free"
        onSelectPlan={(plan) => {
          if (plan === 'free') {
            setShowPricing(false);
          } else {
            alert('תשלומים יופעלו בקרוב! כרגע כל הפיצ׳רים פתוחים בחינם 🎉');
            setShowPricing(false);
          }
        }}
        onBack={() => setShowPricing(false)}
      />
    );
  }

  // Not logged in → show login page
  if (!user) {
    return <LoginPage onGoogleSignIn={signInWithGoogle} onEmailSignIn={signInWithEmail} onShowPricing={() => setShowPricing(true)} />;
  }

  // Logged in but no family data → onboarding
  if (isNewUser) {
    return (
      <Onboarding 
        userName={user.displayName || undefined}
        onComplete={async (data: FamilyData) => {
          try {
            await saveFamilyData(data);
            // Show tour after first setup
            setShowTour(true);
          } catch (e: any) {
            alert('שגיאה בשמירה: ' + e.message);
          }
        }}
      />
    );
  }

  // Logged in with family data → show app (+ tour if first time)
  return (
    <>
      <App familyData={familyData!} userId={user.uid} onSignOut={signOut} />
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
    </>
  );
}
