import {
  AgentIdentityService,
  resolveAccessTokenClaims,
  type AgentIdentityPolicy,
  type AgentSponsorValidator
} from "./service";
import {
  InMemoryAgentIdentityStore,
  type AgentIdentityStore,
  type AgentIdentityStoreMethod,
  type AgentIdentityStoreOperation
} from "./store";
import type { AgentAccessTokenClaims, AgentCapability } from "./types";

export interface AgentIdentityEnv {
  AgentIdentityStore?: {
    getByName(name: string): AgentIdentityStoreStub;
  };
  AGENT_ACCESS_TOKEN_SECRET?: string;
  AGENT_IDENTITY_CREATION_DISABLED?: string;
  AGENT_IDENTITY_MAX_EXPIRY_DAYS?: string;
  AGENT_IDENTITY_ALLOWED_CAPABILITIES?: string;
  AGENT_IDENTITY_REDIRECT_URI_ALLOWLIST?: string;
  AGENT_IDENTITY_POLICY?: string;
  WORKOS_COOKIE_PASSWORD?: string;
}

interface AgentIdentityStoreStub {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

let fallbackStore: InMemoryAgentIdentityStore | undefined;

export interface AgentIdentityClientOptions {
  sponsorValidator?: AgentSponsorValidator;
}

export function createAgentIdentityService(
  env: AgentIdentityEnv,
  store: AgentIdentityStore = getAgentIdentityStore(env),
  options: AgentIdentityClientOptions = {}
): AgentIdentityService {
  return new AgentIdentityService(store, {
    accessTokenSecret: getAgentAccessTokenSecret(env),
    policy: getAgentIdentityPolicy(env),
    sponsorValidator: options.sponsorValidator
  });
}

export function getAgentAccessTokenSecret(env: AgentIdentityEnv): string {
  return (
    env.AGENT_ACCESS_TOKEN_SECRET ??
    env.WORKOS_COOKIE_PASSWORD ??
    "local-agent-token-secret-only-for-development"
  );
}

function getAgentIdentityPolicy(env: AgentIdentityEnv): AgentIdentityPolicy | undefined {
  const jsonPolicy = parseJsonPolicy(env.AGENT_IDENTITY_POLICY);
  return {
    ...jsonPolicy,
    creationDisabled: env.AGENT_IDENTITY_CREATION_DISABLED === "1" || jsonPolicy?.creationDisabled,
    maxExpiryDays:
      parsePositiveInteger(env.AGENT_IDENTITY_MAX_EXPIRY_DAYS) ?? jsonPolicy?.maxExpiryDays,
    allowedCapabilities:
      parseCapabilityList(env.AGENT_IDENTITY_ALLOWED_CAPABILITIES) ??
      jsonPolicy?.allowedCapabilities,
    allowedRedirectUris:
      parseStringList(env.AGENT_IDENTITY_REDIRECT_URI_ALLOWLIST) ?? jsonPolicy?.allowedRedirectUris
  };
}

export async function resolveAgentAccessTokenClaims(
  env: AgentIdentityEnv,
  claims: AgentAccessTokenClaims,
  fallbackSessionId?: string,
  options: AgentIdentityClientOptions = {}
) {
  return resolveAccessTokenClaims(
    getAgentIdentityStore(env),
    claims,
    fallbackSessionId,
    options.sponsorValidator
  );
}

function getAgentIdentityStore(env: AgentIdentityEnv): AgentIdentityStore {
  if (env.AgentIdentityStore) {
    return createRemoteAgentIdentityStore(env.AgentIdentityStore.getByName("global"));
  }

  fallbackStore ??= new InMemoryAgentIdentityStore();
  return fallbackStore;
}

function parseJsonPolicy(value: string | undefined): AgentIdentityPolicy | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as AgentIdentityPolicy;
  } catch {
    return undefined;
  }
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseCapabilityList(value: string | undefined): AgentCapability[] | undefined {
  if (!value) return undefined;
  const capabilities = value.split(/[\s,]+/).filter(isAgentCapability);
  return capabilities.length ? [...new Set(capabilities)] : undefined;
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const values = value.split(/[\s,]+/).filter(Boolean);
  return values.length ? [...new Set(values)] : undefined;
}

function isAgentCapability(value: string): value is AgentCapability {
  return (
    value === "memory:read" ||
    value === "memory:write" ||
    value === "memory:lifecycle" ||
    value === "routing:write" ||
    value === "tools:schedule"
  );
}

function createRemoteAgentIdentityStore(stub: AgentIdentityStoreStub): AgentIdentityStore {
  return {
    upsertIdentity: (identity) => remoteStoreCall(stub, "upsertIdentity", identity),
    upsertKey: (key) => remoteStoreCall(stub, "upsertKey", key),
    getIdentity: (id) => remoteStoreCall(stub, "getIdentity", id),
    getKey: (id) => remoteStoreCall(stub, "getKey", id),
    getKeyByIdentityId: (identityId) => remoteStoreCall(stub, "getKeyByIdentityId", identityId),
    listIdentities: (filter) => remoteStoreCall(stub, "listIdentities", filter),
    listLifecycleIdentities: (filter) => remoteStoreCall(stub, "listLifecycleIdentities", filter),
    upsertOAuthClient: (client) => remoteStoreCall(stub, "upsertOAuthClient", client),
    getOAuthClient: (organizationId, id) =>
      remoteStoreCall(stub, "getOAuthClient", organizationId, id),
    listOAuthClients: (filter) => remoteStoreCall(stub, "listOAuthClients", filter),
    saveAuthorizationCode: (code) => remoteStoreCall(stub, "saveAuthorizationCode", code),
    getAuthorizationCode: (codeHash) => remoteStoreCall(stub, "getAuthorizationCode", codeHash),
    markAuthorizationCodeUsed: (codeHash, usedAt) =>
      remoteStoreCall(stub, "markAuthorizationCodeUsed", codeHash, usedAt),
    saveRefreshSession: (session) => remoteStoreCall(stub, "saveRefreshSession", session),
    getRefreshSession: (refreshTokenHash) =>
      remoteStoreCall(stub, "getRefreshSession", refreshTokenHash),
    listExpiredRefreshSessions: (filter) =>
      remoteStoreCall(stub, "listExpiredRefreshSessions", filter),
    revokeRefreshSession: (refreshTokenHash, revokedAt, reason) =>
      remoteStoreCall(stub, "revokeRefreshSession", refreshTokenHash, revokedAt, reason),
    appendAuditEvent: (event) => remoteStoreCall(stub, "appendAuditEvent", event),
    listAuditEvents: (filter) => remoteStoreCall(stub, "listAuditEvents", filter)
  };
}

async function remoteStoreCall<Result>(
  stub: AgentIdentityStoreStub,
  method: AgentIdentityStoreMethod,
  ...args: unknown[]
): Promise<Result> {
  const operation: AgentIdentityStoreOperation = { method, args };
  const response = await stub.fetch("https://agent-identity-store/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(operation)
  });

  if (!response.ok) {
    throw new Error(`Agent identity store request failed: ${response.status}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as Result;
}
