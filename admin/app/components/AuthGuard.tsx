'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // Redirect to login if not authenticated
      if (!user && pathname !== '/login') {
        router.push('/login');
      }
      
      // Redirect to login if authenticated but not admin
      if (user && !isAdmin && pathname !== '/login') {
        // Show access denied message then redirect
        router.push('/login?error=access_denied');
      }
      
      // Redirect to dashboard if authenticated and on login page
      if (user && isAdmin && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, loading, isAdmin, pathname, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied message
  if (user && !isAdmin && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don&apos;t have permission to access the admin dashboard.
          </p>
          <p className="text-sm text-gray-500">
            Logged in as: {user.email}
          </p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated (except login page)
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
