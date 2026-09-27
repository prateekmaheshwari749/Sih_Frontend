import React, { createContext, useContext, useState, useCallback } from 'react';

export type UserRole = 'general' | 'government' | 'researcher' | 'admin' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle?: string;
}

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  login: (email: string, password: string, role?: 'general' | 'government' | 'researcher' | 'admin') => Promise<boolean>;
  quickLogin: (role: 'general' | 'government' | 'researcher' | 'admin') => void;
  logout: () => void;
  isAuthenticated: boolean;
  isGovernment: boolean;
  isResearcher: boolean;
  isAdmin: boolean;
  canAccessGov: boolean;
  canAccessDocs: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock credentials for each authorized persona
export const MOCK_USERS: Record<'general' | 'government' | 'researcher' | 'admin', {
  email: string;
  password: string;
  name: string;
  id: string;
  roleTitle: string;
  description: string;
}> = {
  general: {
    email: 'user@ocean.gov',
    password: 'ocean123',
    name: 'Ocean Analyst',
    id: 'u1',
    roleTitle: 'Citizen / Ocean Analyst',
    description: 'Access standard ocean forecasts, surface data, 3D maps & AI chat.',
  },
  government: {
    email: 'gov@ndma.gov.in',
    password: 'gov@2026',
    name: 'NDMA Officer',
    id: 'g1',
    roleTitle: 'National Disaster Official',
    description: 'Authorizes emergency cyclone advisories & coastal evacuations.',
  },
  researcher: {
    email: 'research@ocean.gov',
    password: 'science@2026',
    name: 'Dr. Sharma (Senior Oceanographer)',
    id: 'r1',
    roleTitle: 'Research Scientist & ML Engineer',
    description: 'Inspects technical architecture, tensor equations & documentation.',
  },
  admin: {
    email: 'admin@ocean.gov',
    password: 'admin@2026',
    name: 'Chief Director',
    id: 'a1',
    roleTitle: 'System Superadministrator',
    description: 'Full uninhibited access across all government, research & public portals.',
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('ocean_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (
    email: string,
    password: string,
    role?: 'general' | 'government' | 'researcher' | 'admin'
  ): Promise<boolean> => {
    // Simulate async network auth
    await new Promise(r => setTimeout(r, 400));

    // If specific role requested, check that persona
    if (role && MOCK_USERS[role]) {
      const mock = MOCK_USERS[role];
      if (email.trim().toLowerCase() === mock.email.toLowerCase() && password === mock.password) {
        const newUser: User = {
          id: mock.id,
          name: mock.name,
          email: mock.email,
          role,
          roleTitle: mock.roleTitle,
        };
        setUser(newUser);
        localStorage.setItem('ocean_user', JSON.stringify(newUser));
        return true;
      }
    }

    // Match against any mock user by email & password
    for (const [key, mock] of Object.entries(MOCK_USERS)) {
      if (email.trim().toLowerCase() === mock.email.toLowerCase() && password === mock.password) {
        const matchedRole = key as 'general' | 'government' | 'researcher' | 'admin';
        const newUser: User = {
          id: mock.id,
          name: mock.name,
          email: mock.email,
          role: matchedRole,
          roleTitle: mock.roleTitle,
        };
        setUser(newUser);
        localStorage.setItem('ocean_user', JSON.stringify(newUser));
        return true;
      }
    }

    return false;
  }, []);

  const quickLogin = useCallback((role: 'general' | 'government' | 'researcher' | 'admin') => {
    const mock = MOCK_USERS[role];
    if (mock) {
      const newUser: User = {
        id: mock.id,
        name: mock.name,
        email: mock.email,
        role,
        roleTitle: mock.roleTitle,
      };
      setUser(newUser);
      localStorage.setItem('ocean_user', JSON.stringify(newUser));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ocean_user');
  }, []);

  const isGovernment = user?.role === 'government' || user?.role === 'admin';
  const isResearcher = user?.role === 'researcher' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role ?? null,
      login,
      quickLogin,
      logout,
      isAuthenticated: !!user,
      isGovernment,
      isResearcher,
      isAdmin,
      canAccessGov: isGovernment,
      canAccessDocs: isResearcher || isGovernment,
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
