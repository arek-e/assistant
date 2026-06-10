---
status: accepted
---

# Use WorkOS for auth identity

We will use WorkOS as the auth identity provider because the assistant's memory direction depends on organization membership, RBAC, enterprise SSO, Directory Sync, and audit-heavy access decisions. The first real Auth Identity Adapter should integrate with WorkOS, while memory code depends on a provider-neutral memory access context rather than WorkOS SDK objects, so the Canonical Memory Store remains decoupled from the auth provider.
