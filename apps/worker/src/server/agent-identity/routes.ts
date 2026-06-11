import { createAuthIdentityAdapter } from "../auth/identity";
import { isWorkOSMode, sanitizeReturnTo, type WorkOSSessionEnv } from "../auth/workos-session";
import { createWorkOSSponsorValidator } from "../auth/workos-sponsor-validation";
import type { MemoryAccessContext } from "../memory/access";
import { createAgentIdentityService, type AgentIdentityEnv } from "./client";
import { AgentIdentityError, toAgentIdentityError, type AgentIdentityService } from "./service";
import { parseCapabilityScope, tokenScope } from "./tokens";
import type {
  AgentCapability,
  AgentIdentityCreateInput,
  AgentIdentityRenewInput,
  AgentIdentityRevokeInput,
  AgentOAuthClientCreateInput
} from "./types";

export type AgentIdentityRouteEnv = WorkOSSessionEnv & AgentIdentityEnv;

export async function handleAgentIdentityRequest(
  request: Request,
  env: AgentIdentityRouteEnv
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/oauth/")) {
    return handleOAuthRequest(request, env);
  }

  if (url.pathname.startsWith("/api/agent-identities")) {
    return handleManagementRequest(request, env);
  }

  if (url.pathname.startsWith("/api/agent-oauth-clients")) {
    return handleOAuthClientManagementRequest(request, env);
  }

  return null;
}

async function handleOAuthRequest(request: Request, env: AgentIdentityRouteEnv): Promise<Response> {
  const url = new URL(request.url);

  try {
    switch (url.pathname) {
      case "/oauth/authorize":
        return await handleAuthorize(request, env);
      case "/oauth/token":
        return await handleToken(request, env);
      case "/oauth/revoke":
        return await handleRevokeToken(request, env);
      default:
        return json({ error: "not_found" }, 404);
    }
  } catch (caught) {
    return errorResponse(caught);
  }
}

async function handleManagementRequest(
  request: Request,
  env: AgentIdentityRouteEnv
): Promise<Response> {
  const url = new URL(request.url);

  try {
    const actor = await requireAuthenticatedActor(request, env);
    const service = createRouteAgentIdentityService(env);
    const route = managementRoute(url.pathname);
    return await dispatchManagementRoute({
      actor,
      request,
      route,
      service,
      url
    });
  } catch (caught) {
    return errorResponse(caught);
  }
}

async function handleOAuthClientManagementRequest(
  request: Request,
  env: AgentIdentityRouteEnv
): Promise<Response> {
  const url = new URL(request.url);

  try {
    const actor = await requireAuthenticatedActor(request, env);
    const service = createRouteAgentIdentityService(env);
    const route = oauthClientRoute(url.pathname);

    if (route.kind === "collection") {
      return handleOAuthClientCollection(request, service, actor, url);
    }

    return handleOAuthClientMember(request, service, actor, route);
  } catch (caught) {
    return errorResponse(caught);
  }
}

async function handleOAuthClientCollection(
  request: Request,
  service: AgentIdentityService,
  actor: MemoryAccessContext,
  url: URL
): Promise<Response> {
  const handlers: Record<string, () => Promise<Response>> = {
    GET: async () => json(await service.listOAuthClients(actor, optionalClientStatusParam(url))),
    POST: async () =>
      json(
        await service.createOAuthClient(
          toCreateOAuthClientInput(actor, await readJson<CreateOAuthClientRequest>(request))
        ),
        201
      )
  };

  return handlers[request.method]?.() ?? methodNotAllowed();
}

async function handleOAuthClientMember(
  request: Request,
  service: AgentIdentityService,
  actor: MemoryAccessContext,
  route: OAuthClientMemberRoute
): Promise<Response> {
  if (request.method !== "POST" || route.kind !== "disable") {
    return methodNotAllowed();
  }

  return json(
    await service.disableOAuthClient({
      actor,
      clientId: route.id,
      reason: (await readJson<DisableOAuthClientRequest>(request)).reason
    })
  );
}

