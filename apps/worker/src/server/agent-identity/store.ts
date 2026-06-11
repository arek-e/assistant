import type { MemorySqlStorage, MemorySqlValue } from "../memory/sqlite-memory-store";
import type {
  AgentAuthorizationCode,
  AgentAuditEvent,
  AgentIdentity,
  AgentKey,
  AgentOAuthClient,
  AgentRefreshSession
} from "./types";

export interface AgentIdentityStore {
  upsertIdentity(identity: AgentIdentity): Promise<AgentIdentity>;
  upsertKey(key: AgentKey): Promise<AgentKey>;
  getIdentity(id: string): Promise<AgentIdentity | null>;
  getKey(id: string): Promise<AgentKey | null>;
  getKeyByIdentityId(identityId: string): Promise<AgentKey | null>;
  listIdentities(filter: AgentIdentityListFilter): Promise<AgentIdentity[]>;
  listLifecycleIdentities(filter: AgentIdentityLifecycleFilter): Promise<AgentIdentity[]>;
  upsertOAuthClient(client: AgentOAuthClient): Promise<AgentOAuthClient>;
  getOAuthClient(organizationId: string, id: string): Promise<AgentOAuthClient | null>;
  listOAuthClients(filter: AgentOAuthClientListFilter): Promise<AgentOAuthClient[]>;
  saveAuthorizationCode(code: AgentAuthorizationCode): Promise<void>;
  getAuthorizationCode(codeHash: string): Promise<AgentAuthorizationCode | null>;
  markAuthorizationCodeUsed(codeHash: string, usedAt: string): Promise<void>;
  saveRefreshSession(session: AgentRefreshSession): Promise<void>;
  getRefreshSession(refreshTokenHash: string): Promise<AgentRefreshSession | null>;
  listExpiredRefreshSessions(
    filter: AgentExpiredRefreshSessionFilter
  ): Promise<AgentRefreshSession[]>;
  revokeRefreshSession(refreshTokenHash: string, revokedAt: string, reason: string): Promise<void>;
  appendAuditEvent(event: AgentAuditEvent): Promise<void>;
  listAuditEvents(filter: AgentAuditEventFilter): Promise<AgentAuditEvent[]>;
}

export type AgentIdentityStoreMethod = keyof AgentIdentityStore;

export interface AgentIdentityStoreOperation {
  method: AgentIdentityStoreMethod;
  args: unknown[];
}

export interface AgentIdentityListFilter {
  organizationId: string;
  sponsorSubjectId?: string;
  includeAllSponsors?: boolean;
}

export interface AgentIdentityLifecycleFilter {
  status: AgentIdentity["status"];
  expiresBefore: string;
}

export interface AgentAuditEventFilter {
  organizationId: string;
  agentIdentityId?: string;
  sponsorSubjectId?: string;
}

export interface AgentOAuthClientListFilter {
  organizationId: string;
  status?: AgentOAuthClient["status"];
}

export interface AgentExpiredRefreshSessionFilter {
  expiresBefore: string;
}

export class InMemoryAgentIdentityStore implements AgentIdentityStore {
  private readonly identities = new Map<string, AgentIdentity>();
  private readonly keys = new Map<string, AgentKey>();
  private readonly oauthClients = new Map<string, AgentOAuthClient>();
  private readonly authorizationCodes = new Map<string, AgentAuthorizationCode>();
  private readonly refreshSessions = new Map<string, AgentRefreshSession>();
  private readonly auditEvents: AgentAuditEvent[] = [];

  async upsertIdentity(identity: AgentIdentity): Promise<AgentIdentity> {
    this.identities.set(identity.id, clone(identity));
    return clone(identity);
  }

  async upsertKey(key: AgentKey): Promise<AgentKey> {
    this.keys.set(key.id, clone(key));
    return clone(key);
  }

  async getIdentity(id: string): Promise<AgentIdentity | null> {
    return cloneOrNull(this.identities.get(id));
  }

  async getKey(id: string): Promise<AgentKey | null> {
    return cloneOrNull(this.keys.get(id));
  }

  async getKeyByIdentityId(identityId: string): Promise<AgentKey | null> {
    const key = [...this.keys.values()].find(
      (candidate) => candidate.agentIdentityId === identityId
    );
    return cloneOrNull(key);
  }

  async listIdentities(filter: AgentIdentityListFilter): Promise<AgentIdentity[]> {
    return [...this.identities.values()]
      .filter((identity) => identity.organizationId === filter.organizationId)
      .filter(
        (identity) =>
          filter.includeAllSponsors || identity.sponsorSubjectId === filter.sponsorSubjectId
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  async listLifecycleIdentities(filter: AgentIdentityLifecycleFilter): Promise<AgentIdentity[]> {
    return [...this.identities.values()]
      .filter((identity) => identity.status === filter.status)
      .filter((identity) => identity.expiresAt <= filter.expiresBefore)
      .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt))
      .map(clone);
  }

