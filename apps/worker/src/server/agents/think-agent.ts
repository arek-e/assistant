import { Think, type Session } from "@cloudflare/think";
import { createWorkersAI } from "workers-ai-provider";
import { callable, type Schedule } from "agents";
import type { ToolSet } from "ai";
import { getAssistantSystemPrompt } from "@/server/assistant-prompt";
import { createAssistantTools } from "@/server/assistant-tools";
import { createScheduledTaskMessage } from "@/server/scheduled-task";
import {
  createMemoryPrimitiveTools,
  SqliteCanonicalMemoryStore
} from "@/server/memory";

export class ThinkAgent extends Think<Env> {
  maxSteps = 6;
  private memoryStore?: SqliteCanonicalMemoryStore;

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
- Keep planned choices as proposed until implementation evidence exists.
- Treat rejected and superseded records as history, not current truth.
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
      ...createAssistantTools(this, {}),
      ...createMemoryPrimitiveTools(this.getMemoryStore())
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

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}`);

    this.broadcast(JSON.stringify(createScheduledTaskMessage(description)));
  }

  private getMemoryStore() {
    this.memoryStore ??= new SqliteCanonicalMemoryStore(this.ctx.storage.sql);
    return this.memoryStore;
  }
}
