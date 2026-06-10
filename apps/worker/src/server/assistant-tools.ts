import type { Schedule } from "agents";
import { scheduleSchema } from "agents/schedule";
import { tool, type ToolSet } from "ai";
import { Effect, Schema } from "effect";

import { getDemoWeather } from "@/effects";
import type { MemoryAccessContext } from "@/server/memory";
import { encodeScheduledTaskPayload } from "@/server/scheduled-task";

import { effectInputSchema } from "./effect-schema";

const weatherInputSchema = effectInputSchema(
  Schema.Struct({
    city: Schema.String.annotations({
      description: "City name"
    })
  })
);

const emptyInputSchema = effectInputSchema(Schema.Struct({}));

const calculateInputSchema = effectInputSchema(
  Schema.Struct({
    a: Schema.Number.annotations({
      description: "First number"
    }),
    b: Schema.Number.annotations({
      description: "Second number"
    }),
    operator: Schema.Literal("+", "-", "*", "/", "%").annotations({
      description: "Arithmetic operator"
    })
  })
);

const cancelScheduledTaskInputSchema = effectInputSchema(
  Schema.Struct({
    taskId: Schema.String.annotations({
      description: "The ID of the task to cancel"
    })
  })
);

export interface AssistantToolContext {
  schedule(
    input: string | number,
    callback: "executeTask",
    payload: string,
    options: { idempotent: boolean }
  ): void;
  getSchedules(): Schedule<string>[];
  cancelSchedule(taskId: string): void;
  getIdentity?(): Promise<MemoryAccessContext>;
}

export function createAssistantTools(context: AssistantToolContext, mcpTools: ToolSet) {
  return {
    ...mcpTools,

    getWeather: tool({
      description: "Get the current weather for a city",
      inputSchema: weatherInputSchema,
      execute: async ({ city }) => {
        return Effect.runPromise(getDemoWeather(city));
      }
    }),

    getUserTimezone: tool({
      description:
        "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
      inputSchema: emptyInputSchema
    }),

    calculate: tool({
      description:
        "Perform a math calculation with two numbers. Requires user approval for large numbers.",
      inputSchema: calculateInputSchema,
      needsApproval: async ({ a, b }) => Math.abs(a) > 1000 || Math.abs(b) > 1000,
      execute: async ({ a, b, operator }) => {
        const ops: Record<string, (x: number, y: number) => number> = {
          "+": (x, y) => x + y,
          "-": (x, y) => x - y,
          "*": (x, y) => x * y,
          "/": (x, y) => x / y,
          "%": (x, y) => x % y
        };
        if (operator === "/" && b === 0) {
          return { error: "Division by zero" };
        }
        return {
          expression: `${a} ${operator} ${b}`,
          result: ops[operator](a, b)
        };
      }
    }),

    scheduleTask: tool({
      description:
        "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
      inputSchema: scheduleSchema,
      execute: async ({ when, description }) => {
        if (when.type === "no-schedule") {
          return "Not a valid schedule input";
        }
        const input =
          when.type === "scheduled"
            ? when.date
            : when.type === "delayed"
              ? when.delayInSeconds
              : when.type === "cron"
                ? when.cron
                : null;
        if (!input) return "Invalid schedule type";
        try {
          const identity = context.getIdentity
            ? summarizeIdentity(await context.getIdentity())
            : undefined;
          context.schedule(
            input,
            "executeTask",
            encodeScheduledTaskPayload(description, identity),
            {
              idempotent: true
            }
          );
          return `Task scheduled: "${description}" (${when.type}: ${input})`;
        } catch (error) {
          return `Error scheduling task: ${error}`;
        }
      }
    }),

    getScheduledTasks: tool({
      description: "List all tasks that have been scheduled",
      inputSchema: emptyInputSchema,
      execute: async () => {
        const tasks = context.getSchedules();
        return tasks.length > 0 ? tasks : "No scheduled tasks found.";
      }
    }),

    cancelScheduledTask: tool({
      description: "Cancel a scheduled task by its ID",
      inputSchema: cancelScheduledTaskInputSchema,
      execute: async ({ taskId }) => {
        try {
          context.cancelSchedule(taskId);
          return `Task ${taskId} cancelled.`;
        } catch (error) {
          return `Error cancelling task: ${error}`;
        }
      }
    })
  };
}

function summarizeIdentity(accessContext: MemoryAccessContext) {
  return {
    subjectId: accessContext.subjectId,
    subjectType: accessContext.subjectType,
    provider: accessContext.provider,
    grants: accessContext.grants.map((grant) => ({ ...grant }))
  };
}
