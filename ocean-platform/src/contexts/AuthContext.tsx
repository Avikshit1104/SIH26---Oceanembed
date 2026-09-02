import React, { createContext, useContext, useState, useCallback } from 'react';

export type UserRole = 'general' | 'government' | null;

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  login: (email: string, password: string, role: 'general' | 'government') => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isGovernment: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock credentials — in production, replace with real API calls
const MOCK_USERS = {
  general: { email: 'user@ocean.gov', password: 'ocean123', name: 'Ocean Analyst', id: 'u1' },
  government: { email: 'gov@ndma.gov.in', password: 'gov@2026', name: 'NDMA Officer', id: 'g1' },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('ocean_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (
    email: string,
    password: string,
    role: 'general' | 'government'
  ): Promise<boolean> => {
    // Simulate async auth
    await new Promise(r => setTimeout(r, 800));
    const mock = MOCK_USERS[role];
    if (email === mock.email && password === mock.password) {
      const newUser: User = { id: mock.id, name: mock.name, email: mock.email, role };
      setUser(newUser);
      localStorage.setItem('ocean_user', JSON.stringify(newUser));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ocean_user');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role ?? null,
      login,
      logout,
      isAuthenticated: !!user,
      isGovernment: user?.role === 'government',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