  async upsertOAuthClient(client: AgentOAuthClient): Promise<AgentOAuthClient> {
    this.oauthClients.set(oauthClientKey(client.organizationId, client.id), clone(client));
    return clone(client);
  }

  async getOAuthClient(organizationId: string, id: string): Promise<AgentOAuthClient | null> {
    return cloneOrNull(this.oauthClients.get(oauthClientKey(organizationId, id)));
  }

  async listOAuthClients(filter: AgentOAuthClientListFilter): Promise<AgentOAuthClient[]> {
    return [...this.oauthClients.values()]
      .filter((client) => client.organizationId === filter.organizationId)
      .filter((client) => !filter.status || client.status === filter.status)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  async saveAuthorizationCode(code: AgentAuthorizationCode): Promise<void> {
    this.authorizationCodes.set(code.codeHash, clone(code));
  }

  async getAuthorizationCode(codeHash: string): Promise<AgentAuthorizationCode | null> {
    return cloneOrNull(this.authorizationCodes.get(codeHash));
  }

  async markAuthorizationCodeUsed(codeHash: string, usedAt: string): Promise<void> {
    const code = this.authorizationCodes.get(codeHash);
    if (code) this.authorizationCodes.set(codeHash, { ...code, usedAt });
  }

  async saveRefreshSession(session: AgentRefreshSession): Promise<void> {
    this.refreshSessions.set(session.refreshTokenHash, clone(session));
  }

  async getRefreshSession(refreshTokenHash: string): Promise<AgentRefreshSession | null> {
    return cloneOrNull(this.refreshSessions.get(refreshTokenHash));
  }

  async listExpiredRefreshSessions(
    filter: AgentExpiredRefreshSessionFilter
  ): Promise<AgentRefreshSession[]> {
    return [...this.refreshSessions.values()]
      .filter((session) => !session.revokedAt)
      .filter((session) => session.expiresAt <= filter.expiresBefore)
      .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt))
      .map(clone);
  }

  async revokeRefreshSession(
    refreshTokenHash: string,
    revokedAt: string,
    reason: string
  ): Promise<void> {
    const session = this.refreshSessions.get(refreshTokenHash);
    if (!session) return;

    this.refreshSessions.set(refreshTokenHash, {
      ...session,
      revokedAt,
      revocationReason: reason,
      updatedAt: revokedAt
    });
  }

  async appendAuditEvent(event: AgentAuditEvent): Promise<void> {
    this.auditEvents.push(clone(event));
  }

  async listAuditEvents(filter: AgentAuditEventFilter): Promise<AgentAuditEvent[]> {
    return this.auditEvents
      .filter((event) => event.organizationId === filter.organizationId)
      .filter(
        (event) => !filter.agentIdentityId || event.agentIdentityId === filter.agentIdentityId
      )
      .filter(
        (event) => !filter.sponsorSubjectId || event.sponsorSubjectId === filter.sponsorSubjectId
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .map(clone);
  }
}

interface AgentIdentityRow extends Record<string, MemorySqlValue> {
  record: string;
}

export class SqliteAgentIdentityStore implements AgentIdentityStore {
  constructor(private readonly sql: MemorySqlStorage) {
    this.ensureSchema();
  }

  async upsertIdentity(identity: AgentIdentity): Promise<AgentIdentity> {
    this.sql.exec(
      `
        INSERT INTO agent_identities (
          id, organization_id, sponsor_subject_id, status, expires_at, updated_at, record
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          organization_id = excluded.organization_id,
          sponsor_subject_id = excluded.sponsor_subject_id,
          status = excluded.status,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at,
          record = excluded.record
      `,
      identity.id,
      identity.organizationId,
      identity.sponsorSubjectId,
      identity.status,
      identity.expiresAt,
      identity.updatedAt,
      JSON.stringify(identity)
    );
    return identity;
  }

  async upsertKey(key: AgentKey): Promise<AgentKey> {
    this.sql.exec(
      `
        INSERT INTO agent_keys (
          id, agent_identity_id, status, expires_at, session_version, updated_at, record
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          agent_identity_id = excluded.agent_identity_id,
          status = excluded.status,
          expires_at = excluded.expires_at,
          session_version = excluded.session_version,
          updated_at = excluded.updated_at,
          record = excluded.record
      `,
      key.id,
      key.agentIdentityId,
      key.status,
      key.expiresAt,
      key.sessionVersion,
      key.updatedAt,
      JSON.stringify(key)
    );
    return key;
  }

  async getIdentity(id: string): Promise<AgentIdentity | null> {
    return this.getRecord<AgentIdentity>("SELECT record FROM agent_identities WHERE id = ?", id);
  }

