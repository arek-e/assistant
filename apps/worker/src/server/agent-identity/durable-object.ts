import { DurableObject } from "cloudflare:workers";

import {
  SqliteAgentIdentityStore,
  type AgentAuditEventFilter,
  type AgentExpiredRefreshSessionFilter,
  type AgentIdentityListFilter,
  type AgentIdentityLifecycleFilter,
  type AgentIdentityStore,
  type AgentIdentityStoreMethod,
  type AgentIdentityStoreOperation
} from "./store";
import type {
  AgentAuditEvent,
  AgentAuthorizationCode,
  AgentIdentity,
  AgentKey,
  AgentOAuthClient,
  AgentRefreshSession
} from "./types";

type StoreHandler = (store: AgentIdentityStore, args: unknown[]) => Promise<unknown>;

const storeHandlers: Record<AgentIdentityStoreMethod, StoreHandler> = {
  upsertIdentity: (store, [identity]) => store.upsertIdentity(identity as AgentIdentity),
  upsertKey: (store, [key]) => store.upsertKey(key as AgentKey),
  getIdentity: (store, [id]) => store.getIdentity(String(id)),
  getKey: (store, [id]) => store.getKey(String(id)),
  getKeyByIdentityId: (store, [identityId]) => store.getKeyByIdentityId(String(identityId)),
  listIdentities: (store, [filter]) => store.listIdentities(filter as AgentIdentityListFilter),
  listLifecycleIdentities: (store, [filter]) =>
    store.listLifecycleIdentities(filter as AgentIdentityLifecycleFilter),
  upsertOAuthClient: (store, [client]) => store.upsertOAuthClient(client as AgentOAuthClient),
  getOAuthClient: (store, [organizationId, id]) =>
    store.getOAuthClient(String(organizationId), String(id)),
  listOAuthClients: (store, [filter]) =>
    store.listOAuthClients(filter as { organizationId: string }),
  saveAuthorizationCode: (store, [code]) =>
    store.saveAuthorizationCode(code as AgentAuthorizationCode),
  getAuthorizationCode: (store, [codeHash]) => store.getAuthorizationCode(String(codeHash)),
  markAuthorizationCodeUsed: (store, [codeHash, usedAt]) =>
    store.markAuthorizationCodeUsed(String(codeHash), String(usedAt)),
  saveRefreshSession: (store, [session]) =>
    store.saveRefreshSession(session as AgentRefreshSession),
  getRefreshSession: (store, [refreshTokenHash]) =>
    store.getRefreshSession(String(refreshTokenHash)),
  listExpiredRefreshSessions: (store, [filter]) =>
    store.listExpiredRefreshSessions(filter as AgentExpiredRefreshSessionFilter),
  revokeRefreshSession: (store, [refreshTokenHash, revokedAt, reason]) =>
    store.revokeRefreshSession(String(refreshTokenHash), String(revokedAt), String(reason)),
  appendAuditEvent: (store, [event]) => store.appendAuditEvent(event as AgentAuditEvent),
  listAuditEvents: (store, [filter]) => store.listAuditEvents(filter as AgentAuditEventFilter)
};

export class AgentIdentityStoreDO extends DurableObject<Env> {
  private readonly store: AgentIdentityStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new SqliteAgentIdentityStore(ctx.storage.sql);
  }

  async fetch(request: Request): Promise<Response> {
    const operation = (await request.json()) as AgentIdentityStoreOperation;

    if (!isStoreMethod(operation.method)) {
      return json({ error: "unknown_store_method" }, 400);
    }

    const result = await storeHandlers[operation.method](this.store, operation.args);
    return json(result);
  }
}

function isStoreMethod(value: string): value is AgentIdentityStoreMethod {
  return value in storeHandlers;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
