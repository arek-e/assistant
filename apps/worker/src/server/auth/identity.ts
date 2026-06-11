import {
  getAgentAccessTokenSecret,
  resolveAgentAccessTokenClaims,
  type AgentIdentityEnv
} from "../agent-identity/client";
import { verifyAgentAccessToken } from "../agent-identity/tokens";
import type { MemoryAccessContext, MemoryScopeGrant } from "../memory/access";
import type { AuthSubjectType } from "../memory/types";
import { getDemoAuthUserFromRequest, type DemoAuthUser } from "./demo-users";
import {
  authenticateWorkOSSession,
  getCookieValue,
  getWorkOSSessionCookieName,
  type WorkOSAuthenticatedSession,
  type WorkOSSessionEnv
} from "./workos-session";
import { createWorkOSSponsorValidator } from "./workos-sponsor-validation";

export interface AuthIdentityEnv extends WorkOSSessionEnv, AgentIdentityEnv {
  AUTH_IDENTITY_ADAPTER?: string;
  AUTH_LOCAL_SUBJECT_ID?: string;
  AUTH_LOCAL_TEAM_ID?: string;
  AUTH_LOCAL_ORG_ID?: string;
  AUTH_LOCAL_SESSION_ID?: string;
  WORKOS_JWKS_URL?: string;
  WORKOS_ISSUER?: string;
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
  issuer: string;
}

type WorkOSSessionAuthenticator = typeof authenticateWorkOSSession;

const localMemoryScopeIds = {
  private: "local-user",
  team: "default-team",
  org: "default-org",
  session: "local-session"
} as const;

const anonymousSessionId = "anonymous-session";

export function createAuthIdentityAdapter(env: AuthIdentityEnv): AuthIdentityAdapter {
  if (env.AUTH_IDENTITY_ADAPTER === "workos") {
    return new WorkOSAuthIdentityAdapter();
  }

  return new LocalAuthIdentityAdapter();
}

export class LocalAuthIdentityAdapter implements AuthIdentityAdapter {
  async resolve({ env, sessionId }: AuthIdentityResolutionInput): Promise<MemoryAccessContext> {
    const localIdentity = createLocalIdentityConfig(env, sessionId);

    return createMemoryAccessContext({
      subjectId: localIdentity.subjectId,
      subjectType: "user",
      provider: "local",
      displayName: "Local User",
      sessionId: localIdentity.sessionId,
      organizationId: localIdentity.organizationId,
      role: "local-admin",
      permissions: ["memory:read", "memory:write"],
      grants: createLocalGrants(localIdentity)
    });
  }
}

export class WorkOSAuthIdentityAdapter implements AuthIdentityAdapter {
  constructor(
    private readonly verifyAccessToken: WorkOSTokenVerifier = verifyWorkOSToken,
    private readonly authenticateSession: WorkOSSessionAuthenticator = authenticateWorkOSSession
  ) {}

  async resolve(input: AuthIdentityResolutionInput): Promise<MemoryAccessContext> {
    if (hasWorkOSSessionCookie(input)) {
      return this.resolveSession(input);
    }

    const token = getRequestToken(input);
    const clientId = input.env.WORKOS_CLIENT_ID;
    if (token) {
      const agentIdentity = await resolveAgentToken(input, token);
      if (agentIdentity) return agentIdentity;
    }

    if (token && clientId) {
      return this.resolveWorkOSToken(input, token, clientId);
    }

    const demoUser = getDemoAuthUserFromRequest(input.request, input.env);
    if (demoUser) return createDemoMemoryAccessContext(demoUser);

    return this.resolveSession(input);
  }

  private async resolveWorkOSToken(
    input: AuthIdentityResolutionInput,
    token: string,
    clientId: string
  ): Promise<MemoryAccessContext> {
    try {
      const claims = await this.verifyAccessToken(token, {
        clientId,
        jwksUrl: workOSJwksUrl(input.env, clientId),
        issuer: workOSIssuer(input.env)
      });

      return createWorkOSMemoryAccessContext(claims, input.sessionId);
    } catch {
      return this.resolveSession(input);
    }
  }

  private async resolveSession(input: AuthIdentityResolutionInput): Promise<MemoryAccessContext> {
    if (!hasWorkOSSessionCookie(input)) {
      return createAnonymousMemoryAccessContext(input.sessionId);
    }

    try {
      const sessionResult = await this.authenticateSession(input.request!, input.env);
      if (!sessionResult.authenticated) return createAnonymousMemoryAccessContext(input.sessionId);

      return createWorkOSMemoryAccessContext({
        ...claimsFromSession(sessionResult.session),
        actor_type: "user"
      });
    } catch {
      return createAnonymousMemoryAccessContext(input.sessionId);
    }
  }
}

