'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
import { DisplayNameGate } from '@/components/DisplayNameGate';

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | 'dj' | 'musician';
  avatarUrl: string | null;
  createdAt: string;
  region?: string | null;
  suggestLocalArtists?: boolean;
  notifyFollowedArtistOnRadio?: boolean;
  discoverable?: boolean;
  favoriteGenres?: string[];
  genreOnboardingCompletedAt?: string | null;
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
  pendingProfileSetup: boolean;
  completeProfileSetup: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when an authenticated user has no backend profile yet and must pick a
  // display name before continuing (mainly new Google/Apple sign-ups).
  const [pendingProfileSetup, setPendingProfileSetup] = useState(false);
  // Suppresses the auto-setup gate while the email sign-up flow is creating the
  // profile itself, so the background listener doesn't race it.
  const suppressAutoSetupRef = useRef(false);
  const AUTH_BOOT_TIMEOUT_MS = 15000;

  const getHttpStatus = useCallback((err: unknown): number | null => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    return typeof status === 'number' ? status : null;
  }, []);

  const withTimeout = useCallback(
    async <T,>(promise: Promise<T>, timeoutMs = AUTH_BOOT_TIMEOUT_MS): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), timeoutMs),
        ),
      ]);
    },
    [],
  );

  // A display name is mandatory at sign-up. We only ever pre-fill from the
  // identity provider's real name (Google/Apple); we never fall back to the
  // email prefix, so new OAuth users without a provider name are required to
  // choose one before their account is created.
  const providerDisplayName = useCallback((firebaseUser: User) => {
    return firebaseUser.displayName?.trim() ?? '';
  }, []);

  // Fetch user profile from backend
  const fetchProfile = useCallback(async () => {
    try {
      const response = await withTimeout(usersApi.getMe());
      setProfile(response.data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      // Preserve last known profile on transient failures/timeouts.
    }
  }, [withTimeout]);

  // Set role cookie whenever profile has a role so middleware can allow /artist/* and /job-board
  useEffect(() => {
    if (typeof document === 'undefined' || !profile?.role) return;
    const role = profile.role.toLowerCase();
    document.cookie = `user_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }, [profile?.role]);

  // Finishes account creation once a display name has been chosen. Used by the
  // mandatory display-name gate for new OAuth users.
  const completeProfileSetup = useCallback(
    async (displayName: string) => {
      const name = displayName.trim();
      if (!name) {
        throw new Error('Display name is required');
      }
      const current = user;
      if (!current?.email) {
        throw new Error('You must be signed in to finish setting up your account.');
      }
      await usersApi.create({ email: current.email, displayName: name });
      await fetchProfile();
      setPendingProfileSetup(false);
    },
    [user, fetchProfile],
  );

  // Listen for auth state changes (e.g. page load after redirect)
  useEffect(() => {
    const bootTimeout = setTimeout(() => {
      setLoading(false);
    }, AUTH_BOOT_TIMEOUT_MS);

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      clearTimeout(bootTimeout);
      setUser(firebaseUser);
      // Never block the app shell on profile/session network calls.
      setLoading(false);
      
      if (firebaseUser) {
        try {
          const response = await withTimeout(usersApi.getMe());
          if (response.data) {
            setProfile(response.data);
            setPendingProfileSetup(false);
          } else {
            setProfile(null);
          }
        } catch (err) {
          // Only require profile setup when backend confirms the row is missing.
          if (getHttpStatus(err) !== 404) {
            return;
          }
          // The email sign-up flow creates the profile itself; don't race it.
          if (suppressAutoSetupRef.current) {
            return;
          }
          // New user (typically a Google/Apple sign-up): require a display name
          // before the account is created. The gate handles creation.
          setProfile(null);
          setPendingProfileSetup(true);
        }
      } else {
        setProfile(null);
        setPendingProfileSetup(false);
      }
    });

    return () => {
      clearTimeout(bootTimeout);
      unsubscribe();
    };
  }, [withTimeout, getHttpStatus]);

  // Background reconciliation: if auth exists but profile is missing, keep retrying.
  // This prevents users getting stuck in unresolved "Loading..." role states.
  useEffect(() => {
    if (!user || loading || profile) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        await fetchProfile();
      } catch {
        // Best-effort; keep retrying in the background.
      }
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, profile, loading, fetchProfile]);

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
          setPendingProfileSetup(false);
          setLoading(false);
          return;
        }
      } catch (err) {
        if (getHttpStatus(err) !== 404) {
          setLoading(false);
          return;
        }
        // New user: require a display name before creating the account. The
        // gate (rendered globally) collects it and finishes setup. We pre-fill
        // with the Google profile name when available, never the email prefix.
        setProfile(null);
        setPendingProfileSetup(true);
        setLoading(false);
        return;
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
    const name = displayName?.trim() ?? '';
    if (!name) {
      setLoading(false);
      const message = 'Display name is required';
      setError(message);
      throw new Error(message);
    }
    suppressAutoSetupRef.current = true;
    try {
      const firebaseUser = await signUpWithEmail(email, password);

      const idToken = await firebaseUser.getIdToken();
      try {
        await createSessionCookie(idToken);
      } catch (sessionErr) {
        // Do not block account creation when session endpoint fails.
        console.warn('Session cookie creation failed during sign-up:', sessionErr);
      }

      // Create profile with the required display name; backend defaults
      // non-admin users to listener.
      await usersApi.create({
        email: firebaseUser.email!,
        displayName: name,
      });

      setPendingProfileSetup(false);
      await fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign up';
      setError(message);
      throw err;
    } finally {
      suppressAutoSetupRef.current = false;
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
    pendingProfileSetup,
    completeProfileSetup,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {pendingProfileSetup && user && (
        <DisplayNameGate
          suggestedName={providerDisplayName(user)}
          email={user.email ?? ''}
          onSubmit={completeProfileSetup}
          onCancel={handleSignOut}
        />
      )}
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
