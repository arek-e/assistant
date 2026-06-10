import type { MemoryRecord } from "./types";

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

export interface RetrievalHit {
  record: MemoryRecord;
  score: number;
  reasons: string[];
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  lifecycleViolations: string[];
  blockedRecordIds: string[];
}

export interface SearchMemoryOptions {
  limit?: number;
  includeBlocked?: boolean;
}

export function searchMemoryRecords(
  records: readonly MemoryRecord[],
  input: string,
  options: SearchMemoryOptions = {}
): RetrievalResult {
  const inputTokens = memorySearchTokens(input);
  const scoredHits = records
    .map((record) => scoreMemoryRecord(record, inputTokens))
    .filter((hit) => hit.score > 0);
  const hits = scoredHits
    .filter((hit) => options.includeBlocked || !isBlockedLifecycle(hit.record))
    .sort(compareHits)
    .slice(0, options.limit ?? 5);
  const lifecycleViolations = hits
    .filter((hit) => isBlockedLifecycle(hit.record))
    .map((hit) => hit.record.id);
  const blockedRecordIds = scoredHits
    .filter((hit) => isBlockedLifecycle(hit.record))
    .map((hit) => hit.record.id);

  return { hits, lifecycleViolations, blockedRecordIds };
}

export function isBlockedLifecycle(record: MemoryRecord) {
  return record.status === "rejected" || record.status === "superseded";
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_./:-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function memorySearchTokens(value: string) {
  return [...new Set(tokenize(value))];
}

export function scoreMemoryRecord(
  record: MemoryRecord,
  inputTokens: string[]
): RetrievalHit {
  const recordText = searchableText(record).toLowerCase();
  const recordTokens = new Set(memorySearchTokens(recordText));
  const tokenScores = inputTokens.map((token) =>
    scoreToken(record, recordText, recordTokens, token)
  );
  const baseScore = tokenScores.reduce((sum, item) => sum + item.score, 0);
  const statusScore = scoreStatus(record, baseScore);

  return {
    record,
    score: baseScore + statusScore.score,
    reasons: [
      ...tokenScores.flatMap((item) => item.reasons),
      ...statusScore.reasons
    ]
  };
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

function compareHits(left: RetrievalHit, right: RetrievalHit) {
  if (right.score !== left.score) return right.score - left.score;
  return left.record.id.localeCompare(right.record.id);
}