  async getKey(id: string): Promise<AgentKey | null> {
    return this.getRecord<AgentKey>("SELECT record FROM agent_keys WHERE id = ?", id);
  }

  async getKeyByIdentityId(identityId: string): Promise<AgentKey | null> {
    return this.getRecord<AgentKey>(
      "SELECT record FROM agent_keys WHERE agent_identity_id = ? ORDER BY updated_at DESC LIMIT 1",
      identityId
    );
  }

  async listIdentities(filter: AgentIdentityListFilter): Promise<AgentIdentity[]> {
    const rows = filter.includeAllSponsors
      ? this.sql
          .exec(
            "SELECT record FROM agent_identities WHERE organization_id = ? ORDER BY updated_at DESC",
            filter.organizationId
          )
          .toArray()
      : this.sql
          .exec(
            "SELECT record FROM agent_identities WHERE organization_id = ? AND sponsor_subject_id = ? ORDER BY updated_at DESC",
            filter.organizationId,
            filter.sponsorSubjectId ?? ""
          )
          .toArray();

    return rows.map((row) => JSON.parse(String(row.record)) as AgentIdentity);
  }

  async listLifecycleIdentities(filter: AgentIdentityLifecycleFilter): Promise<AgentIdentity[]> {
    const rows = this.sql
      .exec(
        "SELECT record FROM agent_identities WHERE status = ? AND expires_at <= ? ORDER BY expires_at ASC",
        filter.status,
        filter.expiresBefore
      )
      .toArray();

    return rows.map((row) => JSON.parse(String(row.record)) as AgentIdentity);
  }

  async upsertOAuthClient(client: AgentOAuthClient): Promise<AgentOAuthClient> {
    this.sql.exec(
      `
        INSERT INTO agent_oauth_clients (
          id, organization_id, status, updated_at, record
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id, organization_id) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at,
          record = excluded.record
      `,
      client.id,
      client.organizationId,
      client.status,
      client.updatedAt,
      JSON.stringify(client)
    );
    return client;
  }

  async getOAuthClient(organizationId: string, id: string): Promise<AgentOAuthClient | null> {
    return this.getRecord<AgentOAuthClient>(
      "SELECT record FROM agent_oauth_clients WHERE organization_id = ? AND id = ?",
      organizationId,
      id
    );
  }

  async listOAuthClients(filter: AgentOAuthClientListFilter): Promise<AgentOAuthClient[]> {
    const rows = filter.status
      ? this.sql
          .exec(
            "SELECT record FROM agent_oauth_clients WHERE organization_id = ? AND status = ? ORDER BY updated_at DESC",
            filter.organizationId,
            filter.status
          )
          .toArray()
      : this.sql
          .exec(
            "SELECT record FROM agent_oauth_clients WHERE organization_id = ? ORDER BY updated_at DESC",
            filter.organizationId
          )
          .toArray();

    return rows.map((row) => JSON.parse(String(row.record)) as AgentOAuthClient);
  }

  async saveAuthorizationCode(code: AgentAuthorizationCode): Promise<void> {
    this.sql.exec(
      `
        INSERT INTO agent_authorization_codes (
          code_hash, agent_key_id, sponsor_subject_id, organization_id,
          redirect_uri, expires_at, used_at, record
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code_hash) DO UPDATE SET
          used_at = excluded.used_at,
          record = excluded.record
      `,
      code.codeHash,
      code.agentKeyId,
      code.sponsorSubjectId,
      code.organizationId,
      code.redirectUri,
      code.expiresAt,
      code.usedAt ?? null,
      JSON.stringify(code)
    );
  }

  async getAuthorizationCode(codeHash: string): Promise<AgentAuthorizationCode | null> {
    return this.getRecord<AgentAuthorizationCode>(
      "SELECT record FROM agent_authorization_codes WHERE code_hash = ?",
      codeHash
    );
  }

  async markAuthorizationCodeUsed(codeHash: string, usedAt: string): Promise<void> {
    const code = await this.getAuthorizationCode(codeHash);
    if (!code) return;
    await this.saveAuthorizationCode({ ...code, usedAt });
  }

  async saveRefreshSession(session: AgentRefreshSession): Promise<void> {
    this.sql.exec(
      `
        INSERT INTO agent_refresh_sessions (
          id, refresh_token_hash, agent_key_id, agent_identity_id,
          sponsor_subject_id, organization_id, session_version,
          expires_at, revoked_at, updated_at, record
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(refresh_token_hash) DO UPDATE SET
          revoked_at = excluded.revoked_at,
          updated_at = excluded.updated_at,
          record = excluded.record
      `,
      session.id,
      session.refreshTokenHash,
      session.agentKeyId,
      session.agentIdentityId,
      session.sponsorSubjectId,
      session.organizationId,
      session.sessionVersion,
      session.expiresAt,
      session.revokedAt ?? null,
      session.updatedAt,
      JSON.stringify(session)
    );
  }

