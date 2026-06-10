import { Think, type Session } from "@cloudflare/think";
import { createWorkersAI } from "workers-ai-provider";
import { callable, getCurrentAgent, type Schedule } from "agents";
import type { ToolSet } from "ai";
import {
  createAuthIdentityAdapter,
  type AuthIdentityAdapter,
  type AuthIdentityEnv
} from "@/server/auth/identity";
import { getAssistantSystemPrompt } from "@/server/assistant-prompt";
import {
  createAssistantTools,
  type AssistantToolContext
} from "@/server/assistant-tools";
import { createScheduledTaskMessage } from "@/server/scheduled-task";
import {
  createMemoryPrimitiveTools,
  SqliteCanonicalMemoryStore
} from "@/server/memory";
import type {
  CanonicalMemoryStore,
  MemoryAccessContext
} from "@/server/memory";

export class ThinkAgent extends Think<Env> {
  maxSteps = 6;
  private memoryStore?: CanonicalMemoryStore;
  private authIdentityAdapter?: AuthIdentityAdapter;

  getModel() {
    return createWorkersAI({ binding: this.env.AI })(
      "@cf/moonshotai/kimi-k2.6"
    );
  }

  getSystemPrompt() {
    return `${getAssistantSystemPrompt()}

You are running inside the Think prototype. Use the primitive memory tools for durable project terms, preferences, decisions, lifecycle transitions, and routing audits.

Memory rules:
- Search memory before answering questions about prior project choices.
- Save only durable facts, preferences, decisions, terms, or lessons with evidence.
- Use private, team, org, or session scope deliberately, with the matching scope id.
- Keep planned choices as proposed until implementation evidence exists.
- Treat draft, proposed, rejected, superseded, and redacted records as history or workflow state, not current truth.
- Use routeTask when a task needs an auditable Effort Router decision.`;
  }

  configureSession(session: Session) {
    return session
      .withContext("soul", {
        provider: { get: async () => this.getSystemPrompt() }
      })
      .withContext("memory", {
        description:
          "Writable Think memory for durable user preferences, project decisions, and relevant facts.",
        maxTokens: 2000
      })
      .withCachedPrompt();
  }

  getTools(): ToolSet {
    return {
      ...createAssistantTools(this.getAssistantToolContext(), {}),
      ...createMemoryPrimitiveTools(this.getMemoryStore(), () =>
        this.getAuthIdentity()
      )
    };
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  @callable()
  async getMemoryDebugSnapshot() {
    return this.getMemoryStore().debugSnapshot(
      50,
      await this.getAuthIdentity()
    );
  }

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}`);

    this.broadcast(JSON.stringify(createScheduledTaskMessage(description)));
  }

  private getMemoryStore(): CanonicalMemoryStore {
    this.memoryStore ??= new SqliteCanonicalMemoryStore(this.ctx.storage.sql);
    return this.memoryStore;
  }

  private getAssistantToolContext(): AssistantToolContext {
    return {
      schedule: this.schedule.bind(this),
      getSchedules: this.getSchedules.bind(this),
      cancelSchedule: this.cancelSchedule.bind(this),
      getIdentity: () => this.getAuthIdentity()
    };
  }

  private getAuthIdentityAdapter(): AuthIdentityAdapter {
    this.authIdentityAdapter ??= createAuthIdentityAdapter(
      this.env as Env & AuthIdentityEnv
    );
    return this.authIdentityAdapter;
  }

  private async getAuthIdentity(): Promise<MemoryAccessContext> {
    return this.getAuthIdentityAdapter().resolve({
      env: this.env as Env & AuthIdentityEnv,
      request: getCurrentAgent().request,
      sessionId: this.name
    });
  }
}
