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
  signUpWithEmail: (email: string, password: string, role: 'listener' | 'artist') => Promise<void>;
  completeGoogleSignUp: (role: 'listener' | 'artist') => Promise<void>;
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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in, try to fetch profile
        try {
          const response = await usersApi.getMe();
          if (response.data) {
            setProfile(response.data);
          } else {
            // No profile data - user needs to complete registration
            const idToken = await firebaseUser.getIdToken();
            setPendingGoogleUser({ firebaseUser, idToken });
            setProfile(null);
          }
        } catch (err) {
          // Profile fetch failed - user likely doesn't exist in Supabase
          // Set pending state so they can complete registration
          console.log('User exists in Firebase but not in Supabase - prompting for registration');
          try {
            const idToken = await firebaseUser.getIdToken();
            setPendingGoogleUser({ firebaseUser, idToken });
          } catch {
            console.error('Failed to get ID token for pending user');
          }
          setProfile(null);
        }
      } else {
        setProfile(null);
        setPendingGoogleUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();
      
      // Get ID token and create session cookie
      const idToken = await firebaseUser.getIdToken();
      await createSessionCookie(idToken);
      
      // Try to fetch existing profile
      try {
        const response = await usersApi.getMe();
        if (response.data) {
          // Existing user, just set profile
          setProfile(response.data);
          setLoading(false);
          return;
        }
      } catch {
        // Profile doesn't exist - this is a new user
        // Store pending state and show role selection modal
        setPendingGoogleUser({ firebaseUser, idToken });
        setLoading(false);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const completeGoogleSignUp = async (role: 'listener' | 'artist') => {
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
      const message = err instanceof Error ? err.message : 'Failed to complete sign up';
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
