export interface ScheduledTaskMessage {
  type: "scheduled-task";
  description: string;
  timestamp: string;
}

export function createScheduledTaskMessage(
  description: string,
  now = new Date()
): ScheduledTaskMessage {
  return {
    type: "scheduled-task",
    description,
    timestamp: now.toISOString()
  };
}
