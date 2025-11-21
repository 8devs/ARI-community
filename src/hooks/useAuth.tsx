import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type AppUser = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER';
  organization_id?: string | null;
  name?: string | null;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      if (!response.ok) throw new Error('session failed');
      const data = await response.json();
      setUser(data.user ?? null);
    } catch (error) {
      console.error('session lookup failed', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        return { error: { message: data.error ?? 'Login fehlgeschlagen' } };
      }
      setUser(data.user ?? null);
      return { error: null };
    } catch (error) {
      return { error: { message: 'Login nicht möglich' } };
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const refresh = async () => {
    setLoading(true);
    await fetchSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
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
