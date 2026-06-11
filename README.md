# Teampitch Assistant

Personal Cloudflare-hosted assistant workspace.

The repo follows Turborepo-style directory conventions with plain Bun workspaces. Turbo is intentionally not installed yet; Bun workspaces are enough while there is one deployable app and a small set of shared packages.

## Apps

- `apps/worker`: Cloudflare Worker, Agents runtime, React client, and Wrangler config.

## Packages

- `packages/ui`: shared Coss UI primitives, shared UI hooks, and UI utilities consumed by `apps/worker`.
- `packages/evals`: assistant primitive eval harness for memory, retrieval, routing, and lifecycle behavior.

## Commands

Run these from the repo root:

```bash
bun install
bun dev
bun run check
bun run types
bun run deploy
```

`bun dev` delegates to `@teampitch/worker` and starts the Cloudflare/Vite dev server.

## Auth Identity

The assistant uses a provider-neutral auth identity adapter for memory grants. Local development defaults to the local adapter and does not require WorkOS credentials.

Optional environment variables:

- `AUTH_IDENTITY_ADAPTER`: set to `workos` to resolve identity from WorkOS/AuthKit access tokens. Omit or set to `local` for local fallback.
- `AUTH_LOCAL_SUBJECT_ID`: local private memory subject id. Defaults to `local-user`.
- `AUTH_LOCAL_TEAM_ID`: local team memory scope id. Defaults to `default-team`.
- `AUTH_LOCAL_ORG_ID`: local org memory scope id. Defaults to `default-org`.
- `AUTH_LOCAL_SESSION_ID`: local session memory scope id. Defaults to the current agent session id or `local-session`.
- `WORKOS_API_KEY`: WorkOS API key used by the Worker for AuthKit login, callback, refresh, and logout.
- `WORKOS_CLIENT_ID`: WorkOS client id used for AuthKit login and JWT/JWKS validation.
- `WORKOS_COOKIE_PASSWORD`: 32+ character password used by the WorkOS SDK to seal the HTTP-only session cookie.
- `WORKOS_API_HOSTNAME`: optional custom WorkOS API/auth hostname.
- `WORKOS_REDIRECT_URI`: optional explicit callback URL. Defaults to the current origin plus `/auth/callback`.
- `WORKOS_RETURN_TO`: optional post-logout URL. Defaults to the current origin root.
- `WORKOS_SESSION_COOKIE`: optional sealed session cookie name. Defaults to `wos-session`.
- `WORKOS_STATE_COOKIE`: optional login state cookie name. Defaults to `wos-login-state`.
- `WORKOS_JWKS_URL`: optional override for the WorkOS JWKS URL.
- `WORKOS_ACCESS_TOKEN_COOKIE`: optional cookie name for WorkOS access tokens. Defaults to `workos_access_token`.
- `WORKOS_ACCESS_TOKEN_QUERY_PARAM`: optional query parameter name for access tokens passed to Agent connections. Defaults to `access_token`; `token` is also accepted.
- `WORKOS_E2E_ADMIN_SESSION_COOKIE`: optional sealed WorkOS admin session cookie value used only by the skipped-by-default WorkOS agent identity E2E test.
- `AUTH_DEMO_USERS_ENABLED`: set to `1` to show local/staging demo users on the sign-in screen. Demo users are disabled by default, only work on localhost or a staging-like environment, and resolve as WorkOS-shaped identities only when this flag is enabled.
- `AUTH_DEMO_ENVIRONMENT`: optional explicit demo environment marker. Use `staging`, `stage`, `preview`, `development`, or `local` for deployed non-production demo auth. Common `APP_ENV`, `ENVIRONMENT`, `NODE_ENV`, and `WORKOS_ENVIRONMENT` values are also accepted.
- `AUTH_DEMO_SESSION_COOKIE`: optional demo session cookie name. Defaults to `tp-demo-user`.
- `AGENT_ACCESS_TOKEN_SECRET`: optional secret used to sign short-lived agent access tokens. Defaults to `WORKOS_COOKIE_PASSWORD` when present, then a local development fallback.
- `AGENT_IDENTITY_CREATION_DISABLED`: set to `1` to block new agent identity creation.
- `AGENT_IDENTITY_MAX_EXPIRY_DAYS`: optional maximum key lifetime for creation and renewal.
- `AGENT_IDENTITY_ALLOWED_CAPABILITIES`: optional comma- or space-separated capability allowlist, such as `memory:read,memory:write`.
- `AGENT_IDENTITY_REDIRECT_URI_ALLOWLIST`: optional comma- or space-separated exact redirect URI allowlist that constrains registered non-local OAuth clients.
- `AGENT_IDENTITY_POLICY`: optional JSON policy object. Supports `creationDisabled`, `maxExpiryDays`, `allowedCapabilities`, `allowedCapabilitiesByRole`, and `allowedRedirectUris`.

