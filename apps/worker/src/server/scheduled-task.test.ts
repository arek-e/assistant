import { describe, expect, test } from "bun:test";
import { createScheduledTaskMessage } from "./scheduled-task";

describe("scheduled task messages", () => {
  test("creates the websocket payload broadcast by ThinkAgent.executeTask", () => {
    expect(
      createScheduledTaskMessage(
        "write the status update",
        new Date("2026-06-10T12:00:00.000Z")
      )
    ).toEqual({
      type: "scheduled-task",
      description: "write the status update",
      timestamp: "2026-06-10T12:00:00.000Z"
    });
  });
});
