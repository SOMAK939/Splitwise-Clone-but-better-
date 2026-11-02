/**
 * auth.tsx — keeps track of who is logged in, for the whole app.
 *
 * A React "context" is like a noticeboard every screen can read. We pin the
 * current login session on it, so any screen can call `useAuth()` to ask
 * "who is logged in?" without passing it around by hand.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  /** True until we've checked whether a saved login exists. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    // 1. Check for a login saved from last time.
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false });
    });

    // 2. Listen for future changes: sign in, sign out, token refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });

    // 3. Stop listening when the app closes this component.
    return () => listener.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** Read the current login from any screen. */
export function useAuth() {
  return useContext(AuthContext);
}

/** The logged-in user's id. Only use on screens behind the login wall. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId() used on a screen that does not require login');
  return session.user.id;
}
