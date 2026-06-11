---
status: proposed
date: 2026-06-10
related:
  - docs/adr/0003-use-workos-for-auth-identity.md
  - docs/assistant-memory-primitives.md
  - docs/assistant-eval-strategy.md
---

# RFC: Agentic Identity Model

## Summary

Implement a Ramp-style agentic identity model for Teampitch Assistant. The model should let AI agents act on behalf of authenticated human sponsors while preserving user control, admin oversight, scoped authority, lifecycle controls, and audit-grade attribution.

The current WorkOS slice gives the application real human login and provider-neutral memory grants. This RFC covers the remaining agent identity system: named agent identities, sponsor-bound agent keys, OAuth2-PKCE authorization for public clients, scoped down access, lifecycle controls, admin controls, and actor attribution such as `Sarah via Codex`.

## Current State

Already implemented:

- WorkOS/AuthKit login, signup, callback, logout, and `/auth/me`.
- Sealed HTTP-only WorkOS session cookie handling.
- Provider-neutral `AuthIdentityAdapter`.
- Local fallback identity for development and tests.
- WorkOS-backed memory access context with `private`, `team`, `org`, and `session` grants.
- Agent request auth gate for `/agents/*` when `AUTH_IDENTITY_ADAPTER=workos`.
- Memory read/write grant enforcement.
- Memory records, route records, scheduled task payloads, and debug snapshots carry the current actor identity.
- Debug drawer shows the current subject and grants.

Not implemented:

- Named agent identities.
- Agent keys that bind an agent to a human sponsor.
- OAuth2-PKCE authorization-code and refresh-token flow for CLI/MCP/public clients.
- Distinct sponsor vs agent attribution in every action.
- Agent expiration, renewal, revocation, and session invalidation.
- Sponsor and admin management surfaces.
- Admin policy to disable or restrict agent creation.
- Agent lifecycle notifications.
- Standalone agents.

## Problem

An AI agent can now reach authenticated product surfaces, but the application still cannot represent the agent as its own controlled actor. If a user connects Codex, Claude Code, Cursor, or an MCP client, the system needs to answer these questions:

- Which human sponsor authorized this agent?
- Which named agent acted?
- What was the agent allowed to do?
- Was the agent's authority still valid at action time?
- Can the sponsor, manager, or admin revoke it?
- Can an audit reader distinguish `Sarah clicked approve` from `Sarah's Codex agent clicked approve`?

Without an explicit agent identity primitive, every agent action collapses into the human user session. That creates weak attribution, broad inherited access, poor lifecycle hygiene, and no durable admin control.

## Goals

- Model agents as first-class actors that act on behalf of human sponsors.
- Keep the sponsor accountable and visible for every agent action.
- Prevent agents from receiving more access than the sponsor already has.
- Allow sponsors to create, name, scope, expire, renew, and revoke their own agents.
- Allow admins to inspect, expire, revoke, and disable agent access for the organization.
- Use OAuth2-PKCE semantics for CLI/MCP/public clients rather than handing users API keys.
- Treat agent keys as identifiers and lifecycle records, not bearer secrets.
- Preserve local development without WorkOS credentials.
- Make every memory, routing, scheduled task, and future tool action auditable as `sponsor via agent`.

## Non-Goals

- Do not build standalone agents in the first implementation slice.
- Do not mint broad organization-level service accounts.
- Do not introduce Vectorize or projection caching as part of this RFC.
- Do not build a full enterprise admin portal clone.
- Do not depend memory code on WorkOS SDK objects.
- Do not treat an agent key id as an API key or bearer credential.

## Decision: Start With On-Behalf-Of User

The first production model should be OBOU: on-behalf-of-user agents.

An OBOU agent is always tied to a human sponsor. Its effective access is the intersection of:

1. The sponsor's current WorkOS identity, organization membership, role, permissions, and grants.
2. The agent identity's configured scopes and capability bounds.
3. The current session or token constraints.
4. Runtime resource checks inside memory, routing, and tool execution.

This matches the current product shape and avoids introducing virtual employees before the app has enough admin controls and audit experience.

Standalone agents are deferred. The data model should leave room for `actingMode: "standalone"`, but the first accepted implementation must reject standalone creation unless an explicit feature flag enables it.

## Concepts

### Sponsor

