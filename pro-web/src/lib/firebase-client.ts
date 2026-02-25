'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

function isUsableFirebaseConfig(config: typeof firebaseConfig): boolean {
  const required = [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.appId,
  ];
  if (required.some((value) => !value || value.includes('YOUR_'))) {
    return false;
  }

  // Firebase web API keys are non-secret but must be present and plausible.
  return Boolean(config.apiKey && config.apiKey.length >= 20);
}

if (typeof window !== 'undefined') {
  if (isUsableFirebaseConfig(firebaseConfig)) {
    try {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
    } catch (error) {
      // Keep app usable for non-auth pages when Firebase env vars are invalid.
      console.warn('Firebase client initialization skipped:', error);
      app = null;
      auth = null;
      googleProvider = null;
    }
  } else {
    console.warn('Firebase client configuration missing or invalid. Auth features are disabled until NEXT_PUBLIC_FIREBASE_* vars are set.');
  }
}

// Auth helper functions
export async function signInWithGoogle() {
  if (!auth || !googleProvider) throw new Error('Firebase not initialized');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string) {
  if (!auth) throw new Error('Firebase not initialized');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!auth) throw new Error('Firebase not initialized');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOut() {
  if (!auth) throw new Error('Firebase not initialized');
  
  // Clear session cookie via API
  await fetch('/api/auth/logout', { method: 'POST' });
  
  // Sign out from Firebase
  await firebaseSignOut(auth);
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function onAuthChange(callback: (user: User | null) => void) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export async function createSessionCookie(idToken: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create session');
  }
  
  return response.json();
}

export { auth, googleProvider };
