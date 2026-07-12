import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';

export interface FamilyChild {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  color: string;
  avatarEmoji: string;
  photo: string;
}

export interface FamilyData {
  familyName: string;
  parentPin: string;
  children: FamilyChild[];
  screenTimeRewards: Record<string, { base: number; bonusPerOptional: number }>;
  createdAt: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Load family data from Firestore
        const familyDoc = await getDoc(doc(db, 'families', firebaseUser.uid));
        if (familyDoc.exists()) {
          setFamilyData(familyDoc.data() as FamilyData);
        } else {
          setFamilyData(null); // New user - needs onboarding
        }
      } else {
        setFamilyData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // User doesn't exist - auto-create account
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError: any) {
          if (createError.code === 'auth/email-already-in-use') {
            throw new Error('סיסמה שגויה. נסו שוב.');
          }
          throw createError;
        }
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('סיסמה שגויה. נסו שוב.');
      } else {
        throw error;
      }
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setFamilyData(null);
  };

  const saveFamilyData = async (data: FamilyData) => {
    if (!user) return;
    await setDoc(doc(db, 'families', user.uid), data);
    setFamilyData(data);
  };

  const updateFamilyData = async (updates: Partial<FamilyData>) => {
    if (!user) return;
    await updateDoc(doc(db, 'families', user.uid), updates);
    setFamilyData(prev => prev ? { ...prev, ...updates } : null);
  };

  return {
    user,
    loading,
    familyData,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    saveFamilyData,
    updateFamilyData,
    isNewUser: user && !familyData,
  };
}