The authenticated human user who creates or authorizes an agent. In WorkOS mode this is the WorkOS user from the sealed session or verified access token.

### Agent Identity

The durable application record for a named agent. It has a sponsor, business or organization id, display name, lifecycle state, configured bounds, and audit metadata.

### Agent Key

The durable key record that identifies which agent is being authorized. The key is not bearer authentication material. Leaking an agent key id alone must not grant access.

### Agent Session

A short-lived authenticated session created through OAuth2-PKCE. It carries the selected agent identity, sponsor identity, token expiry, refresh state, and session version.

### Actor Context

The denormalized actor object attached to auditable actions. It must include both sponsor and agent context when an agent acts.

Example display forms:

- Human only: `Sarah`
- Agent OBOU: `Sarah via Codex`
- Local dev fallback: `Local User`

### Effective Grants

The grants an action can actually use after sponsor grants, agent bounds, and session constraints are intersected. Effective grants are what memory, routing, and tools should enforce.

## Target Data Model

The exact storage backend can remain app-owned Durable Object SQLite for the first implementation. The schema should be explicit and migration-friendly.

### `agent_identities`

Required fields:

- `id`: stable internal id.
- `organization_id`: WorkOS organization id or local fallback org id.
- `sponsor_subject_id`: WorkOS user id or local fallback subject id.
- `sponsor_display_name`: denormalized sponsor display name at creation.
- `name`: user-facing agent name, such as `Codex` or `AP Review Agent`.
- `description`: optional purpose text.
- `acting_mode`: `obou` for the first implementation.
- `status`: `active`, `expired`, `revoked`, or `disabled`.
- `allowed_scopes`: JSON bounds for `private`, `team`, `org`, and `session`.
- `allowed_capabilities`: JSON bounds such as `memory:read`, `memory:write`, `routing:write`, `tools:schedule`.
- `expires_at`: required.
- `created_at`, `updated_at`.
- `created_by_actor`: denormalized actor context.
- `revoked_at`, `revoked_by_actor`, `revocation_reason`.
- `last_used_at`.

### `agent_keys`

Required fields:

- `id`: stable public key id.
- `agent_identity_id`.
- `status`: `active`, `expired`, `revoked`, or `disabled`.
- `created_at`, `updated_at`, `expires_at`.
- `revoked_at`, `revoked_by_actor`, `revocation_reason`.
- `session_version`: monotonically increasing value used to invalidate refresh sessions.

The public `id` may be shown to users, copied into CLI configuration, or posted in Slack. It must never be sufficient to call product APIs.

### `agent_authorization_codes`

Required fields:

- `code_hash`: hash of the one-time authorization code.
- `agent_key_id`.
- `sponsor_subject_id`.
- `organization_id`.
- `redirect_uri`.
- `code_challenge`.
- `code_challenge_method`: `S256` only.
- `requested_scopes`.
- `expires_at`.
- `used_at`.
- `created_at`.

Authorization codes must be single-use and short lived.

### `agent_refresh_sessions`

Required fields:

- `id`.
- `refresh_token_hash`.
- `agent_key_id`.
- `agent_identity_id`.
- `sponsor_subject_id`.
- `organization_id`.
- `session_version`.
- `created_at`, `updated_at`, `expires_at`, `last_used_at`.
- `revoked_at`, `revocation_reason`.

Refresh tokens must be stored hashed. Refresh should rotate tokens or otherwise make replay visible and revocable.

### `agent_audit_events`

Required fields:

- `id`.
- `event_type`.
- `occurred_at`.
- `organization_id`.
- `sponsor_subject_id`.
- `agent_identity_id`.
- `agent_key_id`.
- `actor_context`.
- `target_type`, `target_id`.
- `metadata`.

Audit events should be written for creation, authorization, token exchange, refresh, expiration, renewal, revocation, admin disablement, and agent-performed actions.

## Actor Context Shape

Extend the current memory actor model from "one subject" to "human sponsor plus optional agent".

Proposed shape:

```ts
interface ActorContext {
  actorType: "user" | "agent";
  displayName: string;
  provider: "local" | "workos";
  organizationId: string;
  sessionId: string;
  sponsor: {
    subjectId: string;
    displayName: string;
    role: string;
    permissions: readonly string[];
  };
  agent?: {
    identityId: string;
    keyId: string;
    name: string;
    actingMode: "obou" | "standalone";
    status: string;
    expiresAt: string;
  };
  grants: readonly {
    scope: "private" | "team" | "org" | "session";
    scopeId: string;
  }[];
}
```

