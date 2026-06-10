import type { MemoryAccessContext, MemoryScopeGrant } from "../memory/access";
import type { AuthSubjectType } from "../memory/types";
import {
  authenticateWorkOSSession,
  getCookieValue,
  getWorkOSSessionCookieName,
  type WorkOSAuthenticatedSession,
  type WorkOSSessionEnv
} from "./workos-session";

export interface AuthIdentityEnv extends WorkOSSessionEnv {
  AUTH_IDENTITY_ADAPTER?: string;
  AUTH_LOCAL_SUBJECT_ID?: string;
  AUTH_LOCAL_TEAM_ID?: string;
  AUTH_LOCAL_ORG_ID?: string;
  AUTH_LOCAL_SESSION_ID?: string;
  WORKOS_JWKS_URL?: string;
  WORKOS_ACCESS_TOKEN_COOKIE?: string;
  WORKOS_ACCESS_TOKEN_QUERY_PARAM?: string;
}

export interface AuthIdentityResolutionInput {
  env: AuthIdentityEnv;
  request?: Request;
  sessionId?: string;
}

export interface AuthIdentityAdapter {
  resolve(input: AuthIdentityResolutionInput): Promise<MemoryAccessContext>;
}

export interface WorkOSClaims {
  sub?: unknown;
  user_id?: unknown;
  id?: unknown;
  sid?: unknown;
  session_id?: unknown;
  org_id?: unknown;
  organization_id?: unknown;
  role?: unknown;
  roles?: unknown;
  permissions?: unknown;
  entitlements?: unknown;
  feature_flags?: unknown;
  groups?: unknown;
  group_ids?: unknown;
  team_ids?: unknown;
  name?: unknown;
  email?: unknown;
  actor_type?: unknown;
}

export type WorkOSTokenVerifier = (
  token: string,
  config: WorkOSAuthIdentityConfig
) => Promise<WorkOSClaims>;

export interface WorkOSAuthIdentityConfig {
  clientId: string;
  jwksUrl: string;
}

const localMemoryScopeIds = {
  private: "local-user",
  team: "default-team",
  org: "default-org",
  session: "local-session"
} as const;

const anonymousSessionId = "anonymous-session";

export function createAuthIdentityAdapter(
  env: AuthIdentityEnv
): AuthIdentityAdapter {
  if (env.AUTH_IDENTITY_ADAPTER === "workos") {
    return new WorkOSAuthIdentityAdapter();
  }

  return new LocalAuthIdentityAdapter();
}

export class LocalAuthIdentityAdapter implements AuthIdentityAdapter {
  async resolve({
    env,
    sessionId
  }: AuthIdentityResolutionInput): Promise<MemoryAccessContext> {
    return createMemoryAccessContext({
      subjectId: env.AUTH_LOCAL_SUBJECT_ID ?? localMemoryScopeIds.private,
      subjectType: "user",
      provider: "local",
      displayName: "Local User",
      sessionId:
        env.AUTH_LOCAL_SESSION_ID ?? sessionId ?? localMemoryScopeIds.session,
      organizationId: env.AUTH_LOCAL_ORG_ID ?? localMemoryScopeIds.org,
      role: "local-admin",
      permissions: ["memory:read", "memory:write"],
      grants: [
        {
          scope: "private",
          scopeId: env.AUTH_LOCAL_SUBJECT_ID ?? localMemoryScopeIds.private
        },
        {
          scope: "team",
          scopeId: env.AUTH_LOCAL_TEAM_ID ?? localMemoryScopeIds.team
        },
        {
          scope: "org",
          scopeId: env.AUTH_LOCAL_ORG_ID ?? localMemoryScopeIds.org
        },
        {
          scope: "session",
          scopeId:
            env.AUTH_LOCAL_SESSION_ID ??
            sessionId ??
            localMemoryScopeIds.session
        }
      ]
    });
  }
}

export class WorkOSAuthIdentityAdapter implements AuthIdentityAdapter {
  constructor(
    private readonly verifyAccessToken: WorkOSTokenVerifier = verifyWorkOSToken
  ) {}

  async resolve(
    input: AuthIdentityResolutionInput
  ): Promise<MemoryAccessContext> {
    const token =
      getBearerToken(input.request) ??
      getQueryToken(input.request, input.env) ??
      getCookieToken(input.request, input.env);
    const clientId = input.env.WORKOS_CLIENT_ID;

    if (token && clientId) {
      try {
        const claims = await this.verifyAccessToken(token, {
          clientId,
          jwksUrl:
            input.env.WORKOS_JWKS_URL ??
            `https://api.workos.com/sso/jwks/${clientId}`
        });

        return createWorkOSMemoryAccessContext(claims, input.sessionId);
      } catch {
        return createAnonymousMemoryAccessContext(input.sessionId);
      }
    }

    if (!getCookieValue(input.request, getWorkOSSessionCookieName(input.env))) {
      return createAnonymousMemoryAccessContext(input.sessionId);
    }

    try {
      const sessionResult = await authenticateWorkOSSession(
        input.request!,
        input.env
      );
      if (!sessionResult.authenticated) {
        return createAnonymousMemoryAccessContext(input.sessionId);
      }

      return createWorkOSMemoryAccessContext({
        ...claimsFromSession(sessionResult.session),
        actor_type: "user"
      });
    } catch {
      return createAnonymousMemoryAccessContext(input.sessionId);
    }
  }
}

