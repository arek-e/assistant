import type { AgentSponsorValidator } from "../agent-identity/service";
import {
  createWorkOSClient,
  isWorkOSAuthConfigured,
  isWorkOSMode,
  type WorkOSSessionEnv
} from "./workos-session";

interface WorkOSOrganizationMembership {
  organizationId: string;
  status: string;
  userId: string;
}

interface WorkOSMembershipList {
  data: readonly WorkOSOrganizationMembership[];
}

export interface WorkOSUserManagementSponsorClient {
  getUser(userId: string): Promise<unknown>;
  listOrganizationMemberships(options: {
    organizationId: string;
    userId: string;
    statuses: ["active"];
    limit?: number;
  }): Promise<WorkOSMembershipList>;
}

export function createWorkOSSponsorValidator(
  env: WorkOSSessionEnv
): AgentSponsorValidator | undefined {
  if (!isWorkOSMode(env) || !isWorkOSAuthConfigured(env)) return undefined;

  return createWorkOSSponsorValidatorFromUserManagement(createWorkOSClient(env).userManagement);
}

export function createWorkOSSponsorValidatorFromUserManagement(
  userManagement: WorkOSUserManagementSponsorClient
): AgentSponsorValidator {
  return async ({ identity }) => {
    if (identity.createdByActor.provider !== "workos") return { valid: true };

    try {
      await userManagement.getUser(identity.sponsorSubjectId);
    } catch (caught) {
      if (isNotFound(caught)) {
        return { valid: false, reason: "sponsor_user_not_found" };
      }
      throw caught;
    }

    try {
      const memberships = await userManagement.listOrganizationMemberships({
        organizationId: identity.organizationId,
        userId: identity.sponsorSubjectId,
        statuses: ["active"],
        limit: 10
      });
      const active = memberships.data.some(
        (membership) =>
          membership.status === "active" &&
          membership.organizationId === identity.organizationId &&
          membership.userId === identity.sponsorSubjectId
      );

      return active ? { valid: true } : { valid: false, reason: "sponsor_org_membership_inactive" };
    } catch (caught) {
      if (isNotFound(caught)) {
        return { valid: false, reason: "sponsor_org_membership_inactive" };
      }
      throw caught;
    }
  };
}

function isNotFound(caught: unknown): boolean {
  const error = caught as
    | {
        status?: unknown;
        statusCode?: unknown;
        response?: { status?: unknown };
      }
    | undefined;
  return error?.status === 404 || error?.statusCode === 404 || error?.response?.status === 404;
}
