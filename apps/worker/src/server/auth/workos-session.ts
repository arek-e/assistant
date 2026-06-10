import { WorkOS, type User, type WorkOSOptions } from "@workos-inc/node";

export interface WorkOSSessionEnv {
  AUTH_IDENTITY_ADAPTER?: string;
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_COOKIE_PASSWORD?: string;
  WORKOS_API_HOSTNAME?: string;
  WORKOS_REDIRECT_URI?: string;
  WORKOS_RETURN_TO?: string;
  WORKOS_SESSION_COOKIE?: string;
  WORKOS_STATE_COOKIE?: string;
}

export interface WorkOSAuthenticatedSession {
  accessToken: string;
  sessionId: string;
  organizationId?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  entitlements?: string[];
  featureFlags?: string[];
  user: User;
  sealedSession?: string;
}

export type WorkOSSessionResult =
  | {
      authenticated: true;
      session: WorkOSAuthenticatedSession;
      sealedSession?: string;
    }
  | {
      authenticated: false;
      reason: string;
      clearSession?: boolean;
    };

interface LoginState {
  nonce: string;
  returnTo: string;
}

interface AuthenticatedWorkOSResponse {
  authenticated: true;
  accessToken?: string;
  session?: { accessToken?: string };
  sessionId: string;
  organizationId?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  entitlements?: string[];
  featureFlags?: string[];
  user: User;
  sealedSession?: string;
}

const defaultSessionCookieName = "wos-session";
const defaultStateCookieName = "wos-login-state";
const defaultLoginReturnTo = "/";

export function isWorkOSMode(env: WorkOSSessionEnv): boolean {
  return env.AUTH_IDENTITY_ADAPTER === "workos";
}

export function isWorkOSAuthConfigured(env: WorkOSSessionEnv): boolean {
  return Boolean(env.WORKOS_API_KEY && env.WORKOS_CLIENT_ID && env.WORKOS_COOKIE_PASSWORD);
}

export function getWorkOSSessionCookieName(env: WorkOSSessionEnv): string {
  return env.WORKOS_SESSION_COOKIE ?? defaultSessionCookieName;
}

export function getWorkOSStateCookieName(env: WorkOSSessionEnv): string {
  return env.WORKOS_STATE_COOKIE ?? defaultStateCookieName;
}

export function createWorkOSClient(env: WorkOSSessionEnv): WorkOS {
  const options: WorkOSOptions = {
    apiKey: env.WORKOS_API_KEY,
    clientId: env.WORKOS_CLIENT_ID
  };

  if (env.WORKOS_API_HOSTNAME) options.apiHostname = env.WORKOS_API_HOSTNAME;

  return new WorkOS(options);
}

export async function authenticateWorkOSSession(
  request: Request,
  env: WorkOSSessionEnv,
  { refresh = false }: { refresh?: boolean } = {}
): Promise<WorkOSSessionResult> {
  if (!isWorkOSAuthConfigured(env)) {
    return { authenticated: false, reason: "workos_not_configured" };
  }
  const cookiePassword = env.WORKOS_COOKIE_PASSWORD;
  if (!cookiePassword) {
    return { authenticated: false, reason: "workos_not_configured" };
  }

  const sessionData = getCookieValue(request, getWorkOSSessionCookieName(env));
  if (!sessionData) {
    return { authenticated: false, reason: "no_session_cookie_provided" };
  }

  const workos = createWorkOSClient(env);
  const session = workos.userManagement.loadSealedSession({
    sessionData,
    cookiePassword
  });
  const authResult = await session.authenticate();

  if (authResult.authenticated) {
    return {
      authenticated: true,
      session: toAuthenticatedSession(authResult)
    };
  }

  if (!refresh) {
    return {
      authenticated: false,
      reason: authResult.reason,
      clearSession: authResult.reason !== "no_session_cookie_provided"
    };
  }

  try {
    const refreshResult = await session.refresh({
      cookiePassword
    });

    if (!refreshResult.authenticated) {
      return {
        authenticated: false,
        reason: refreshResult.reason,
        clearSession: refreshResult.reason !== "no_session_cookie_provided"
      };
    }

    return {
      authenticated: true,
      session: toAuthenticatedSession(refreshResult),
      sealedSession: refreshResult.sealedSession
    };
  } catch {
    return {
      authenticated: false,
      reason: "session_refresh_failed",
      clearSession: true
    };
  }
}

export function getCookieValue(request: Request | undefined, name: string): string | null {
  const cookie = request?.headers.get("cookie");
  if (!cookie) return null;

  for (const segment of cookie.split(";")) {
    const [rawName, ...rawValue] = segment.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

export function createCookieHeader(
  request: Request,
  name: string,
  value: string,
  options: { httpOnly?: boolean; maxAge?: number; path?: string } = {}
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    "SameSite=Lax"
  ];

  if (options.httpOnly ?? true) parts.push("HttpOnly");
  if (isSecureRequest(request)) parts.push("Secure");
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);

  return parts.join("; ");
}

export function createClearCookieHeader(request: Request, name: string, path = "/"): string {
  return createCookieHeader(request, name, "", {
    path,
    maxAge: 0,
    httpOnly: true
  });
}

export function getAuthRedirectUri(request: Request, env: WorkOSSessionEnv): string {
  if (env.WORKOS_REDIRECT_URI) return env.WORKOS_REDIRECT_URI;
  return new URL("/auth/callback", request.url).toString();
}

export function getLogoutReturnTo(request: Request, env: WorkOSSessionEnv): string {
  if (env.WORKOS_RETURN_TO) return env.WORKOS_RETURN_TO;
  return new URL(defaultLoginReturnTo, request.url).toString();
}

export function createLoginState(returnTo: string): LoginState {
  return {
    nonce: crypto.randomUUID(),
    returnTo: sanitizeReturnTo(returnTo)
  };
}

export function encodeLoginState(state: LoginState): string {
  return btoa(JSON.stringify(state));
}

export function decodeLoginState(value: string | null): LoginState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(atob(value)) as Partial<LoginState>;
    if (!parsed.nonce || typeof parsed.nonce !== "string") return null;
    return {
      nonce: parsed.nonce,
      returnTo: sanitizeReturnTo(parsed.returnTo)
    };
  } catch {
    return null;
  }
}

export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return defaultLoginReturnTo;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return defaultLoginReturnTo;
  }

  return value;
}

export function isSameOriginPost(request: Request): boolean {
  if (request.method !== "POST") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

function toAuthenticatedSession(response: AuthenticatedWorkOSResponse): WorkOSAuthenticatedSession {
  if (!response.authenticated) {
    throw new Error("Cannot map unauthenticated WorkOS session");
  }

  const refreshResponse = response as { session?: { accessToken?: string } };
  const accessToken =
    "accessToken" in response && response.accessToken
      ? response.accessToken
      : refreshResponse.session?.accessToken;

  if (!accessToken) {
    throw new Error("Missing WorkOS access token on authenticated session");
  }

  return {
    accessToken,
    sessionId: response.sessionId,
    organizationId: response.organizationId,
    role: response.role,
    roles: response.roles,
    permissions: response.permissions,
    entitlements: response.entitlements,
    featureFlags: response.featureFlags,
    user: response.user,
    sealedSession: "sealedSession" in response ? response.sealedSession : undefined
  };
}

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:";
}
