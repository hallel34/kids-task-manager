import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const FIREBASE_API_KEY = "AIzaSyBN4NhRe0bgOB80_MWszPNDlTMZMrzPqPo";
export const FIREBASE_PROJECT_ID = "kids-task-manager-fe682";

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "kids-task-manager-fe682.firebaseapp.com",
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: "kids-task-manager-fe682.firebasestorage.app",
  messagingSenderId: "544794671714",
  appId: "1:544794671714:web:d6c092f12120500119af3b",
  measurementId: "G-WQQEZL43BT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;

/** Sign in anonymously so Firestore rules that require auth=non-null pass */
export async function ensureAuth(): Promise<boolean> {
  try {
    if (auth.currentUser) return true;
    await signInAnonymously(auth);
    return true;
  } catch {
    return false;
  }
}
