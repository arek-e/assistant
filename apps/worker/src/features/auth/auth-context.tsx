import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import type { AuthMeResponse } from "@/server/auth";

export type AuthSession = AuthMeResponse & { authenticated: true };
export type AuthDemoUser = NonNullable<AuthMeResponse["demoUsers"]>[number];

interface AuthContextValue {
  loading: boolean;
  session: AuthSession | null;
  demoUsers: AuthDemoUser[];
  error: string | null;
  refresh: () => Promise<void>;
  signIn: () => void;
  signUp: () => void;
  demoSignIn: (userId: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
AuthContext.displayName = "AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [demoUsers, setDemoUsers] = useState<AuthDemoUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await loadAuthSession();
    setSession(result.session);
    setDemoUsers(result.demoUsers);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(() => {
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
  }, []);

  const signUp = useCallback(() => {
    window.location.assign(`/auth/signup?returnTo=${encodeURIComponent(currentReturnTo())}`);
  }, []);

  const demoSignIn = useCallback((userId: string) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/auth/demo?user=${encodeURIComponent(
      userId
    )}&returnTo=${encodeURIComponent(currentReturnTo())}`;
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
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
      demoUsers,
      error,
      refresh,
      signIn,
      signUp,
      demoSignIn,
      signOut
    }),
    [demoSignIn, demoUsers, error, loading, refresh, session, signIn, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

function currentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function isAuthSession(response: AuthMeResponse): response is AuthSession {
  return response.authenticated === true;
}

interface AuthSessionLoadResult {
  session: AuthSession | null;
  demoUsers: AuthDemoUser[];
  error: string | null;
}

async function loadAuthSession(): Promise<AuthSessionLoadResult> {
  try {
    const nextSession = await fetchAuthMe();
    return {
      session: isAuthSession(nextSession) ? nextSession : null,
      demoUsers: [...(nextSession.demoUsers ?? [])],
      error: null
    };
  } catch (caught) {
    return {
      session: null,
      demoUsers: [],
      error: authErrorMessage(caught)
    };
  }
}

async function fetchAuthMe(): Promise<AuthMeResponse> {
  const response = await fetch("/auth/me", {
    credentials: "same-origin",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Auth check failed: ${response.status}`);

  return (await response.json()) as AuthMeResponse;
}

function authErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Auth check failed";
}