async function resolveAgentToken(
  input: AuthIdentityResolutionInput,
  token: string
): Promise<MemoryAccessContext | null> {
  try {
    const claims = await verifyAgentAccessToken(token, getAgentAccessTokenSecret(input.env));
    return await resolveAgentAccessTokenClaims(input.env, claims, input.sessionId, {
      sponsorValidator: createWorkOSSponsorValidator(input.env)
    });
  } catch {
    return null;
  }
}

interface LocalIdentityConfig {
  subjectId: string;
  teamId: string;
  organizationId: string;
  sessionId: string;
}

function createLocalIdentityConfig(
  env: AuthIdentityEnv,
  sessionId: string | undefined
): LocalIdentityConfig {
  return {
    subjectId: withDefault(env.AUTH_LOCAL_SUBJECT_ID, localMemoryScopeIds.private),
    teamId: withDefault(env.AUTH_LOCAL_TEAM_ID, localMemoryScopeIds.team),
    organizationId: withDefault(env.AUTH_LOCAL_ORG_ID, localMemoryScopeIds.org),
    sessionId: firstString(env.AUTH_LOCAL_SESSION_ID, sessionId) ?? localMemoryScopeIds.session
  };
}

function createLocalGrants({
  subjectId,
  teamId,
  organizationId,
  sessionId
}: LocalIdentityConfig): MemoryScopeGrant[] {
  return [
    { scope: "private", scopeId: subjectId },
    { scope: "team", scopeId: teamId },
    { scope: "org", scopeId: organizationId },
    { scope: "session", scopeId: sessionId }
  ];
}

export function createWorkOSMemoryAccessContext(
  claims: WorkOSClaims,
  fallbackSessionId = anonymousSessionId
): MemoryAccessContext {
  const subjectId = firstString(claims.sub, claims.user_id, claims.id);
  if (!subjectId) return createAnonymousMemoryAccessContext(fallbackSessionId);

  const sessionId = firstString(claims.sid, claims.session_id) ?? fallbackSessionId;
  const organizationId = firstString(claims.org_id, claims.organization_id) ?? "";
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

export function createDemoMemoryAccessContext(user: DemoAuthUser): MemoryAccessContext {
  return createWorkOSMemoryAccessContext({
    sub: user.subjectId,
    sid: user.sessionId,
    org_id: user.organizationId,
    team_ids: user.teamIds,
    role: user.role,
    roles: [user.role],
    permissions: user.permissions,
    name: user.name,
    email: user.email,
    actor_type: "user"
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

function createMemoryAccessContext(input: MemoryAccessContext): MemoryAccessContext {
  return {
    ...input,
    permissions: [...new Set(input.permissions)],
    grants: dedupeGrants(input.grants)
  };
}

function getRequestToken({ env, request }: AuthIdentityResolutionInput): string | null {
  return getBearerToken(request) ?? getQueryToken(request, env) ?? getCookieToken(request, env);
}

function workOSJwksUrl(env: AuthIdentityEnv, clientId: string): string {
  return env.WORKOS_JWKS_URL ?? `https://api.workos.com/sso/jwks/${clientId}`;
}

function workOSIssuer(env: AuthIdentityEnv): string {
  return env.WORKOS_ISSUER ?? "https://api.workos.com";
}

function hasWorkOSSessionCookie({ env, request }: AuthIdentityResolutionInput): boolean {
  return Boolean(getCookieValue(request, getWorkOSSessionCookieName(env)));
}

function withDefault(value: string | undefined, fallback: string): string {
  return firstString(value) ?? fallback;
}

async function verifyWorkOSToken(
  token: string,
  config: WorkOSAuthIdentityConfig
): Promise<WorkOSClaims> {
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  const { payload } = await jwtVerify(token, jwks, {
    audience: config.clientId,
    issuer: config.issuer
  });
  return payload as WorkOSClaims;
}

function getBearerToken(request: Request | undefined): string | null {
  const authorization = request?.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}

function getCookieToken(request: Request | undefined, env: AuthIdentityEnv): string | null {
  const cookieName = env.WORKOS_ACCESS_TOKEN_COOKIE ?? "workos_access_token";
  return getCookieValue(request, cookieName);
}

function getQueryToken(request: Request | undefined, env: AuthIdentityEnv): string | null {
  if (!request || !env.WORKOS_ACCESS_TOKEN_QUERY_PARAM) return null;

  const url = new URL(request.url);
  return url.searchParams.get(env.WORKOS_ACCESS_TOKEN_QUERY_PARAM);
}

function claimsFromSession(session: WorkOSAuthenticatedSession): WorkOSClaims {
  const displayName = [session.user.firstName, session.user.lastName].filter(Boolean).join(" ");

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
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
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
  return [...new Map(grants.map((grant) => [`${grant.scope}:${grant.scopeId}`, grant])).values()];
}
