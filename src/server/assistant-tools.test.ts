import { describe, expect, test } from "bun:test";
import type { Schedule } from "agents";
import type { ToolSet } from "ai";
import {
  createAssistantTools,
  type AssistantToolContext
} from "./assistant-tools";

function createToolContext(overrides: Partial<AssistantToolContext> = {}) {
  const scheduled: Array<{
    input: string | number;
    callback: "executeTask";
    payload: string;
    options: { idempotent: boolean };
  }> = [];
  const cancelled: string[] = [];
  const schedules: Schedule<string>[] = [];

  const context: AssistantToolContext = {
    schedule(input, callback, payload, options) {
      scheduled.push({ input, callback, payload, options });
    },
    getSchedules() {
      return schedules;
    },
    cancelSchedule(taskId) {
      cancelled.push(taskId);
    },
    ...overrides
  };

  return { context, scheduled, cancelled, schedules };
}

function toolOptions<T extends (...args: never[]) => unknown>(
  _tool: T
): Parameters<T>[1] {
  return {} as Parameters<T>[1];
}

function scheduleTaskExecutor(context: AssistantToolContext) {
  const execute = createAssistantTools(context, {}).scheduleTask.execute;
  expect(execute).toBeDefined();
  if (!execute) throw new Error("scheduleTask tool is missing execute");
  return execute;
}

describe("createAssistantTools", () => {
  test("merges MCP tools with built-in assistant tools", () => {
    const { context } = createToolContext();
    const tools = createAssistantTools(context, {
      mcpSearch: {
        description: "Search MCP",
        inputSchema: {},
        execute: () => "mcp"
      }
    } as unknown as ToolSet);

    expect(Object.keys(tools)).toContain("mcpSearch");
    expect(Object.keys(tools)).toContain("calculate");
    expect(Object.keys(tools)).toContain("scheduleTask");
  });

  test("calculates arithmetic and rejects division by zero", async () => {
    const { context } = createToolContext();
    const tools = createAssistantTools(context, {});
    const execute = tools.calculate.execute;
    expect(execute).toBeDefined();
    if (!execute) throw new Error("calculate tool is missing execute");

    await expect(
      execute({ a: 6, b: 7, operator: "*" }, toolOptions(execute))
    ).resolves.toEqual({
      expression: "6 * 7",
      result: 42
    });

    await expect(
      execute({ a: 6, b: 0, operator: "/" }, toolOptions(execute))
    ).resolves.toEqual({
      error: "Division by zero"
    });
  });

  test("requires approval for large calculations", async () => {
    const { context } = createToolContext();
    const tools = createAssistantTools(context, {});
    const needsApproval = tools.calculate.needsApproval;
    expect(typeof needsApproval).toBe("function");
    if (typeof needsApproval !== "function") {
      throw new Error("calculate tool is missing needsApproval");
    }

    await expect(
      needsApproval(
        { a: 1001, b: 1, operator: "+" },
        toolOptions(needsApproval)
      )
    ).resolves.toBe(true);
    await expect(
      needsApproval(
        { a: 1000, b: 1, operator: "+" },
        toolOptions(needsApproval)
      )
    ).resolves.toBe(false);
  });

  test("schedules delayed tasks through the provided context", async () => {
    const { context, scheduled } = createToolContext();
    const execute = scheduleTaskExecutor(context);

    await expect(
      execute(
        {
          description: "check the build",
          when: { type: "delayed", delayInSeconds: 60 }
        },
        toolOptions(execute)
      )
    ).resolves.toBe('Task scheduled: "check the build" (delayed: 60)');

    expect(scheduled).toEqual([
      {
        input: 60,
        callback: "executeTask",
        payload: "check the build",
        options: { idempotent: true }
      }
    ]);
  });

  test("rejects invalid schedule input without calling the context", async () => {
    const { context, scheduled } = createToolContext();
    const execute = scheduleTaskExecutor(context);

    await expect(
      execute(
        {
          description: "invalid",
          when: { type: "no-schedule" }
        },
        toolOptions(execute)
      )
    ).resolves.toBe("Not a valid schedule input");

    expect(scheduled).toEqual([]);
  });

  test("lists and cancels scheduled tasks through the provided context", async () => {
    const { context, cancelled, schedules } = createToolContext();
    const tools = createAssistantTools(context, {});
    schedules.push({ id: "task-1", payload: "hello" } as Schedule<string>);
    const listTasks = tools.getScheduledTasks.execute;
    const cancelTask = tools.cancelScheduledTask.execute;
    expect(listTasks).toBeDefined();
    expect(cancelTask).toBeDefined();
    if (!listTasks || !cancelTask) {
      throw new Error("scheduled task tools are missing execute");
    }

    await expect(listTasks({}, toolOptions(listTasks))).resolves.toEqual(
      schedules
    );
    await expect(
      cancelTask({ taskId: "task-1" }, toolOptions(cancelTask))
    ).resolves.toBe("Task task-1 cancelled.");

    expect(cancelled).toEqual(["task-1"]);
  });
});