interface ManagementRequestContext {
  actor: MemoryAccessContext;
  request: Request;
  route: ManagementRoute;
  service: AgentIdentityService;
  url: URL;
}

async function dispatchManagementRoute({
  route,
  ...context
}: ManagementRequestContext): Promise<Response> {
  if (route.kind === "collection") {
    return handleAgentCollectionRoute(context);
  }

  return handleAgentMemberRoute({ ...context, route });
}

type AgentCollectionRouteContext = Omit<ManagementRequestContext, "route">;

async function handleAgentCollectionRoute({
  actor,
  request,
  service,
  url
}: AgentCollectionRouteContext): Promise<Response> {
  const handlers: Record<string, () => Promise<Response>> = {
    GET: async () =>
      json(
        await service.listIdentities(actor, {
          includeAllSponsors: url.searchParams.get("all") === "1",
          sponsorSubjectId: optionalSearchParam(url, "sponsor"),
          status: optionalStatusParam(url),
          scope: optionalScopeParam(url),
          expiresBefore: optionalSearchParam(url, "expires_before"),
          lastUsedBefore: optionalSearchParam(url, "last_used_before"),
          lastUsedAfter: optionalSearchParam(url, "last_used_after")
        })
      ),
    POST: async () =>
      json(
        await service.createIdentity(
          toCreateInput(actor, await readJson<CreateAgentRequest>(request))
        ),
        201
      )
  };

  return handlers[request.method]?.() ?? methodNotAllowed();
}

type AgentMemberRoute = Exclude<ManagementRoute, { kind: "collection" }>;
type AgentMemberRouteContext = Omit<ManagementRequestContext, "route"> & {
  route: AgentMemberRoute;
};

async function handleAgentMemberRoute({
  actor,
  request,
  route,
  service
}: AgentMemberRouteContext): Promise<Response> {
  const handlers: Record<AgentMemberRoute["kind"], () => Promise<Response>> = {
    audit: async () =>
      request.method === "GET"
        ? json(await service.listAuditEvents(actor, route.id))
        : methodNotAllowed(),
    identity: async () => {
      if (request.method !== "GET") return methodNotAllowed();
      const identity = await service.getIdentityForActor(actor, route.id);
      return identity ? json(identity) : json({ error: "not_found" }, 404);
    },
    renew: async () =>
      request.method === "POST"
        ? json(
            await service.renewIdentity(
              toRenewInput(actor, route.id, await readJson<RenewAgentRequest>(request))
            )
          )
        : methodNotAllowed(),
    revoke: async () =>
      request.method === "POST"
        ? json(
            await service.revokeIdentity(
              toRevokeInput(actor, route.id, await readJson<RevokeAgentRequest>(request))
            )
          )
        : methodNotAllowed(),
    disable: async () =>
      request.method === "POST"
        ? json(
            await service.disableIdentity(
              toRevokeInput(actor, route.id, await readJson<RevokeAgentRequest>(request))
            )
          )
        : methodNotAllowed()
  };

  return handlers[route.kind]();
}

async function handleAuthorize(request: Request, env: AgentIdentityRouteEnv): Promise<Response> {
  const actor = await resolveActor(request, env);
  if (actor.provider === "anonymous") {
    return redirect(`/auth/login?returnTo=${encodeURIComponent(currentPath(request))}`, 302);
  }

  const url = new URL(request.url);
  const service = createRouteAgentIdentityService(env);
  const state = requiredParam(url, "state");
  const result = await service.createAuthorizationCode({
    actor,
    agentKeyId: url.searchParams.get("agent_key_id") ?? undefined,
    agentName: url.searchParams.get("agent_name") ?? undefined,
    clientId: url.searchParams.get("client_id") ?? "teampitch-public-client",
    redirectUri: requiredParam(url, "redirect_uri"),
    codeChallenge: requiredParam(url, "code_challenge"),
    codeChallengeMethod: requiredParam(url, "code_challenge_method"),
    requestedScopes: parseCapabilityScope(url.searchParams.get("scope"))
  });
  const redirectUrl = new URL(result.redirectUri);
  redirectUrl.searchParams.set("code", result.code);
  redirectUrl.searchParams.set("state", state);

  return redirect(redirectUrl.toString(), 302);
}

