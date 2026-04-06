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
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
  soundcloudUrl?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  facebookUrl?: string | null;
  snapchatUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
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

  const deriveDisplayName = useCallback((firebaseUser: User) => {
    const fromProfile = firebaseUser.displayName?.trim();
    if (fromProfile) return fromProfile;
    const email = firebaseUser.email?.trim() ?? '';
    if (!email) return 'User';
    const local = email.split('@')[0]?.trim();
    return local || email;
  }, []);

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

  // Create profile; backend defaults non-admin users to listener.
  const createDefaultProfile = useCallback(async (firebaseUser: User) => {
    await usersApi.create({
      email: firebaseUser.email!,
      displayName: deriveDisplayName(firebaseUser),
    });
    await fetchProfile();
  }, [deriveDisplayName, fetchProfile]);

  // Listen for auth state changes (e.g. page load after redirect)
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          try {
            await createSessionCookie(idToken);
          } catch (sessionErr) {
            // Session cookie helps SSR/middleware, but should not block client login.
            console.warn('Session cookie creation failed on auth change:', sessionErr);
          }
        } catch (tokenErr) {
          console.error('Failed to fetch Firebase ID token:', tokenErr);
          setLoading(false);
          return;
        }
        try {
          const response = await usersApi.getMe();
          if (response.data) {
            setProfile(response.data);
          } else {
            setProfile(null);
          }
        } catch {
          // New user: create profile (backend defaults to listener for non-admin)
          try {
            await createDefaultProfile(firebaseUser);
          } catch (createErr) {
            const apiMessage = (createErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(apiMessage ?? (createErr instanceof Error ? createErr.message : 'Failed to create account'));
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
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
      try {
        await createSessionCookie(idToken);
      } catch (sessionErr) {
        // Keep auth usable when local session endpoint is unavailable.
        console.warn('Session cookie creation failed during Google sign-in:', sessionErr);
      }
      try {
        const response = await usersApi.getMe();
        if (response.data) {
          setProfile(response.data);
          setLoading(false);
          return;
        }
      } catch {
        // New user: create profile (backend defaults to listener)
        try {
          await createDefaultProfile(firebaseUser);
          setLoading(false);
          return;
        } catch (createErr) {
          const apiMessage = (createErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setError(apiMessage ?? (createErr instanceof Error ? createErr.message : 'Failed to create account'));
          throw createErr;
        }
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
      try {
        await createSessionCookie(idToken);
      } catch (sessionErr) {
        // Keep auth usable with bearer tokens even if cookie minting fails.
        console.warn('Session cookie creation failed during email sign-in:', sessionErr);
      }
      
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
    displayName?: string
  ) => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signUpWithEmail(email, password);

      const idToken = await firebaseUser.getIdToken();
      try {
        await createSessionCookie(idToken);
      } catch (sessionErr) {
        // Do not block account creation when session endpoint fails.
        console.warn('Session cookie creation failed during sign-up:', sessionErr);
      }

      // Create profile; backend defaults non-admin users to listener
      await usersApi.create({
        email: firebaseUser.email!,
        displayName:
          displayName?.trim() ||
          deriveDisplayName(firebaseUser),
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