  async getRefreshSession(refreshTokenHash: string): Promise<AgentRefreshSession | null> {
    return this.getRecord<AgentRefreshSession>(
      "SELECT record FROM agent_refresh_sessions WHERE refresh_token_hash = ?",
      refreshTokenHash
    );
  }

  async listExpiredRefreshSessions(
    filter: AgentExpiredRefreshSessionFilter
  ): Promise<AgentRefreshSession[]> {
    const rows = this.sql
      .exec(
        "SELECT record FROM agent_refresh_sessions WHERE revoked_at IS NULL AND expires_at <= ? ORDER BY expires_at ASC",
        filter.expiresBefore
      )
      .toArray();

    return rows.map((row) => JSON.parse(String(row.record)) as AgentRefreshSession);
  }

  async revokeRefreshSession(
    refreshTokenHash: string,
    revokedAt: string,
    reason: string
  ): Promise<void> {
    const session = await this.getRefreshSession(refreshTokenHash);
    if (!session) return;
    await this.saveRefreshSession({
      ...session,
      revokedAt,
      revocationReason: reason,
      updatedAt: revokedAt
    });
  }

  async appendAuditEvent(event: AgentAuditEvent): Promise<void> {
    this.sql.exec(
      `
        INSERT INTO agent_audit_events (
          id, event_type, occurred_at, organization_id, sponsor_subject_id,
          agent_identity_id, agent_key_id, target_type, target_id, record
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      event.id,
      event.eventType,
      event.occurredAt,
      event.organizationId,
      event.sponsorSubjectId,
      event.agentIdentityId ?? null,
      event.agentKeyId ?? null,
      event.targetType,
      event.targetId,
      JSON.stringify(event)
    );
  }

  async listAuditEvents(filter: AgentAuditEventFilter): Promise<AgentAuditEvent[]> {
    const rows = filter.agentIdentityId
      ? this.sql
          .exec(
            "SELECT record FROM agent_audit_events WHERE organization_id = ? AND agent_identity_id = ? ORDER BY occurred_at DESC",
            filter.organizationId,
            filter.agentIdentityId
          )
          .toArray()
      : this.sql
          .exec(
            "SELECT record FROM agent_audit_events WHERE organization_id = ? ORDER BY occurred_at DESC",
            filter.organizationId
          )
          .toArray();

    return rows
      .map((row) => JSON.parse(String(row.record)) as AgentAuditEvent)
      .filter(
        (event) => !filter.sponsorSubjectId || event.sponsorSubjectId === filter.sponsorSubjectId
      );
  }

  private ensureSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS agent_identities (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        sponsor_subject_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_identities_org_idx
        ON agent_identities(organization_id, sponsor_subject_id, status);

      CREATE TABLE IF NOT EXISTS agent_keys (
        id TEXT PRIMARY KEY,
        agent_identity_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        session_version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_keys_identity_idx
        ON agent_keys(agent_identity_id, status);

      CREATE TABLE IF NOT EXISTS agent_oauth_clients (
        id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        record TEXT NOT NULL,
        PRIMARY KEY (id, organization_id)
      );
      CREATE INDEX IF NOT EXISTS agent_oauth_clients_org_idx
        ON agent_oauth_clients(organization_id, status);

      CREATE TABLE IF NOT EXISTS agent_authorization_codes (
        code_hash TEXT PRIMARY KEY,
        agent_key_id TEXT NOT NULL,
        sponsor_subject_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        record TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_refresh_sessions (
        id TEXT PRIMARY KEY,
        refresh_token_hash TEXT UNIQUE NOT NULL,
        agent_key_id TEXT NOT NULL,
        agent_identity_id TEXT NOT NULL,
        sponsor_subject_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        session_version INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        updated_at TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_refresh_sessions_key_idx
        ON agent_refresh_sessions(agent_key_id, revoked_at);

      CREATE TABLE IF NOT EXISTS agent_audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        sponsor_subject_id TEXT NOT NULL,
        agent_identity_id TEXT,
        agent_key_id TEXT,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        record TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_audit_events_org_idx
        ON agent_audit_events(organization_id, agent_identity_id, occurred_at);
    `);
  }

  private getRecord<RecordType>(query: string, ...params: MemorySqlValue[]): RecordType | null {
    const rows = this.sql.exec(query, ...params).toArray() as AgentIdentityRow[];
    return rows[0]?.record ? (JSON.parse(rows[0].record) as RecordType) : null;
  }
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function cloneOrNull<Value>(value: Value | undefined): Value | null {
  return value ? clone(value) : null;
}

function oauthClientKey(organizationId: string, id: string): string {
  return `${organizationId}:${id}`;
}
