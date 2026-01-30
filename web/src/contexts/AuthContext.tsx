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
  role: 'listener' | 'artist' | 'admin';
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: (role?: 'listener' | 'artist') => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, role: 'listener' | 'artist') => Promise<void>;
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
    } catch (err: unknown) {
      // 404 means user exists in Firebase but not in Supabase
      // This is expected during signup - profile will be created separately
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        console.log('User profile not found in database');
      } else {
        console.error('Failed to fetch profile:', err);
      }
      setProfile(null);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in, fetch profile
        await fetchProfile();
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const handleSignInWithGoogle = async (role?: 'listener' | 'artist') => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();
      
      // Get ID token and create session cookie
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      
      // If role is provided, this is a signup - create the user profile
      if (role && firebaseUser.email) {
        try {
          await usersApi.create({
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || undefined,
            role,
          });
        } catch (createErr: unknown) {
          // Ignore if user already exists (409 conflict)
          const axiosError = createErr as { response?: { status?: number } };
          if (axiosError.response?.status !== 409) {
            throw createErr;
          }
        }
      }
      
      // Fetch profile
      await fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
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
      
      // Fetch profile
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
    role: 'listener' | 'artist'
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
