import { getCookieValue } from "./workos-session";

export interface DemoAuthEnv {
  AUTH_DEMO_USERS_ENABLED?: string;
  AUTH_DEMO_ENVIRONMENT?: string;
  AUTH_DEMO_SESSION_COOKIE?: string;
  APP_ENV?: string;
  ENVIRONMENT?: string;
  NODE_ENV?: string;
  WORKOS_ENVIRONMENT?: string;
}

export interface AuthDemoUserSummary {
  id: string;
  label: string;
  description: string;
  role: string;
}

export interface DemoAuthUser extends AuthDemoUserSummary {
  subjectId: string;
  email: string;
  name: string;
  sessionId: string;
  organizationId: string;
  teamIds: readonly string[];
  permissions: readonly string[];
}

const demoSessionCookieName = "tp-demo-user";
const allowedDemoEnvironments = new Set([
  "dev",
  "development",
  "local",
  "localhost",
  "preview",
  "stage",
  "staging"
]);

const demoUsers = [
  {
    id: "admin",
    label: "Demo Admin",
    description: "Admin, org access",
    role: "admin",
    subjectId: "demo-admin",
    email: "admin@teampitch.dev",
    name: "Demo Admin",
    sessionId: "demo-session-admin",
    organizationId: "demo-org",
    teamIds: ["demo-finance-team", "demo-admins"],
    permissions: [
      "admin",
      "agent:admin",
      "memory:read",
      "memory:write",
      "memory:lifecycle",
      "routing:write",
      "tools:schedule"
    ]
  },
  {
    id: "member",
    label: "Demo Member",
    description: "Member, sponsor-only access",
    role: "member",
    subjectId: "demo-member",
    email: "member@teampitch.dev",
    name: "Demo Member",
    sessionId: "demo-session-member",
    organizationId: "demo-org",
    teamIds: ["demo-finance-team"],
    permissions: ["memory:read", "memory:write", "routing:write"]
  }
] as const satisfies readonly DemoAuthUser[];

export function isDemoAuthEnabled(env: DemoAuthEnv, request?: Request): boolean {
  const value = env.AUTH_DEMO_USERS_ENABLED?.toLowerCase();
  return (
    (value === "1" || value === "true" || value === "yes") && isDemoRuntimeAllowed(env, request)
  );
}

export function getDemoAuthCookieName(env: DemoAuthEnv): string {
  return env.AUTH_DEMO_SESSION_COOKIE ?? demoSessionCookieName;
}

export function listDemoAuthUsers(
  request: Request | undefined,
  env: DemoAuthEnv
): AuthDemoUserSummary[] {
  if (!isDemoAuthEnabled(env, request)) return [];

  return demoUsers.map(({ id, label, description, role }) => ({
    id,
    label,
    description,
    role
  }));
}

export function getDemoAuthUser(id: string | null): DemoAuthUser | null {
  if (!id) return null;
  return demoUsers.find((user) => user.id === id) ?? null;
}

export function getDemoAuthUserFromRequest(
  request: Request | undefined,
  env: DemoAuthEnv
): DemoAuthUser | null {
  if (!isDemoAuthEnabled(env, request)) return null;
  return getDemoAuthUser(getCookieValue(request, getDemoAuthCookieName(env)));
}

function isDemoRuntimeAllowed(env: DemoAuthEnv, request: Request | undefined): boolean {
  return isLocalRequest(request) || isAllowedDemoEnvironment(env);
}

function isLocalRequest(request: Request | undefined): boolean {
  if (!request) return false;

  const hostname = new URL(request.url).hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isAllowedDemoEnvironment(env: DemoAuthEnv): boolean {
  const candidates = [
    env.AUTH_DEMO_ENVIRONMENT,
    env.APP_ENV,
    env.ENVIRONMENT,
    env.NODE_ENV,
    env.WORKOS_ENVIRONMENT
  ];

  return candidates.some((candidate) =>
    allowedDemoEnvironments.has(candidate?.toLowerCase() ?? "")
  );
}
