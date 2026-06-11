import { describe, expect, test } from "bun:test";

import type { AgentIdentity, AgentKey } from "../agent-identity/types";
import {
  createWorkOSSponsorValidator,
  createWorkOSSponsorValidatorFromUserManagement,
  type WorkOSUserManagementSponsorClient
} from "./workos-sponsor-validation";

describe("WorkOS sponsor validation", () => {
  test("is disabled when WorkOS credentials are absent", () => {
    expect(createWorkOSSponsorValidator({ AUTH_IDENTITY_ADAPTER: "workos" })).toBeUndefined();
  });

  test("requires an active sponsor organization membership", async () => {
    const validator = createWorkOSSponsorValidatorFromUserManagement(
      fakeUserManagement({
        memberships: [
          {
            organizationId: "org_123",
            status: "active",
            userId: "user_123"
          }
        ]
      })
    );

    await expect(validator({ identity: testIdentity(), key: testKey() })).resolves.toEqual({
      valid: true
    });
  });

  test("rejects inactive sponsor organization membership", async () => {
    const validator = createWorkOSSponsorValidatorFromUserManagement(
      fakeUserManagement({
        memberships: [
          {
            organizationId: "org_123",
            status: "inactive",
            userId: "user_123"
          }
        ]
      })
    );

    await expect(validator({ identity: testIdentity(), key: testKey() })).resolves.toEqual({
      valid: false,
      reason: "sponsor_org_membership_inactive"
    });
  });
});

function fakeUserManagement({
  memberships,
  userMissing = false
}: {
  memberships: Array<{
    organizationId: string;
    status: string;
    userId: string;
  }>;
  userMissing?: boolean;
}): WorkOSUserManagementSponsorClient {
  return {
    async getUser() {
      if (userMissing) throw { status: 404 };
      return { id: "user_123" };
    },
    async listOrganizationMemberships() {
      return { data: memberships };
    }
  };
}

function testIdentity(): AgentIdentity {
  return {
    id: "agent_123",
    organizationId: "org_123",
    sponsorSubjectId: "user_123",
    sponsorDisplayName: "Sarah",
    name: "Codex",
    description: "",
    actingMode: "obou",
    status: "active",
    allowedScopes: [{ scope: "org", scopeId: "org_123" }],
    allowedCapabilities: ["memory:read"],
    expiresAt: "2026-07-10T00:00:00.000Z",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    createdByActor: {
      actorType: "user",
      displayName: "Sarah",
      provider: "workos",
      organizationId: "org_123",
      sessionId: "session_123",
      sponsor: {
        subjectId: "user_123",
        displayName: "Sarah",
        role: "member",
        permissions: ["memory:read"]
      },
      grants: [{ scope: "org", scopeId: "org_123" }]
    }
  };
}

function testKey(): AgentKey {
  return {
    id: "ak_123",
    agentIdentityId: "agent_123",
    status: "active",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    expiresAt: "2026-07-10T00:00:00.000Z",
    sessionVersion: 1
  };
}
