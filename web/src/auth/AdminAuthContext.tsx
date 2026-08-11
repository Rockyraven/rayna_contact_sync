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
  email: string;
  name: string | null;
  avatar_url: string | null;
};

type AdminAuthState = {
  token: string | null;
  user: AdminUser | null;
  initializing: boolean;
  error: string | null;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => void;
};

const SESSION_KEY = 'rayna_admin_session';
const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [initializing, setInitializing] = useState(true);
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

  const signInWithGoogle = useCallback(async (idToken: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        throw new Error(`Sign-in failed with status ${res.status}`);
      }
      const json = (await res.json()) as { token: string; user: AdminUser };
      setToken(json.token);
      setUser(json.user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const value = useMemo(
    () => ({ token, user, initializing, error, signInWithGoogle, signOut }),
    [token, user, initializing, error, signInWithGoogle, signOut],
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
