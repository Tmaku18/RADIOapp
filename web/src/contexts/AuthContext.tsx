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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, role: 'listener' | 'artist' | 'service_provider', displayName?: string) => Promise<void>;
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
          return true;
        }
      } catch {
        if (i === 0) await new Promise(r => setTimeout(r, 500));
      }
    }
    return false;
  }, []);

  const createProfileForNewUser = useCallback(async (firebaseUser: User): Promise<boolean> => {
    try {
      const { data } = await usersApi.checkAdmin();
      if (data?.isAdmin) {
        await createDefaultProfile(firebaseUser);
        return true;
      }
    } catch {
      // ignore
    }

    try {
      await createDefaultProfile(firebaseUser, 'listener');
      return true;
    } catch {
      return await fetchProfileWithRetry();
    }
  }, [createDefaultProfile, fetchProfileWithRetry]);

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
        if (!found) {
          const created = await createProfileForNewUser(firebaseUser);
          if (!created) {
            setError('We could not finish setting up your account. Please try again.');
            await signOut().catch(() => undefined);
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [createProfileForNewUser, fetchProfileWithRetry]);

  const handleSignInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      // Try to load existing profile (with retry for session-cookie race)
      const found = await fetchProfileWithRetry();
      if (found) {
        setLoading(false);
        return;
      }

      const created = await createProfileForNewUser(firebaseUser);
      if (!created) {
        setError('We could not finish setting up your account. Please try again.');
        await signOut().catch(() => undefined);
        setProfile(null);
        setLoading(false);
        throw new Error('Failed to complete account setup');
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
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
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
