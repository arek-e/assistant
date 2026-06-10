import { createAuthIdentityAdapter } from "./identity";
import type { MemoryAccessContext } from "../memory/access";
import {
  authenticateWorkOSSession,
  createClearCookieHeader,
  createCookieHeader,
  createLoginState,
  createWorkOSClient,
  decodeLoginState,
  encodeLoginState,
  getAuthRedirectUri,
  getCookieValue,
  getLogoutReturnTo,
  getWorkOSSessionCookieName,
  getWorkOSStateCookieName,
  isSameOriginPost,
  isWorkOSAuthConfigured,
  isWorkOSMode,
  sanitizeReturnTo,
  type WorkOSSessionEnv
} from "./workos-session";

export interface AuthMeResponse {
  authenticated: boolean;
  provider: string;
  configured: boolean;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
  identity?: {
    subjectId: string;
    subjectType: string;
    displayName: string;
    sessionId: string;
    organizationId: string;
    role: string;
    permissions: readonly string[];
    grants: readonly { scope: string; scopeId: string }[];
  };
  reason?: string;
}

export async function handleAuthRequest(
  request: Request,
  env: WorkOSSessionEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/auth/")) return null;

  switch (url.pathname) {
    case "/auth/login":
      return handleLogin(request, env, "sign-in");
    case "/auth/signup":
      return handleLogin(request, env, "sign-up");
    case "/auth/callback":
      return handleCallback(request, env);
    case "/auth/logout":
      return handleLogout(request, env);
    case "/auth/me":
      return handleMe(request, env);
    default:
      return json({ error: "not_found" }, 404);
  }
}

export async function requireAuthenticatedAgentRequest(
  request: Request,
  env: WorkOSSessionEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/agents/")) return null;
  if (!isWorkOSMode(env)) return null;

  if (!isWorkOSAuthConfigured(env)) {
    return json({ error: "workos_not_configured" }, 503);
  }

  const identity = await createAuthIdentityAdapter(env).resolve({
    env,
    request
  });

  if (identity.provider !== "workos") {
    return json({ error: "authentication_required" }, 401);
  }

  return null;
}

async function handleLogin(
  request: Request,
  env: WorkOSSessionEnv,
  screenHint: "sign-in" | "sign-up"
): Promise<Response> {
  if (!isWorkOSAuthConfigured(env)) {
    return json({ error: "workos_not_configured" }, 503);
  }

  const url = new URL(request.url);
  const state = createLoginState(url.searchParams.get("returnTo") ?? "/");
  const workos = createWorkOSClient(env);
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: env.WORKOS_CLIENT_ID,
    redirectUri: getAuthRedirectUri(request, env),
    state: state.nonce,
    screenHint
  });

  return redirect(authorizationUrl, 302, [
    createCookieHeader(
      request,
      getWorkOSStateCookieName(env),
      encodeLoginState(state),
      {
        path: "/auth/callback",
        maxAge: 10 * 60,
        httpOnly: true
      }
    )
  ]);
}

