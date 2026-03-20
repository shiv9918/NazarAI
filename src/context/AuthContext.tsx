import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type UserRole = 'citizen' | 'municipal' | 'department' | 'admin';

interface UserProfile {
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  points?: number;
  department?: string;
  uid: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  setSession: (token: string, userProfile: UserProfile) => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'nazarai_auth_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function fetchCurrentUser(token: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to fetch user profile.');
  }

  if (!data?.user) {
    throw new Error('Invalid auth response.');
  }

  return data.user as UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!token) {
      setUser(null);
      return;
    }

    try {
      const profile = await fetchCurrentUser(token);
      setUser(profile);
    } catch (error) {
      console.error('Profile fetch error:', error);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const setSession = useCallback((token: string, userProfile: UserProfile) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setUser(userProfile);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
  }, []);

  const isPublicPage = location.pathname === '/' || location.pathname === '/login';
  const shouldShowSpinner = loading && !isPublicPage;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        setSession,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {shouldShowSpinner ? (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 z-[9999]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin dark:border-blue-400 dark:border-t-transparent"></div>
            <p className="text-slate-500 font-bold animate-pulse dark:text-slate-400">Loading your profile...</p>
          </div>
        </div>
      ) : (
        children
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
