import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const updateSession = useCallback((s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateSession(session);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateSession(session);

      // On mobile, after OAuth redirect, the session might not be immediately
      // available due to timing issues with localStorage or URL hash processing.
      // Retry after a short delay if no session was found and we suspect an OAuth callback.
      if (!session) {
        const hash = window.location.hash;
        const search = window.location.search;
        const isOAuthCallback = hash.includes('access_token') || 
                                 hash.includes('refresh_token') ||
                                 search.includes('code=') ||
                                 document.referrer.includes('oauth');
        
        if (isOAuthCallback) {
          // Let Supabase process the hash tokens, then retry
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
              if (retrySession) {
                updateSession(retrySession);
              }
            });
          }, 1000);
        } else {
          // Even without OAuth indicators, retry once after a brief delay
          // to handle mobile edge cases where localStorage isn't immediately synced
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
              if (retrySession) {
                updateSession(retrySession);
              }
            });
          }, 500);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [updateSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
