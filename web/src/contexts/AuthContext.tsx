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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, role: 'listener' | 'artist' | 'service_provider') => Promise<void>;
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

  const SIGNUP_ROLE_KEY = 'radioapp_signup_role';

  // Create backend profile. Role optional: when omitted, backend assigns admin if email in allowlist, else listener.
  const createDefaultProfile = useCallback(async (firebaseUser: User, role?: 'listener' | 'artist' | 'service_provider') => {
    await usersApi.create({
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || undefined,
      ...(role != null ? { role } : {}),
    });
    await fetchProfile();
  }, [fetchProfile]);

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
        try {
          const response = await usersApi.getMe();
          if (response.data) {
            setProfile(response.data);
            setPendingGoogleUser(null);
          } else {
            setProfile(null);
          }
        } catch {
          // New user: signup role in sessionStorage, or admin allowlist, or show role modal
          let created = false;
          if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem(SIGNUP_ROLE_KEY);
            if (stored === 'artist' || stored === 'listener' || stored === 'service_provider') {
              sessionStorage.removeItem(SIGNUP_ROLE_KEY);
              try {
                await createDefaultProfile(firebaseUser, stored);
                created = true;
              } catch (createErr) {
                const apiMessage = (createErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
                setError(apiMessage ?? (createErr instanceof Error ? createErr.message : 'Failed to create account'));
                setProfile(null);
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
                // ignore; will show role modal
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

  const handleSignInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      try {
        const response = await usersApi.getMe();
        if (response.data) {
          setProfile(response.data);
          setLoading(false);
          return;
        }
      } catch {
        // New user: signup role in sessionStorage, or admin allowlist, or ask (set pending)
        if (typeof window !== 'undefined') {
          const stored = sessionStorage.getItem(SIGNUP_ROLE_KEY);
          if (stored === 'artist' || stored === 'listener' || stored === 'service_provider') {
            sessionStorage.removeItem(SIGNUP_ROLE_KEY);
            try {
              await createDefaultProfile(firebaseUser, stored);
              setLoading(false);
              return;
            } catch (createErr) {
              const apiMessage = (createErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
              setError(apiMessage ?? (createErr instanceof Error ? createErr.message : 'Failed to create account'));
              throw createErr;
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
            // ignore; will show role modal
          }
        }
        setPendingGoogleUser({ firebaseUser, idToken });
        setProfile(null);
      }
      setLoading(false);
    } catch (err) {
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
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const message = apiMessage ?? (err instanceof Error ? err.message : 'Failed to complete sign up');
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
    role: 'listener' | 'artist' | 'service_provider'
  ) => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signUpWithEmail(email, password);
      
      // Get ID token and create session cookie
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      
      // Create user profile in backend
      await usersApi.create({
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || undefined,
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