async function handleToken(request: Request, env: AgentIdentityRouteEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readOAuthBody(request);
  const service = createRouteAgentIdentityService(env);

  if (body.grant_type === "authorization_code") {
    const result = await service.exchangeAuthorizationCode({
      code: requiredBody(body, "code"),
      redirectUri: requiredBody(body, "redirect_uri"),
      codeVerifier: requiredBody(body, "code_verifier")
    });
    return json(toTokenResponse(result));
  }

  if (body.grant_type === "refresh_token") {
    const result = await service.refresh({
      refreshToken: requiredBody(body, "refresh_token")
    });
    return json(toTokenResponse(result));
  }

  return json({ error: "unsupported_grant_type" }, 400);
}

async function handleRevokeToken(request: Request, env: AgentIdentityRouteEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readOAuthBody(request);
  await createRouteAgentIdentityService(env).revokeRefreshToken({
    refreshToken: requiredBody(body, "token"),
    reason: "oauth_revoke"
  });
  return json({ revoked: true });
}

async function resolveActor(
  request: Request,
  env: AgentIdentityRouteEnv
): Promise<MemoryAccessContext> {
  return createAuthIdentityAdapter(env).resolve({ env, request });
}

function createRouteAgentIdentityService(env: AgentIdentityRouteEnv) {
  return createAgentIdentityService(env, undefined, {
    sponsorValidator: createWorkOSSponsorValidator(env)
  });
}

async function requireAuthenticatedActor(
  request: Request,
  env: AgentIdentityRouteEnv
): Promise<MemoryAccessContext> {
  const actor = await resolveActor(request, env);
  if (actor.provider === "anonymous") {
    throw new AgentIdentityError("unauthorized", "Authentication required", 401);
  }
  if (isWorkOSMode(env) && actor.provider !== "workos") {
    throw new AgentIdentityError("unauthorized", "WorkOS authentication required", 401);
  }
  return actor;
}

type ManagementRoute =
  | { kind: "collection" }
  | { kind: "identity"; id: string }
  | { kind: "renew"; id: string }
  | { kind: "revoke"; id: string }
  | { kind: "disable"; id: string }
  | { kind: "audit"; id: string };

function managementRoute(pathname: string): ManagementRoute {
  const segments = pathname.split("/").filter(Boolean);
  const id = segments[2];
  const action = segments[3];

  if (!id) return { kind: "collection" };
  if (action === "renew") return { kind: "renew", id };
  if (action === "revoke") return { kind: "revoke", id };
  if (action === "disable") return { kind: "disable", id };
  if (action === "audit-events") return { kind: "audit", id };
  return { kind: "identity", id };
}

function optionalSearchParam(url: URL, name: string): string | undefined {
  return url.searchParams.get(name) ?? undefined;
}

function optionalStatusParam(url: URL) {
  const status = url.searchParams.get("status");
  if (
    status === "active" ||
    status === "expired" ||
    status === "revoked" ||
    status === "disabled"
  ) {
    return status;
  }
  return undefined;
}

function optionalScopeParam(url: URL) {
  const scope = url.searchParams.get("scope");
  if (scope === "private" || scope === "team" || scope === "org" || scope === "session") {
    return scope;
  }
  return undefined;
}

type OAuthClientRoute = { kind: "collection" } | { kind: "disable"; id: string };

type OAuthClientMemberRoute = Exclude<OAuthClientRoute, { kind: "collection" }>;

function oauthClientRoute(pathname: string): OAuthClientRoute {
  const segments = pathname.split("/").filter(Boolean);
  const id = segments[2];
  const action = segments[3];

  if (!id) return { kind: "collection" };
  if (action === "disable") return { kind: "disable", id };
  return { kind: "disable", id };
}