Memory records may keep their current `actor` field name, but the stored value should carry enough information to render both modes. Existing records without agent context should decode as human-only actor contexts.

## OAuth2-PKCE Flow

The CLI, MCP server, and similar clients are public clients. They must not receive user-managed API keys.

### Authorization

1. Client generates a PKCE code verifier and `S256` code challenge.
2. Client opens `/oauth/authorize` with `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, requested scopes, and optional `agent_key_id`.
3. If no user session exists, the user is sent through WorkOS/AuthKit login.
4. The sponsor selects an existing agent identity or creates a new one.
5. The app verifies requested scopes are within sponsor access and agent bounds.
6. The app creates a short-lived authorization code tied to the selected agent key and PKCE challenge.
7. The browser redirects back to the client redirect URI with `code` and `state`.

### Token Exchange

1. Client posts to `/oauth/token` with `grant_type=authorization_code`, `code`, `redirect_uri`, and `code_verifier`.
2. The server verifies the code hash, redirect URI, expiry, single-use state, and PKCE challenge.
3. The server revalidates the agent key and sponsor status.
4. The server returns a short-lived JWT access token and a refresh token.
5. The JWT contains agent identity id, sponsor subject id, organization id, session id, session version, scopes, and expiry.

### Refresh

1. Client posts to `/oauth/token` with `grant_type=refresh_token`.
2. The server checks the hashed refresh token, agent key status, expiry, session version, sponsor status, and effective grants.
3. The server returns a new short-lived access token and rotated refresh token.
4. If the key is expired, revoked, disabled, or out of bounds, refresh fails closed.

### Revocation

1. Sponsor or admin revokes an agent key.
2. The key status changes and `session_version` increments.
3. Refresh tokens for the old version stop working.
4. Existing access tokens expire quickly and cannot be refreshed.

## Scoping Rules

An agent can never gain more access than its sponsor.

Required enforcement points:

- Agent creation validates requested scopes against the sponsor's current grants.
- Authorization validates requested scopes against sponsor grants and agent bounds.
- Token exchange recomputes effective grants, rather than trusting the authorization request.
- Refresh recomputes effective grants, rather than trusting the old token.
- Every memory read, memory write, lifecycle action, route record, scheduled task, and future tool action enforces effective grants server-side.
- UI filtering must not be the only access control.

The first implementation should support these capability bounds:

- `memory:read`
- `memory:write`
- `memory:lifecycle`
- `routing:write`
- `tools:schedule`

The capability list should be versioned so future product tools can add finer scopes without rewriting existing agent records.

## Lifecycle

All agent keys must be time-bound.

Required lifecycle states:

- `active`: usable for authorization and refresh.
- `expired`: past `expires_at`; cannot authorize or refresh until renewed.
- `revoked`: explicitly revoked by sponsor, manager, or admin.
- `disabled`: blocked by admin policy or sponsor status.

Required lifecycle behavior:

- Agent keys require `expires_at` at creation.
- Default expiry should be short enough for early use, such as 30 or 90 days.
- Renewal extends `expires_at` without changing the public key id.
- Renewal must not resurrect revoked keys.
- Revocation records who revoked the key and why.
- Revocation increments session version and stops refresh.
- Expiration and revocation must preserve audit history.
- Sponsor deactivation or organization removal disables related OBOU agents.

Notification delivery can start as in-app audit events. Email or external notifications can be added after the audit event contract exists.

## Admin Controls

Sponsors can:

- Create agent identities.
- View their own agent identities and keys.
- Renew active or expired keys if policy allows.
- Revoke their own keys.
- See recent use and audit events for their keys.

Admins can:

- View all agent identities in the organization.
- Filter by sponsor, status, expiry, scope, and last used time.
- Revoke or expire any agent key.
- Disable agent creation for the organization, role, or user group.
- Set maximum allowed expiry.
- Set allowed capabilities by role or group.
- Inspect audit events.

The first admin UI can be an audit-oriented internal surface. It should not be mixed into normal chat UX.

## User Experience

### Sponsor Setup

The sponsor should be able to:

1. Sign in with WorkOS.
2. Open agent settings.
3. Create a named agent identity.
4. Choose capability bounds and expiry.
5. Copy or configure the public agent key id in a CLI/MCP client.
6. Complete OAuth2-PKCE authorization from the client.
7. See the agent listed as active with last-used and expiry metadata.

### Runtime Attribution

When an agent performs an action, debug and audit surfaces should show:

- Sponsor name.
- Agent name.
- Effective grants.
- Capability used.
- Target record or task.
- Token session id or agent session id.
- Timestamp.

Normal user-facing copy should render concise attribution such as `Sarah via Codex`. Debug surfaces can expose full ids.

### Revocation

The sponsor or admin should be able to revoke from the management UI and see immediate status changes. The agent should lose refresh capability immediately and receive an authentication error once its short-lived access token expires.

## API Surface

Exact route names can change during implementation, but the first accepted implementation needs equivalent surfaces.

Management:

- `GET /api/agent-identities`
- `POST /api/agent-identities`
- `GET /api/agent-identities/:id`
- `PATCH /api/agent-identities/:id`
- `POST /api/agent-identities/:id/renew`
- `POST /api/agent-identities/:id/revoke`
- `GET /api/agent-identities/:id/audit-events`

OAuth:

- `GET /oauth/authorize`
- `POST /oauth/token`
- `POST /oauth/revoke`

Debug:

- Debug drawer includes actor context, sponsor, agent, key status, effective grants, and lifecycle state when an agent session is active.

## Security Requirements

- WorkOS API keys and cookie passwords must remain server-only.
- Agent key ids are not bearer credentials.
- Authorization code and refresh token storage uses hashes, not raw token values.
- PKCE is required for authorization-code exchange.
- Only `S256` code challenge method is accepted.
- Authorization codes are single-use and short lived.
- Refresh revalidates agent key status, sponsor status, organization membership, and effective grants.
- Access tokens are short lived.
- Token payloads must not include secrets.
- Revocation prevents refresh immediately.
- All auth and agent management endpoints fail closed when WorkOS mode is enabled but configuration or session state is invalid.
- Cross-origin redirects are rejected unless explicitly allowlisted for registered public clients.
- CSRF/state checks are required for browser authorization flows.
- Audit events must not store raw access tokens, refresh tokens, authorization codes, or WorkOS API keys.

## Implementation Plan

### PR3: Agent Identity Core

Build the durable agent identity model without OAuth tokens.

Deliver:

- SQLite-backed `AgentIdentityStore`.
- `agent_identities`, `agent_keys`, and `agent_audit_events` schema.
- Provider-neutral `AgentIdentityService`.
- Sponsor-bound create/list/get/revoke/renew operations.
- OBOU-only model with standalone creation rejected.
- Actor context type that can represent `user` and `user via agent`.
- Local fallback support for dev/test.
- Unit tests for create, scope validation, expiry, revocation, and audit events.

### PR4: OAuth2-PKCE Agent Authorization

Add public-client authorization.

Deliver:

- `/oauth/authorize`.
- `/oauth/token` for authorization code.
- `/oauth/token` for refresh token.
- `/oauth/revoke`.
- PKCE verifier and challenge validation.
- Short-lived JWT access tokens.
- Hashed refresh-token storage.
- Session version invalidation.
- Agent access token verification inside `AuthIdentityAdapter`.
- Integration tests for success, invalid PKCE, expired code, reused code, revoked key, and refresh after revocation.

### PR5: Agent Attribution Everywhere

Wire actor context through runtime actions.

Deliver:

- Memory records store sponsor plus agent context.
- Search provenance includes sponsor, agent, effective grants, and blocked candidates.
- Route records store sponsor plus agent context.
- Scheduled task payloads store sponsor plus agent context.
- Debug drawer renders `Sponsor via Agent`.
- Any future webhook/eventing primitive includes typed actor context.
- Evals cover attribution and private/team/org scope behavior.

### PR6: Lifecycle And Admin Controls

Add sponsor and admin management surfaces.

Deliver:

- Agent settings UI for sponsors.
- Admin/audit UI for all org agents.
- Expire, renew, revoke, and disable actions.
- Policy knobs for max expiry and allowed capabilities.
- In-app audit events for creation, authorization, refresh, renewal, revocation, expiration, and disabled access.
- Tests for sponsor-only access, admin override, and non-admin denial.

### PR7: Management Polish And Operational Hardening

Prepare for broader use.

Deliver:

- Empty/loading/error states for management surfaces.
- Last-used tracking.
- Expiry warning events.
- Token/session cleanup for expired records.
- Runbook documentation.
- Optional E2E flow with WorkOS credentials when environment variables exist.

## Implementation Status: 2026-06-10

Implemented in the current branch:

- Durable OBOU agent identity, key, authorization-code, refresh-session, and audit-event records.
- SQLite-backed Durable Object store with local in-memory fallback.
- Sponsor-bound create, list, get, renew, revoke, and admin disable operations.
- Admin list-all mode with sponsor, status, scope, expiry, and last-used filters.
- Environment-backed policy for creation disablement, max expiry, capability allowlists, role capability allowlists, and OAuth redirect allowlists.
- Registered OAuth client records with admin create/list/disable APIs, per-client redirect URIs, per-client capability bounds, and active/disabled status enforcement.
- OAuth2-PKCE authorization-code, refresh, and revoke endpoints with required `state`, S256-only PKCE, single-use hashed authorization codes, hashed rotating refresh tokens, short-lived JWT access tokens, and session-version invalidation.
- Agent access-token resolution through the provider-neutral auth adapter.
- Effective runtime capability/grant intersection between persisted agent bounds and token session bounds.
- Memory, route, scheduled task, and debug actor context support for sponsor-plus-agent attribution.
- Search provenance includes the actor display, sponsor context, agent context, and effective grants.
- Runtime agent requests append `agent.runtime_action` audit events.
- Sponsor settings UI and admin/audit controls for list filters, renew, revoke, and disable.
- Expiration transition to `expired` with durable `agent.expired` audit event when expired active keys are encountered.
- WorkOS-backed sponsor revalidation for token exchange, refresh, and access-token resolution. Removed sponsors or inactive organization memberships disable related OBOU agents.
- Daily Worker cron lifecycle maintenance for expiry warnings, expiration transitions, and expired refresh-session cleanup.
- Optional WorkOS E2E test harness gated by WorkOS credentials and an admin sealed-session cookie.
- Tests for create, scope validation, PKCE success/failure, replay rejection, refresh rotation/revocation, admin override, non-admin denial, policy enforcement, redirect allowlists, expiration audit, WorkOS sponsor revalidation, runtime action audit, scheduled-task attribution, and local fallback.
- Evals for agent-session scope blocking, search provenance attribution, and route-record `Sponsor via Agent` attribution.

Remaining gaps before this RFC should be treated as fully complete:

- No blocking implementation gaps remain in the local/testable RFC scope.
- The optional WorkOS E2E path only runs when staging credentials and `WORKOS_E2E_ADMIN_SESSION_COOKIE` are present.

## Acceptance Criteria

### Core Model

- [x] The system has an `AgentIdentity` record tied to exactly one sponsor and one organization.
- [x] The system has an `AgentKey` record tied to exactly one agent identity.
- [x] Agent keys have `active`, `expired`, `revoked`, and `disabled` states.
- [x] Every agent key has an expiration date at creation.
- [x] Agent key ids are stable public identifiers and are not accepted as bearer credentials.
- [x] Standalone agent creation is rejected unless an explicit standalone-agent feature flag exists.

### OBOU Access Control

- [x] Effective grants are computed as sponsor grants intersected with agent bounds and session constraints.
- [x] Agents can never access a private, team, org, or session scope the sponsor cannot access.
- [x] Agents can never use a capability outside the configured agent bounds.
- [x] Memory reads enforce effective grants server-side.
- [x] Memory writes enforce effective grants server-side.
- [x] Memory lifecycle changes enforce effective grants server-side.
- [x] Route records and scheduled task payloads use the same effective actor context.
- [x] Local fallback still works without WorkOS credentials.

### OAuth2-PKCE

- [x] Public clients authorize through an OAuth2-PKCE authorization-code flow.
- [x] `code_challenge_method=plain` is rejected.
- [x] Authorization codes are short lived.
- [x] Authorization codes are single-use.
- [x] Token exchange validates `redirect_uri`.
- [x] Token exchange validates the PKCE code verifier.
- [x] Token exchange revalidates agent key status and sponsor grants.
- [x] Refresh tokens are stored hashed.
- [x] Refresh revalidates agent key status, sponsor status, organization membership, session version, and effective grants.
- [x] Revoked, expired, or disabled keys cannot authorize or refresh.
- [x] Access tokens are short lived and contain no secrets.

### Attribution

- [x] Human-only actions render as the human sponsor.
- [x] Agent actions render as `Sponsor via Agent`.
- [x] Memory records store actor context with sponsor and agent metadata for agent actions.
- [x] Search provenance includes actor context and effective grants.
- [x] Route records include actor context and effective grants.
- [x] Scheduled task payloads include actor context and effective grants.
- [x] Debug drawer shows sponsor, agent, key id, key status, expiry, and effective grants.
- [x] Existing human-only memory records remain decodable.

### Lifecycle

- [x] Sponsors can list their own agent identities and keys.
- [x] Sponsors can revoke their own agent keys.
- [x] Sponsors can renew eligible non-revoked agent keys.
- [x] Renewal extends expiry without changing the public key id.
- [x] Revocation records actor, timestamp, and reason.
- [x] Revocation increments session version or otherwise invalidates refresh.
- [x] Expired keys cannot authorize or refresh.
- [x] Sponsor deactivation or org removal disables related OBOU agents.
- [x] Audit history remains available after expiration or revocation.

### Admin Controls

- [x] Admins can list all organization agent identities.
- [x] Admins can filter agents by sponsor, status, expiry, scope, and last used time.
- [x] Admins can revoke or disable any organization agent key.
- [x] Non-admin users cannot list or mutate other sponsors' agent keys.
- [x] Admin policy can disable new agent creation.
- [x] Admin policy can cap maximum expiry.
- [x] Admin policy can restrict capabilities by role or group.

### Audit And Events

- [x] Audit events are written for create, authorize, token exchange, refresh, renew, revoke, expire, disable, and runtime agent action.
- [x] Audit events include sponsor id, agent identity id, agent key id, actor context, target, and timestamp.
- [x] Audit events never include raw access tokens, refresh tokens, authorization codes, WorkOS API keys, or cookie passwords.
- [x] Revocation and expiration produce durable audit events.

### UI

- [x] Sponsor settings show agent name, status, expiry, scopes, capabilities, last used time, and revoke/renew actions.
- [x] Admin view shows organization-wide agents and audit metadata.
- [x] UI actions display clear failure states for expired, revoked, disabled, and unauthorized keys.
- [x] Normal chat UI remains uncluttered.
- [x] Debug/audit UI exposes ids and grants.

### Testing And Evals

- [x] Unit tests cover agent identity creation, scope validation, lifecycle transitions, and audit events.
- [x] Unit tests cover PKCE verifier success and failure.
- [x] Unit tests cover authorization code expiry and replay rejection.
- [x] Unit tests cover refresh token rotation or replay handling.
- [x] Integration tests cover WorkOS session plus agent authorization.
- [x] Integration tests cover local fallback without WorkOS credentials.
- [x] Evals assert inaccessible private/team/org records are blocked for agent sessions.
- [x] Evals assert `Sponsor via Agent` attribution is present for memory and route records.
- [x] Optional WorkOS E2E runs only when WorkOS environment variables exist.
- [x] `bun run check:all` passes before shipping each slice.

## Resolved Decisions

- Admins are users with `admin`, `local-admin`, `agent:admin`, or `admin` permissions in the resolved auth context.
- Default key expiry is 30 days, with an environment policy cap available through `AGENT_IDENTITY_MAX_EXPIRY_DAYS`.
- Non-local public clients use registered OAuth client records with per-client redirect URIs and capability bounds.
- Refresh tokens are hashed, rotated on use, and additionally invalidated by key session version.
- The first notification channel is the in-app audit event stream. Email and external notification delivery can layer on the same event contract later.
- The first capability taxonomy is `memory:read`, `memory:write`, `memory:lifecycle`, `routing:write`, and `tools:schedule`.

## Definition Of Done

This RFC is complete when a sponsor can create a named OBOU agent, authorize a CLI or MCP client through OAuth2-PKCE, have that agent act with scoped-down effective grants, see every action attributed as `Sponsor via Agent`, and revoke the agent so it can no longer refresh or perform new actions. Admins must be able to inspect and revoke organization agent access, and the test/eval suite must prove that unauthorized memory and tool access fails closed.
