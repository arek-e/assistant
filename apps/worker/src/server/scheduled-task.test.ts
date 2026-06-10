import { describe, expect, test } from "bun:test";
import {
  createScheduledTaskMessage,
  encodeScheduledTaskPayload
} from "./scheduled-task";

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

  test("preserves actor metadata from encoded payloads", () => {
    const payload = encodeScheduledTaskPayload("write the status update", {
      subjectId: "user-123",
      subjectType: "user",
      provider: "workos",
      grants: [{ scope: "private", scopeId: "user-123" }]
    });

    expect(
      createScheduledTaskMessage(payload, new Date("2026-06-10T12:00:00.000Z"))
    ).toEqual({
      type: "scheduled-task",
      description: "write the status update",
      actor: {
        subjectId: "user-123",
        subjectType: "user",
        provider: "workos",
        grants: [{ scope: "private", scopeId: "user-123" }]
      },
      timestamp: "2026-06-10T12:00:00.000Z"
    });
  });
});