When `AUTH_IDENTITY_ADAPTER=workos`, the app exposes `/auth/login`, `/auth/callback`, `/auth/logout`, and `/auth/me`. Browser sessions use a sealed, HTTP-only WorkOS session cookie. Agent requests without a valid WorkOS session or access token fail closed instead of receiving local grants.

The app also exposes sponsor-bound agent identity controls:

- `GET /api/agent-identities`
- `POST /api/agent-identities`
- `GET /api/agent-identities/:id`
- `POST /api/agent-identities/:id/renew`
- `POST /api/agent-identities/:id/revoke`
- `POST /api/agent-identities/:id/disable`
- `GET /api/agent-identities/:id/audit-events`
- `GET /api/agent-oauth-clients`
- `POST /api/agent-oauth-clients`
- `POST /api/agent-oauth-clients/:id/disable`

Admins can pass `all=1`, `sponsor`, `status`, `scope`, `expires_before`, and `last_used_after` to `GET /api/agent-identities` for audit filtering.

Public clients can authorize named agents with OAuth2-PKCE through `/oauth/authorize`, `/oauth/token`, and `/oauth/revoke`. `/oauth/authorize` requires `state` and `code_challenge_method=S256`. Non-local redirects must belong to an active registered OAuth client. Local loopback redirects are accepted for local fallback CLI development. Agent key ids identify lifecycle records; they are not bearer credentials.

When WorkOS is configured, agent token exchange, refresh, and access-token resolution revalidate the sponsor user and active organization membership through WorkOS before granting access. Sponsor removal or deactivation disables the related OBOU agent key and writes an `agent.disabled` audit event.

The Worker has a daily cron trigger for agent lifecycle maintenance. It expires active keys past `expiresAt`, emits `agent.expiry_warning` audit notification events at the configured warning thresholds, and revokes expired hashed refresh sessions as background cleanup.

In the WorkOS dashboard, configure:

- Redirect URI: `<app origin>/auth/callback`
- Sign-in endpoint: `<app origin>/auth/login`
- Sign-out redirect: `<app origin>/`

## Structure

```txt
apps/
  worker/
    src/server.ts
    src/server/agents/
    src/server/memory/
    src/server/routing/
    src/features/
    src/components/app/
packages/
  ui/
    src/components/ui/
    src/hooks/
    src/lib/
  evals/
    src/
docs/
  adr/
  brainstorms/
  rfcs/
```

## Architecture Notes

- Cloudflare Agent classes live in `apps/worker/src/server/agents`.
- The Worker entry stays thin at `apps/worker/src/server.ts`.
- Memory and routing primitives stay in `apps/worker/src/server`; `packages/evals` imports them through explicit Worker package exports.
- Coss UI primitives live in `packages/ui`; Teampitch-specific composition and icons stay in `apps/worker/src/components/app`.
- RFCs for larger product and architecture changes live in `docs/rfcs`.
