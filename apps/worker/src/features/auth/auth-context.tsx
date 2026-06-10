import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { AuthMeResponse } from "@/server/auth";

export type AuthSession = AuthMeResponse & { authenticated: true };

interface AuthContextValue {
  loading: boolean;
  session: AuthSession | null;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: () => void;
  signUp: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/auth/me", {
        credentials: "same-origin",
        headers: { accept: "application/json" }
      });
      if (!response.ok)
        throw new Error(`Auth check failed: ${response.status}`);

      const nextSession = (await response.json()) as AuthMeResponse;
      setSession(isAuthSession(nextSession) ? nextSession : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Auth check failed");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(() => {
    window.location.assign(
      `/auth/login?returnTo=${encodeURIComponent(currentReturnTo())}`
    );
  }, []);

  const signUp = useCallback(() => {
    window.location.assign(
      `/auth/signup?returnTo=${encodeURIComponent(currentReturnTo())}`
    );
  }, []);

  const signOut = useCallback(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/logout";
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      error,
      refresh,
      signIn,
      signUp,
      signOut
    }),
    [error, loading, refresh, session, signIn, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

function currentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function isAuthSession(response: AuthMeResponse): response is AuthSession {
  return response.authenticated === true;
}
