import { routeAgentRequest } from "agents";

import { createAgentIdentityService } from "@/server/agent-identity/client";
import { AgentIdentityStoreDO } from "@/server/agent-identity/durable-object";
import {
  handleAgentIdentityRequest,
  type AgentIdentityRouteEnv
} from "@/server/agent-identity/routes";
import {
  handleAuthRequest,
  requireAuthenticatedAgentRequest,
  type WorkOSSessionEnv
} from "@/server/auth";
import { createWorkOSSponsorValidator } from "@/server/auth/workos-sponsor-validation";

export { ThinkAgent } from "@/server/agents/think-agent";
export { AgentIdentityStoreDO };

export default {
  async fetch(request: Request, env: Env) {
    return handleWorkerRequest(request, env);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledMaintenance(env));
  }
} satisfies ExportedHandler<Env>;

async function handleWorkerRequest(request: Request, env: Env): Promise<Response> {
  const authEnv = env as WorkOSSessionEnv & AgentIdentityRouteEnv;
  const response = await firstResponse([
    () => handleAgentIdentityRequest(request, authEnv),
    () => handleAuthRequest(request, authEnv),
    () => requireAuthenticatedAgentRequest(request, authEnv),
    () => routeAgentRequest(request, env)
  ]);
  return response ?? new Response("Not found", { status: 404 });
}

export async function handleScheduledMaintenance(env: Env): Promise<void> {
  const authEnv = env as WorkOSSessionEnv & AgentIdentityRouteEnv;
  const service = createAgentIdentityService(authEnv, undefined, {
    sponsorValidator: createWorkOSSponsorValidator(authEnv)
  });
  await service.runLifecycleMaintenance();
}

async function firstResponse(
  handlers: Array<() => Promise<Response | null>>
): Promise<Response | null> {
  for (const handler of handlers) {
    const response = await handler();
    if (response) return response;
  }
  return null;
}
