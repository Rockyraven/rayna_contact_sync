import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { API_BASE_URL, GOOGLE_WEB_CLIENT_ID } from '../config';

type SessionUser = {
  id: number;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  username: string | null;
  phone_number: string | null;
};

export type RegisterFields = {
  name?: string;
  identifier: string;
  password: string;
};

type AuthState = {
  token: string | null;
  user: SessionUser | null;
  initializing: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signInWithPassword: (identifier: string, password: string) => Promise<void>;
  register: (fields: RegisterFields) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const SESSION_KEY = 'rayna_session';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  console.log("API_BASE_URL", API_BASE_URL)

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { token: string; user: SessionUser };
        setToken(parsed.token);
        setUser(parsed.user);
      }
      setInitializing(false);
    })();
  }, []);

  const persistSession = useCallback(async (nextToken: string, nextUser: SessionUser) => {
    setToken(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return;
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error('Google did not return an ID token');
      }

      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        throw new Error(`Backend rejected sign-in (status ${res.status})`);
      }
      const json = (await res.json()) as { token: string; user: SessionUser };
      await persistSession(json.token, json.user);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled, not an error worth surfacing
      } else {
        setError(e instanceof Error ? e.message : 'Sign-in failed');
      }
    } finally {
      setSigningIn(false);
    }
  }, [persistSession]);

  const signInWithPassword = useCallback(
    async (identifier: string, password: string) => {
      setError(null);
      setSigningIn(true);
      console.log( "res ", {identifier, password})
      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        console.log(res, "res ", {identifier, password})
        const json = (await res.json()) as { token?: string; user?: SessionUser; error?: string };
        if (!res.ok || !json.token || !json.user) {
          throw new Error(json.error ?? 'Login failed');
        }
        await persistSession(json.token, json.user);
      } catch (e) {
        console.log("error ", e)
        setError(e instanceof Error ? e.message : 'Login failed');
      } finally {
        setSigningIn(false);
      }
    },
    [persistSession],
  );

  const register = useCallback(
    async (fields: RegisterFields) => {
      setError(null);
      setSigningIn(true);
      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        });
        const json = (await res.json()) as { token?: string; user?: SessionUser; error?: string };
        if (!res.ok || !json.token || !json.user) {
          throw new Error(json.error ?? 'Registration failed');
        }
        await persistSession(json.token, json.user);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Registration failed');
      } finally {
        setSigningIn(false);
      }
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore, we're clearing local session regardless
    }
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      initializing,
      signingIn,
      error,
      signIn,
      signInWithPassword,
      register,
      signOut,
    }),
    [token, user, initializing, signingIn, error, signIn, signInWithPassword, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