async function handleCallback(
  request: Request,
  env: WorkOSSessionEnv
): Promise<Response> {
  if (!isWorkOSAuthConfigured(env)) {
    return json({ error: "workos_not_configured" }, 503);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = decodeLoginState(
    getCookieValue(request, getWorkOSStateCookieName(env))
  );
  const stateCookieClear = createClearCookieHeader(
    request,
    getWorkOSStateCookieName(env),
    "/auth/callback"
  );

  if (
    !code ||
    !returnedState ||
    !cookieState ||
    returnedState !== cookieState.nonce
  ) {
    return redirect("/auth/login", 303, [stateCookieClear]);
  }

  try {
    const workos = createWorkOSClient(env);
    const authResponse = await workos.userManagement.authenticateWithCode({
      clientId: env.WORKOS_CLIENT_ID,
      code,
      session: {
        sealSession: true,
        cookiePassword: env.WORKOS_COOKIE_PASSWORD
      }
    });

    if (!authResponse.sealedSession) {
      return redirect("/auth/login", 303, [stateCookieClear]);
    }

    return redirect(cookieState.returnTo, 303, [
      stateCookieClear,
      createCookieHeader(
        request,
        getWorkOSSessionCookieName(env),
        authResponse.sealedSession,
        {
          path: "/",
          httpOnly: true
        }
      )
    ]);
  } catch {
    return redirect("/auth/login", 303, [stateCookieClear]);
  }
}

async function handleLogout(
  request: Request,
  env: WorkOSSessionEnv
): Promise<Response> {
  if (!isSameOriginPost(request)) {
    return json({ error: "method_not_allowed" }, 405);
  }

  const sessionCookieClear = createClearCookieHeader(
    request,
    getWorkOSSessionCookieName(env)
  );

  if (!isWorkOSAuthConfigured(env)) {
    return redirect("/", 303, [sessionCookieClear]);
  }
  const cookiePassword = env.WORKOS_COOKIE_PASSWORD;
  if (!cookiePassword) {
    return redirect("/", 303, [sessionCookieClear]);
  }

  const workos = createWorkOSClient(env);
  const sessionData = getCookieValue(request, getWorkOSSessionCookieName(env));
  if (!sessionData) return redirect("/", 303, [sessionCookieClear]);

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword
    });
    const logoutUrl = await session.getLogoutUrl({
      returnTo: getLogoutReturnTo(request, env)
    });
    return redirect(logoutUrl, 303, [sessionCookieClear]);
  } catch {
    return redirect("/", 303, [sessionCookieClear]);
  }
}

async function handleMe(
  request: Request,
  env: WorkOSSessionEnv
): Promise<Response> {
  if (!isWorkOSMode(env)) {
    const identity = await createAuthIdentityAdapter(env).resolve({
      env,
      request
    });
    return json({
      authenticated: true,
      configured: false,
      provider: identity.provider,
      identity: serializeIdentity(identity),
      user: {
        id: identity.subjectId,
        name: identity.displayName
      }
    } satisfies AuthMeResponse);
  }

  if (!isWorkOSAuthConfigured(env)) {
    return json({
      authenticated: false,
      configured: false,
      provider: "workos",
      reason: "workos_not_configured"
    } satisfies AuthMeResponse);
  }

  const sessionResult = await authenticateWorkOSSession(request, env, {
    refresh: true
  });

  if (!sessionResult.authenticated) {
    const headers = new Headers({ "content-type": "application/json" });
    if (sessionResult.clearSession) {
      headers.append(
        "set-cookie",
        createClearCookieHeader(request, getWorkOSSessionCookieName(env))
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: false,
        configured: true,
        provider: "workos",
        reason: sessionResult.reason
      } satisfies AuthMeResponse),
      { status: 200, headers }
    );
  }

  const identity = await createAuthIdentityAdapter(env).resolve({
    env,
    request
  });
  const headers = new Headers({ "content-type": "application/json" });
  if (sessionResult.sealedSession) {
    headers.append(
      "set-cookie",
      createCookieHeader(
        request,
        getWorkOSSessionCookieName(env),
        sessionResult.sealedSession,
        { path: "/", httpOnly: true }
      )
    );
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      configured: true,
      provider: "workos",
      identity: serializeIdentity(identity),
      user: {
        id: sessionResult.session.user.id,
        email: sessionResult.session.user.email,
        name: userDisplayName(sessionResult.session.user)
      }
    } satisfies AuthMeResponse),
    { status: 200, headers }
  );
}

function serializeIdentity(
  identity: MemoryAccessContext
): AuthMeResponse["identity"] {
  return {
    subjectId: identity.subjectId,
    subjectType: identity.subjectType,
    displayName: identity.displayName,
    sessionId: identity.sessionId,
    organizationId: identity.organizationId,
    role: identity.role,
    permissions: identity.permissions,
    grants: identity.grants
  };
}

function userDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

function redirect(
  location: string,
  status: 302 | 303,
  cookies: string[] = []
): Response {
  const headers = new Headers({ location: sanitizeReturnTo(location) });

  if (location.startsWith("http://") || location.startsWith("https://")) {
    headers.set("location", location);
  }

  for (const cookie of cookies) headers.append("set-cookie", cookie);

  return new Response(null, { status, headers });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
