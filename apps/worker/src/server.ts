import { routeAgentRequest } from "agents";
import {
  handleAuthRequest,
  requireAuthenticatedAgentRequest,
  type WorkOSSessionEnv
} from "@/server/auth";
export { ThinkAgent } from "@/server/agents/think-agent";

export default {
  async fetch(request: Request, env: Env) {
    const authEnv = env as WorkOSSessionEnv;
    const authResponse = await handleAuthRequest(request, authEnv);
    if (authResponse) return authResponse;

    const agentAuthResponse = await requireAuthenticatedAgentRequest(
      request,
      authEnv
    );
    if (agentAuthResponse) return agentAuthResponse;

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