function optionalClientStatusParam(url: URL) {
  const status = url.searchParams.get("status");
  return status === "active" || status === "disabled" ? status : undefined;
}

interface CreateAgentRequest {
  name?: string;
  description?: string;
  allowedScopes?: AgentIdentityCreateInput["allowedScopes"];
  allowedCapabilities?: AgentCapability[];
  expiresAt?: string;
  actingMode?: AgentIdentityCreateInput["actingMode"];
}

interface RenewAgentRequest {
  expiresAt?: string;
}

interface RevokeAgentRequest {
  reason?: string;
}

interface CreateOAuthClientRequest {
  clientId?: string;
  name?: string;
  redirectUris?: string[];
  allowedCapabilities?: AgentCapability[];
  allowLocalRedirects?: boolean;
}

interface DisableOAuthClientRequest {
  reason?: string;
}

function toCreateInput(
  actor: MemoryAccessContext,
  body: CreateAgentRequest
): AgentIdentityCreateInput {
  return {
    actor,
    name: body.name ?? "Assistant Agent",
    description: body.description,
    allowedScopes: body.allowedScopes,
    allowedCapabilities: body.allowedCapabilities,
    expiresAt: body.expiresAt,
    actingMode: body.actingMode
  };
}

function toRenewInput(
  actor: MemoryAccessContext,
  keyId: string,
  body: RenewAgentRequest
): AgentIdentityRenewInput {
  if (!body.expiresAt) {
    throw new AgentIdentityError("invalid_expiration", "expiresAt is required");
  }
  return { actor, keyId, expiresAt: body.expiresAt };
}

function toRevokeInput(
  actor: MemoryAccessContext,
  keyId: string,
  body: RevokeAgentRequest
): AgentIdentityRevokeInput {
  return { actor, keyId, reason: body.reason };
}

function toCreateOAuthClientInput(
  actor: MemoryAccessContext,
  body: CreateOAuthClientRequest
): AgentOAuthClientCreateInput {
  return {
    actor,
    clientId: body.clientId,
    name: body.name ?? body.clientId ?? "OAuth Client",
    redirectUris: body.redirectUris ?? [],
    allowedCapabilities: body.allowedCapabilities,
    allowLocalRedirects: body.allowLocalRedirects
  };
}

async function readJson<Body>(request: Request): Promise<Body> {
  return (await request.json()) as Body;
}

async function readOAuthBody(request: Request): Promise<Record<string, string | undefined>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, string | undefined>;
  }

  const form = new URLSearchParams(await request.text());
  return Object.fromEntries(form.entries());
}

function toTokenResponse(result: {
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
  };
  capabilities: readonly AgentCapability[];
}) {
  return {
    access_token: result.tokens.accessToken,
    refresh_token: result.tokens.refreshToken,
    token_type: result.tokens.tokenType,
    expires_at: result.tokens.accessTokenExpiresAt,
    refresh_expires_at: result.tokens.refreshTokenExpiresAt,
    scope: tokenScope(result.capabilities)
  };
}

function requiredParam(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) throw new AgentIdentityError("invalid_request", `${name} is required`);
  return value;
}

function requiredBody(body: Record<string, string | undefined>, name: string): string {
  const value = body[name];
  if (!value) throw new AgentIdentityError("invalid_request", `${name} is required`);
  return value;
}

function currentPath(request: Request): string {
  const url = new URL(request.url);
  return sanitizeReturnTo(`${url.pathname}${url.search}`);
}

function redirect(location: string, status: 302 | 303 = 302): Response {
  return new Response(null, {
    status,
    headers: { location }
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function methodNotAllowed(): Response {
  return json({ error: "method_not_allowed" }, 405);
}

function errorResponse(caught: unknown): Response {
  const error = toAgentIdentityError(caught);
  return json({ error: error.code, message: error.message }, error.status);
}
