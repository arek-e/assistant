import type {
  ExpectedWriteKind,
  ExpectedWriteStatus,
  MemoryRecord,
  MemoryWriteDecision,
  RetrievalHit,
  RetrievalResult,
  RouteDecision
} from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "did",
  "do",
  "does",
  "for",
  "from",
  "has",
  "have",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "this",
  "to",
  "we",
  "what",
  "when",
  "which",
  "with"
]);

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

const PREFERENCE_MARKERS = ["i prefer", "my preference", "always use"];
const DECISION_MARKERS = ["we chose", "we decided", "lets use", "let's use"];
const IMPLEMENTATION_MARKERS = ["implemented", "shipped", "deployed"];

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_./:-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function uniqueTokens(value: string) {
  return [...new Set(tokenize(value))];
}

function searchableText(record: MemoryRecord) {
  return [
    record.id,
    record.kind,
    record.scope,
    record.status,
    record.title,
    record.body,
    record.evidence,
    record.rationale,
    record.reEvalTrigger,
    ...record.consumerRules,
    ...record.tags,
    ...record.supersedes
  ].join(" ");
}

function scoreRecord(record: MemoryRecord, inputTokens: string[]) {
  const recordText = searchableText(record).toLowerCase();
  const recordTokens = new Set(uniqueTokens(recordText));
  const tokenScores = inputTokens.map((token) =>
    scoreToken(record, recordText, recordTokens, token)
  );
  const baseScore = tokenScores.reduce((sum, item) => sum + item.score, 0);
  const statusScore = scoreStatus(record, baseScore);

  return {
    score: baseScore + statusScore.score,
    reasons: [
      ...tokenScores.flatMap((item) => item.reasons),
      ...statusScore.reasons
    ]
  };
}

function scoreToken(
  record: MemoryRecord,
  recordText: string,
  recordTokens: Set<string>,
  token: string
) {
  if (record.tags.includes(token)) {
    return { score: 5, reasons: [`tag:${token}`] };
  }

  if (recordTokens.has(token)) {
    return { score: 3, reasons: [`token:${token}`] };
  }

  if (recordText.includes(token)) {
    return { score: 1, reasons: [`substring:${token}`] };
  }

  return { score: 0, reasons: [] };
}

function scoreStatus(record: MemoryRecord, baseScore: number) {
  if (baseScore === 0) {
    return { score: 0, reasons: [] };
  }

  if (record.status === "active") {
    return { score: 1, reasons: ["status:active"] };
  }

  if (record.status === "proposed") {
    return { score: 0.5, reasons: ["status:proposed"] };
  }

  return { score: 0, reasons: [] };
}

export function retrieveRecords(
  records: readonly MemoryRecord[],
  input: string,
  limit = 5
): RetrievalResult {
  const inputTokens = uniqueTokens(input);
  const hits: RetrievalHit[] = records
    .map((record) => {
      const result = scoreRecord(record, inputTokens);
      return {
        record,
        score: result.score,
        reasons: result.reasons
      };
    })
    .filter((hit) => hit.score > 0)
    .filter((hit) => {
      const blocked =
        hit.record.status === "rejected" || hit.record.status === "superseded";

      return !blocked;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.record.id.localeCompare(right.record.id);
    })
    .slice(0, limit);

  const lifecycleViolations = hits
    .filter(
      (hit) =>
        hit.record.status === "rejected" || hit.record.status === "superseded"
    )
    .map((hit) => hit.record.id);

  return { hits, lifecycleViolations };
}

export function proposeMemoryWrite(input: string): MemoryWriteDecision {
  const lowerInput = input.toLowerCase();

  if (input.trim().length < 24) {
    return noWrite("input is too small to justify durable memory");
  }

  if (includesAny(lowerInput, PREFERENCE_MARKERS)) {
    return writeDecision(
      "preference_record",
      "active",
      "explicit user preference",
      true
    );
  }

  if (includesAny(lowerInput, DECISION_MARKERS)) {
    return decisionRecordWrite(lowerInput);
  }

  return noWrite("no durable preference, decision, term, or lesson detected");
}

function decisionRecordWrite(input: string): MemoryWriteDecision {
  const implemented = includesAny(input, IMPLEMENTATION_MARKERS);
  if (implemented) {
    return writeDecision(
      "decision_record",
      "active",
      "decision includes implementation evidence",
      true
    );
  }

  return writeDecision(
    "decision_record",
    "proposed",
    "decision intent needs implementation evidence before active status",
    true
  );
}

function includesAny(value: string, markers: readonly string[]) {
  return markers.some((marker) => value.includes(marker));
}

export function routeTask(
  input: string,
  retrievalResult: RetrievalResult
): RouteDecision {
  const tokens = new Set(uniqueTokens(input));
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

function noWrite(reason: string): MemoryWriteDecision {
  return {
    shouldWrite: false,
    kind: "none",
    status: "none",
    reason,
    hasEvidence: false
  };
}

function writeDecision(
  kind: ExpectedWriteKind,
  status: ExpectedWriteStatus,
  reason: string,
  hasEvidence: boolean
): MemoryWriteDecision {
  return {
    shouldWrite: true,
    kind,
    status,
    reason,
    hasEvidence
  };
}