export function createWorkOSMemoryAccessContext(
  claims: WorkOSClaims,
  fallbackSessionId = anonymousSessionId
): MemoryAccessContext {
  const subjectId = firstString(claims.sub, claims.user_id, claims.id);
  if (!subjectId) return createAnonymousMemoryAccessContext(fallbackSessionId);

  const sessionId =
    firstString(claims.sid, claims.session_id) ?? fallbackSessionId;
  const organizationId =
    firstString(claims.org_id, claims.organization_id) ?? "";
  const teamIds = uniqueStrings(
    toStringArray(claims.team_ids),
    toStringArray(claims.group_ids),
    toStringArray(claims.groups)
  );
  const permissions = toStringArray(claims.permissions);
  const roles = toStringArray(claims.roles);
  const subjectType = toSubjectType(claims.actor_type);
  const grants: MemoryScopeGrant[] = [
    { scope: "private", scopeId: subjectId },
    { scope: "session", scopeId: sessionId },
    ...teamIds.map((scopeId) => ({ scope: "team" as const, scopeId }))
  ];

  if (organizationId) grants.push({ scope: "org", scopeId: organizationId });

  return createMemoryAccessContext({
    subjectId,
    subjectType,
    provider: "workos",
    displayName: firstString(claims.name, claims.email) ?? subjectId,
    sessionId,
    organizationId,
    role: firstString(claims.role) ?? roles[0] ?? "",
    permissions,
    grants
  });
}

export function createAnonymousMemoryAccessContext(
  sessionId = anonymousSessionId
): MemoryAccessContext {
  return createMemoryAccessContext({
    subjectId: "anonymous",
    subjectType: "user",
    provider: "anonymous",
    displayName: "Anonymous",
    sessionId,
    organizationId: "",
    role: "",
    permissions: [],
    grants: [{ scope: "session", scopeId: sessionId }]
  });
}

function createMemoryAccessContext(
  input: MemoryAccessContext
): MemoryAccessContext {
  return {
    ...input,
    permissions: [...new Set(input.permissions)],
    grants: dedupeGrants(input.grants)
  };
}

async function verifyWorkOSToken(
  token: string,
  config: WorkOSAuthIdentityConfig
): Promise<WorkOSClaims> {
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  const { payload } = await jwtVerify(token, jwks);
  return payload as WorkOSClaims;
}

function getBearerToken(request: Request | undefined): string | null {
  const authorization = request?.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}

function getCookieToken(
  request: Request | undefined,
  env: AuthIdentityEnv
): string | null {
  const cookieName = env.WORKOS_ACCESS_TOKEN_COOKIE ?? "workos_access_token";
  return getCookieValue(request, cookieName);
}

function getQueryToken(
  request: Request | undefined,
  env: AuthIdentityEnv
): string | null {
  if (!request) return null;

  const url = new URL(request.url);
  const queryParam = env.WORKOS_ACCESS_TOKEN_QUERY_PARAM ?? "access_token";
  return url.searchParams.get(queryParam) ?? url.searchParams.get("token");
}

function claimsFromSession(session: WorkOSAuthenticatedSession): WorkOSClaims {
  const displayName = [session.user.firstName, session.user.lastName]
    .filter(Boolean)
    .join(" ");

  return {
    sub: session.user.id,
    sid: session.sessionId,
    org_id: session.organizationId,
    role: session.role,
    roles: session.roles,
    permissions: session.permissions,
    entitlements: session.entitlements,
    feature_flags: session.featureFlags,
    name: displayName || session.user.email,
    email: session.user.email
  };
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string => typeof value === "string" && value.length > 0
  );
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
  }

  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function uniqueStrings(...values: string[][]): string[] {
  return [...new Set(values.flat())];
}

function toSubjectType(value: unknown): AuthSubjectType {
  return value === "agent" ? "agent" : "user";
}

function dedupeGrants(grants: readonly MemoryScopeGrant[]): MemoryScopeGrant[] {
  return [
    ...new Map(
      grants.map((grant) => [`${grant.scope}:${grant.scopeId}`, grant])
    ).values()
  ];
}
