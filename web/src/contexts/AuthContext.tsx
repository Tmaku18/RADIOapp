'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  onAuthChange,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getIdToken,
  createSessionCookie,
} from '@/lib/firebase-client';
import { usersApi } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider';
  avatarUrl: string | null;
  createdAt: string;
  region?: string | null;
  suggestLocalArtists?: boolean;
  bio?: string | null;
  headline?: string | null;
  locationRegion?: string | null;
}

interface PendingGoogleUser {
  firebaseUser: User;
  idToken: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  pendingGoogleUser: PendingGoogleUser | null;
  signInWithGoogle: (options?: { intent?: 'login' | 'signup' }) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, role: 'listener' | 'artist' | 'service_provider', displayName?: string) => Promise<void>;
  completeGoogleSignUp: (role: 'listener' | 'artist' | 'service_provider') => Promise<void>;
  cancelGoogleSignUp: () => void;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<PendingGoogleUser | null>(null);

  // Fetch user profile from backend
  const fetchProfile = useCallback(async () => {
    try {
      const response = await usersApi.getMe();
      setProfile(response.data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfile(null);
    }
  }, []);

  // Set role cookie whenever profile has a role so middleware can allow /artist/* and /job-board
  useEffect(() => {
    if (typeof document === 'undefined' || !profile?.role) return;
    const role = profile.role.toLowerCase();
    document.cookie = `user_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }, [profile?.role]);

  const SIGNUP_ROLE_KEY = 'radioapp_signup_role';
  const CHOOSE_ROLE_KEY = 'radioapp_choose_role';
  const AUTH_INTENT_KEY = 'radioapp_auth_intent';

  // Create Supabase profile (name + role). Role optional: when omitted, backend uses admin allowlist or listener.
  const createDefaultProfile = useCallback(async (firebaseUser: User, role?: 'listener' | 'artist' | 'service_provider') => {
    await usersApi.create({
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName?.trim() || undefined,
      ...(role != null ? { role } : {}),
    });
    await fetchProfile();
  }, [fetchProfile]);

  // Try getMe() with a small retry — handles race where session cookie isn't ready yet for existing users
  const fetchProfileWithRetry = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < 2; i++) {
      try {
        const response = await usersApi.getMe();
        if (response.data) {
          setProfile(response.data);
          setPendingGoogleUser(null);
          return true;
        }
      } catch {
        if (i === 0) await new Promise(r => setTimeout(r, 500));
      }
    }
    return false;
  }, []);

  // Listen for auth state changes (e.g. page load after redirect)
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await createSessionCookie(idToken);
        } catch {
          setLoading(false);
          return;
        }
        // Try to load existing profile (with retry for session-cookie race)
        const found = await fetchProfileWithRetry();
        if (!found && typeof window !== 'undefined') {
          const intent = sessionStorage.getItem(AUTH_INTENT_KEY);
          if (intent === 'login') {
            sessionStorage.removeItem(AUTH_INTENT_KEY);
            setError('No account found with this email. Please sign up first.');
            setProfile(null);
            setLoading(false);
            signOut().catch(console.error);
            return;
          }
        }
        if (!found) {
          // New user (signup flow): signup role in sessionStorage, admin allowlist, explicit choose-role flag, or default listener
          let created = false;
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(AUTH_INTENT_KEY);
            const stored = sessionStorage.getItem(SIGNUP_ROLE_KEY);
            if (stored === 'artist' || stored === 'listener' || stored === 'service_provider') {
              sessionStorage.removeItem(SIGNUP_ROLE_KEY);
              try {
                await createDefaultProfile(firebaseUser, stored);
                created = true;
              } catch {
                // Creation failed — user may already exist; retry getMe
                const retryOk = await fetchProfileWithRetry();
                if (retryOk) created = true;
              }
            }
            if (!created) {
              try {
                const { data } = await usersApi.checkAdmin();
                if (data?.isAdmin) {
                  await createDefaultProfile(firebaseUser);
                  created = true;
                }
              } catch {
                // ignore
              }
            }
            // If user explicitly asked to choose role, show modal; otherwise default to listener
            if (!created) {
              const wantsToChoose = sessionStorage.getItem(CHOOSE_ROLE_KEY);
              if (wantsToChoose) {
                sessionStorage.removeItem(CHOOSE_ROLE_KEY);
              } else {
                try {
                  await createDefaultProfile(firebaseUser, 'listener');
                  created = true;
                } catch {
                  const retryOk = await fetchProfileWithRetry();
                  if (retryOk) created = true;
                }
              }
            }
          }
          if (!created) {
            setPendingGoogleUser({ firebaseUser, idToken: await firebaseUser.getIdToken() });
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
        setPendingGoogleUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [createDefaultProfile]);

  const handleSignInWithGoogle = async (options?: { intent?: 'login' | 'signup' }) => {
    const intent = options?.intent ?? 'signup';
    setError(null);
    setLoading(true);
    if (typeof window !== 'undefined') {
      if (intent === 'login') {
        sessionStorage.removeItem(SIGNUP_ROLE_KEY);
        sessionStorage.removeItem(CHOOSE_ROLE_KEY);
        sessionStorage.setItem(AUTH_INTENT_KEY, 'login');
      } else {
        sessionStorage.setItem(AUTH_INTENT_KEY, 'signup');
      }
    }
    try {
      const firebaseUser = await signInWithGoogle();
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      // Try to load existing profile (with retry for session-cookie race)
      const found = await fetchProfileWithRetry();
      if (found) {
        if (typeof window !== 'undefined') sessionStorage.removeItem(AUTH_INTENT_KEY);
        setLoading(false);
        return;
      }

      // Login intent: never create; show error and sign out
      if (intent === 'login' && typeof window !== 'undefined') {
        sessionStorage.removeItem(AUTH_INTENT_KEY);
        setError('No account found with this email. Please sign up first.');
        setLoading(false);
        signOut().catch(console.error);
        return;
      }

      // Signup intent: new user — signup role in sessionStorage, admin allowlist, choose-role, or default listener
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(SIGNUP_ROLE_KEY);
        if (stored === 'artist' || stored === 'listener' || stored === 'service_provider') {
          sessionStorage.removeItem(SIGNUP_ROLE_KEY);
          try {
            await createDefaultProfile(firebaseUser, stored);
            setLoading(false);
            return;
          } catch {
            const retryOk = await fetchProfileWithRetry();
            if (retryOk) { setLoading(false); return; }
          }
        }
        try {
          const { data } = await usersApi.checkAdmin();
          if (data?.isAdmin) {
            await createDefaultProfile(firebaseUser);
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
        const wantsToChoose = sessionStorage.getItem(CHOOSE_ROLE_KEY);
        if (wantsToChoose) {
          sessionStorage.removeItem(CHOOSE_ROLE_KEY);
        } else {
          try {
            await createDefaultProfile(firebaseUser, 'listener');
            setLoading(false);
            return;
          } catch {
            const retryOk = await fetchProfileWithRetry();
            if (retryOk) { setLoading(false); return; }
          }
        }
      }
      setPendingGoogleUser({ firebaseUser, idToken });
      setProfile(null);
      setLoading(false);
    } catch (err) {
      if (typeof window !== 'undefined') sessionStorage.removeItem(AUTH_INTENT_KEY);
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Failed to sign in with Google');
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const completeGoogleSignUp = async (role: 'listener' | 'artist' | 'service_provider') => {
    if (!pendingGoogleUser) {
      setError('No pending Google sign-up');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { firebaseUser } = pendingGoogleUser;
      
      // Create user profile in backend with selected role
      await usersApi.create({
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || undefined,
        role,
      });
      
      await fetchProfile();
      setPendingGoogleUser(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const fallback =
        status === 404
          ? 'Sign-up service unavailable. Please try again later or contact support.'
          : err instanceof Error
            ? err.message
            : 'Failed to complete sign up';
      const message = apiMessage ?? fallback;
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelGoogleSignUp = () => {
    setPendingGoogleUser(null);
    // Sign out of Firebase since they cancelled
    signOut().catch(console.error);
  };

  const handleSignInWithEmail = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signInWithEmail(email, password);
      
      // Get ID token and create session cookie
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      
      await fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpWithEmail = async (
    email: string,
    password: string,
    role: 'listener' | 'artist' | 'service_provider',
    displayName?: string
  ) => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signUpWithEmail(email, password);

      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);

      // Create Supabase user with chosen role and name (Firebase → equivalent Supabase row)
      await usersApi.create({
        email: firebaseUser.email!,
        displayName: (displayName?.trim() || firebaseUser.displayName) || undefined,
        role,
      });

      await fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign up';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
      setProfile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    error,
    pendingGoogleUser,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    completeGoogleSignUp,
    cancelGoogleSignUp,
    signOut: handleSignOut,
    getIdToken,
    refreshProfile: fetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
