import type { RetrievalResult } from "../memory/retrieval";

export type RouteMode = "none" | "direct" | "agent" | "sub_agent" | "workflow";
export type RouteEffort = "none" | "low" | "medium" | "high";
export type RouteBudget = "none" | "small" | "standard" | "extended";

export interface RouteDecision {
  mode: RouteMode;
  effort: RouteEffort;
  budget: RouteBudget;
  requiresApproval: boolean;
  reason: string;
}

const ANSWER_WORDS = new Set([
  "mean",
  "remember",
  "chose",
  "choose",
  "current",
  "preferred",
  "preference",
  "starting",
  "started",
  "using"
]);

const TOOL_TASK_WORDS = new Set([
  "build",
  "change",
  "code",
  "create",
  "deploy",
  "fix",
  "implement",
  "repo",
  "run",
  "test",
  "wire"
]);

export function routeTask(input: string, retrievalResult: RetrievalResult): RouteDecision {
  const tokens = new Set(tokenize(input));
  const hasToolWord = [...tokens].some((token) => TOOL_TASK_WORDS.has(token));
  const hasAnswerWord = [...tokens].some((token) => ANSWER_WORDS.has(token));

  if (hasToolWord) {
    return {
      mode: "agent",
      effort: "medium",
      budget: "standard",
      requiresApproval: false,
      reason: "task asks for repo or tool execution"
    };
  }

  if (retrievalResult.hits.length > 0 && hasAnswerWord) {
    return {
      mode: "direct",
      effort: "low",
      budget: "small",
      requiresApproval: false,
      reason: "active memory has enough evidence for a direct answer"
    };
  }

  return {
    mode: "direct",
    effort: "medium",
    budget: "standard",
    requiresApproval: false,
    reason: "default route for low-risk ambiguous input"
  };
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_./:-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}
