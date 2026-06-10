---
status: accepted
---

# Use WorkOS for auth identity

We will use WorkOS as the auth identity provider because the assistant's memory direction depends on organization membership, RBAC, enterprise SSO, Directory Sync, and audit-heavy access decisions. The first real Auth Identity Adapter should integrate with WorkOS, while memory code depends on a provider-neutral memory access context rather than WorkOS SDK objects, so the Canonical Memory Store remains decoupled from the auth provider.

## Next Slice: WorkOS Auth Slice

PR2 should make scope ownership real before we add vector projections, richer memory management UI, or standalone agent identity. PR #6 gave the app scoped memory, access context, provenance, and blocked candidates, but the access context is still local and static. The next implementation slice should replace that static context with a provider-neutral actor identity seam.

Working title:

`WorkOS Auth Slice: real memory grants and actor-aware provenance`

The core abstraction should be an `AuthIdentityAdapter` that returns an `AuthIdentityContext`, not WorkOS SDK objects. The context should include:

- `subjectId`
- `subjectType: "user" | "agent"`
- accessible private, team, org, and session grants
- optional actor context for attribution

The WorkOS implementation should sit behind configuration. The app must still run without WorkOS credentials, and the local fallback adapter should remain the default for development and tests. WorkOS environment variables should be documented when the implementation is added.

PR2 must wire ThinkAgent memory access through the adapter for:

- `searchMemory`
- `recordMemory`
- `recordDecision`
- `promoteRecord`
- `routeTask`
- memory debugger snapshots

PR2 should also enforce grants on memory writes, not only reads. A caller should not be able to write an arbitrary `scopeId` just because the tool input includes it.

Route records, memory writes, and debug snapshots should carry the current subject and grants so audit/provenance can distinguish which authenticated actor produced them. The debug drawer should show the current subject and grants, but this remains a dev/audit surface rather than normal user-facing UI.

Required tests:

- default local/test path works without WorkOS credentials
- mocked WorkOS identity builds the expected grants
- inaccessible writes are blocked instead of persisted
- retrieval provenance includes the resolved subject
- optional WorkOS E2E runs only when WorkOS environment variables exist

## Follow-On Slice: Agent Identity

PR2 should not try to deliver the full Ramp-style agent identity model. It should create the actor-aware seam so the later OBOU work does not require reworking memory access.

Defer these to PR3 or later:

- Agent Key table/model
- OAuth2-PKCE authorization-code flow
- access token and refresh token lifecycle
- agent key expiration, renewal, and revocation notifications
- admin UI for viewing or revoking agent keys

The likely PR3 title is:

`Agent Identity Slice: sponsor-bound agent keys and OBOU auth flow`
