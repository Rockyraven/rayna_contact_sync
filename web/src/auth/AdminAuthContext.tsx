import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_BASE_URL } from '../config';

type AdminUser = {
  id: number;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
};

type AdminAuthState = {
  token: string | null;
  user: AdminUser | null;
  initializing: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => void;
};

const SESSION_KEY = 'rayna_admin_session';
const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string; user: AdminUser };
      setToken(parsed.token);
      setUser(parsed.user);
    }
    setInitializing(false);
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    setError(null);
    setSigningIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? `Sign-in failed with status ${res.status}`);
      }
      const { token: nextToken, user: nextUser } = body as { token: string; user: AdminUser };
      setToken(nextToken);
      setUser(nextUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const value = useMemo(
    () => ({ token, user, initializing, signingIn, error, signIn, signOut }),
    [token, user, initializing, signingIn, error, signIn, signOut],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
