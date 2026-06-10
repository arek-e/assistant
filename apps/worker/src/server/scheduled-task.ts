export interface ScheduledTaskMessage {
  type: "scheduled-task";
  description: string;
  actor?: ScheduledTaskActor;
  timestamp: string;
}

export interface ScheduledTaskActor {
  subjectId: string;
  subjectType: string;
  provider: string;
  grants: Array<{ scope: string; scopeId: string }>;
}

interface ScheduledTaskPayload {
  description: string;
  actor?: ScheduledTaskActor;
}

export function encodeScheduledTaskPayload(
  description: string,
  actor?: ScheduledTaskActor
): string {
  return JSON.stringify({ description, actor } satisfies ScheduledTaskPayload);
}

export function createScheduledTaskMessage(
  payload: string,
  now = new Date()
): ScheduledTaskMessage {
  const taskPayload = decodeScheduledTaskPayload(payload);

  const message: ScheduledTaskMessage = {
    type: "scheduled-task",
    description: taskPayload.description,
    timestamp: now.toISOString()
  };

  if (taskPayload.actor) message.actor = taskPayload.actor;

  return message;
}

function decodeScheduledTaskPayload(payload: string): ScheduledTaskPayload {
  try {
    const parsed = JSON.parse(payload) as Partial<ScheduledTaskPayload>;
    if (typeof parsed.description === "string") {
      return {
        description: parsed.description,
        actor: isScheduledTaskActor(parsed.actor) ? parsed.actor : undefined
      };
    }
  } catch {
    // Legacy scheduled tasks stored the description directly.
  }

  return { description: payload };
}

function isScheduledTaskActor(value: unknown): value is ScheduledTaskActor {
  const actor = value as Partial<ScheduledTaskActor> | undefined;

  return (
    typeof actor?.subjectId === "string" &&
    typeof actor.subjectType === "string" &&
    typeof actor.provider === "string" &&
    Array.isArray(actor.grants)
  );
}
