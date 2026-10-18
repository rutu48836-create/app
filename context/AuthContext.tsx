import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../libs/supabase';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'google' | 'github';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithProvider: (provider: Provider) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithProvider: async (provider) => {
        try {
          if (Platform.OS === 'web') {
            const { error } = await supabase.auth.signInWithOAuth({
              provider,
              options: { redirectTo: window.location.origin },
            });
            return { error: error ? error.message : null };
          }

          const redirectTo = Linking.createURL('/');
          console.log('REDIRECT URL (add to Supabase):', redirectTo);

          const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo, skipBrowserRedirect: true },
          });
          if (error || !data?.url) {
            return { error: error?.message ?? 'Could not start sign in.' };
          }

          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type !== 'success') {
            return { error: null }; // user cancelled
          }

          const url = result.url;

          // PKCE flow: ?code=...
          const parsed = Linking.parse(url);
          const code = parsed.queryParams?.code;
          if (typeof code === 'string') {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            return { error: exchangeError ? exchangeError.message : null };
          }

          // Implicit flow: #access_token=...&refresh_token=...
          const hash = new URLSearchParams(url.split('#')[1] ?? '');
          const access_token = hash.get('access_token');
          const refresh_token = hash.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            return { error: sessionError ? sessionError.message : null };
          }

          return { error: 'Sign in was not completed.' };
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Sign in failed.' };
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}