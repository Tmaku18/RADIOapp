'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
  AuthError,
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

/** sessionStorage keys for OAuth redirect resume */
export const OAUTH_REDIRECT_PATH_KEY = 'networx_oauth_redirect_path';
export const OAUTH_REDIRECT_PENDING_KEY = 'networx_oauth_redirect_pending';

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;
let appleProvider: OAuthProvider;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  appleProvider = new OAuthProvider('apple.com');
  appleProvider.addScope('email');
  appleProvider.addScope('name');
}

function isAuthError(err: unknown): err is AuthError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

/** Popup failures that should fall back to full-page redirect (Safari / blockers). */
function shouldFallbackToRedirect(err: unknown): boolean {
  if (!isAuthError(err)) return false;
  return (
    err.code === 'auth/popup-blocked' ||
    err.code === 'auth/popup-closed-by-user' ||
    err.code === 'auth/cancelled-popup-request'
  );
}

export function mapFirebaseAuthError(err: unknown, fallback: string): string {
  if (!isAuthError(err)) {
    return err instanceof Error && err.message.trim()
      ? err.message
      : fallback;
  }
  switch (err.code) {
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized for sign-in. Ask an admin to add it in Firebase Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Apple sign-in is not enabled for this app yet. Ask an admin to enable the Apple provider in Firebase Authentication.';
    case 'auth/invalid-credential':
    case 'auth/invalid-oauth-client-id':
    case 'auth/invalid-oauth-provider':
      return 'Apple sign-in is misconfigured. Confirm the Apple Services ID, Team ID, and key in Firebase Authentication → Sign-in method → Apple.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Try Google or email instead.';
    case 'auth/network-request-failed':
      return 'Network error during sign-in. Check your connection and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site, or wait for the full-page sign-in.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    default:
      return err.message?.trim() || fallback;
  }
}

/**
 * Persist where to land after a full-page OAuth redirect returns.
 * Call from login/signup before starting Apple/Google sign-in.
 */
export function stashOAuthRedirectPath(path: string) {
  if (typeof window === 'undefined') return;
  try {
    const safe = path.trim() || '/dashboard';
    sessionStorage.setItem(OAUTH_REDIRECT_PATH_KEY, safe);
  } catch {
    // Private mode / blocked storage — redirect will fall back to default.
  }
}

export function takeOAuthRedirectPath(fallback = '/dashboard'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const path = sessionStorage.getItem(OAUTH_REDIRECT_PATH_KEY);
    sessionStorage.removeItem(OAUTH_REDIRECT_PATH_KEY);
    if (path && path.startsWith('/') && !path.startsWith('//')) return path;
  } catch {
    // ignore
  }
  return fallback;
}

function markRedirectPending(provider: 'apple' | 'google') {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(OAUTH_REDIRECT_PENDING_KEY, provider);
  } catch {
    // ignore
  }
}

export function peekOAuthRedirectPending(): 'apple' | 'google' | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(OAUTH_REDIRECT_PENDING_KEY);
    if (v === 'apple' || v === 'google') return v;
  } catch {
    // ignore
  }
  return null;
}

function clearRedirectPending() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
  } catch {
    // ignore
  }
}

async function signInWithProvider(
  provider: GoogleAuthProvider | OAuthProvider,
  kind: 'apple' | 'google',
): Promise<User> {
  if (!auth) throw new Error('Firebase not initialized');
  try {
    const result = await signInWithPopup(auth, provider);
    clearRedirectPending();
    return result.user;
  } catch (err) {
    if (!shouldFallbackToRedirect(err)) throw err;
    // Safari / iOS / popup blockers: leave this page for Apple/Google, then
    // resume via getRedirectResult on return.
    markRedirectPending(kind);
    await signInWithRedirect(auth, provider);
    // Navigation is in progress; callers should not treat this as failure.
    return new Promise<User>(() => undefined);
  }
}

// Auth helper functions
export async function signInWithGoogle() {
  if (!googleProvider) throw new Error('Firebase not initialized');
  return signInWithProvider(googleProvider, 'google');
}

export async function signInWithApple() {
  if (!appleProvider) throw new Error('Firebase not initialized');
  return signInWithProvider(appleProvider, 'apple');
}

/**
 * Finish a full-page OAuth redirect (Apple/Google). Call once on AuthProvider
 * mount. Returns the signed-in user, or null when there was no pending redirect.
 */
export async function completeRedirectSignIn(): Promise<User | null> {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    clearRedirectPending();
    return result?.user ?? null;
  } catch (err) {
    clearRedirectPending();
    throw err;
  }
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

/**
 * Signs the Firebase client SDK in using a one-time custom token. Used by the
 * cross-domain login flow so a member who is already signed in on one Networx
 * domain becomes signed in on the other without re-entering credentials.
 */
export async function signInWithCustomToken(token: string) {
  if (!auth) throw new Error('Firebase not initialized');
  const result = await firebaseSignInWithCustomToken(auth, token);
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
    const payload = await response.json().catch(() => ({}));
    const message =
      payload?.message ||
      payload?.error ||
      payload?.details ||
      'Failed to create session';
    throw new Error(message);
  }

  return response.json();
}

/**
 * Email for backend profile creation. Apple Hide My Email / re-auth can leave
 * Firebase user.email null — use a valid Apple-style relay placeholder.
 */
export function resolveAuthEmail(firebaseUser: User): string {
  const email = firebaseUser.email?.trim();
  if (email) return email;
  return `${firebaseUser.uid}@privaterelay.appleid.com`;
}

export { auth, googleProvider, appleProvider };
