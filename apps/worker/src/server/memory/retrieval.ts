import {
  canAccessMemoryRecord,
  scopePrecedence,
  type MemoryAccessContext
} from "./access";
import { hashStableValue } from "./hash";
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
  blockedRecords: BlockedMemoryRecord[];
  provenance: RetrievalProvenance;
}

export type BlockedMemoryReason = "access" | "lifecycle" | "precedence";

export interface BlockedMemoryRecord {
  id: string;
  reason: BlockedMemoryReason;
  scope: MemoryRecord["scope"];
  scopeId: string;
  status: MemoryRecord["status"];
  title: string;
  recordHash: string;
}

export interface RetrievalRecordProvenance {
  id: string;
  scope: MemoryRecord["scope"];
  scopeId: string;
  status: MemoryRecord["status"];
  contentHash: string;
  recordHash: string;
}

export interface RetrievalScopeRoot {
  scope: MemoryRecord["scope"];
  scopeId: string;
  root: string;
  recordIds: string[];
}

export interface RetrievalProvenance {
  subjectId: string;
  projectionVersion: string;
  scopeRoots: RetrievalScopeRoot[];
  records: RetrievalRecordProvenance[];
}

export interface SearchMemoryOptions {
  limit?: number;
  includeBlocked?: boolean;
}

export function searchMemoryRecords(
  records: readonly MemoryRecord[],
  input: string,
  accessContext: MemoryAccessContext,
  options: SearchMemoryOptions = {}
): RetrievalResult {
  const inputTokens = memorySearchTokens(input);
  const scoredHits = records
    .map((record) => scoreMemoryRecord(record, inputTokens))
    .filter((hit) => hit.score > 0);

  return finalizeMemorySearch(scoredHits, records, accessContext, options);
}

export function finalizeMemorySearch(
  candidates: readonly RetrievalHit[],
  records: readonly MemoryRecord[],
  accessContext: MemoryAccessContext,
  options: SearchMemoryOptions = {}
): RetrievalResult {
  const sortedHits = combineHits(candidates).sort(compareHits);
  const activeAccessibleCandidates = sortedHits.filter(
    (hit) =>
      canAccessMemoryRecord(hit.record, accessContext) &&
      !isBlockedLifecycle(hit.record)
  );
  const blockedRecords: BlockedMemoryRecord[] = [];
  const hits: RetrievalHit[] = [];

  sortedHits.forEach((hit) => {
    const blockedReason = getBlockedReason(
      hit.record,
      accessContext,
      activeAccessibleCandidates
    );

    if (blockedReason) {
      blockedRecords.push(toBlockedMemoryRecord(hit.record, blockedReason));
    }

    if (
      hits.length < (options.limit ?? 5) &&
      (!blockedReason || (options.includeBlocked && blockedReason !== "access"))
    ) {
      hits.push(hit);
    }
  });

  const lifecycleViolations = hits
    .filter((hit) => isBlockedLifecycle(hit.record))
    .map((hit) => hit.record.id);
  const blockedRecordIds = [
    ...new Set(blockedRecords.map((record) => record.id))
  ];

  return {
    hits,
    lifecycleViolations,
    blockedRecordIds,
    blockedRecords: dedupeBlockedRecords(blockedRecords),
    provenance: createRetrievalProvenance(hits, records, accessContext)
  };
}

function isBlockedLifecycle(record: MemoryRecord) {
  return record.status !== "active";
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
    record.scopeId,
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
  const scopeDelta =
    scopePrecedence(right.record.scope) - scopePrecedence(left.record.scope);
  if (scopeDelta !== 0) return scopeDelta;
  return left.record.id.localeCompare(right.record.id);
}

function combineHits(candidates: readonly RetrievalHit[]): RetrievalHit[] {
  const byId = new Map<string, RetrievalHit>();

  candidates.forEach((candidate) => {
    const existing = byId.get(candidate.record.id);
    if (!existing) {
      byId.set(candidate.record.id, {
        ...candidate,
        reasons: [...candidate.reasons]
      });
      return;
    }

    existing.score = Math.max(existing.score, candidate.score);
    existing.reasons = [
      ...new Set([...existing.reasons, ...candidate.reasons])
    ];
  });

  return [...byId.values()];
}

function getBlockedReason(
  record: MemoryRecord,
  accessContext: MemoryAccessContext,
  activeAccessibleCandidates: readonly RetrievalHit[]
): BlockedMemoryReason | null {
  if (!canAccessMemoryRecord(record, accessContext)) return "access";
  if (isBlockedLifecycle(record)) return "lifecycle";
  if (isPrecedenceBlocked(record, activeAccessibleCandidates)) {
    return "precedence";
  }
  return null;
}

function isPrecedenceBlocked(
  record: MemoryRecord,
  activeAccessibleCandidates: readonly RetrievalHit[]
): boolean {
  return activeAccessibleCandidates.some(
    (candidate) =>
      candidate.record.id !== record.id &&
      scopePrecedence(candidate.record.scope) > scopePrecedence(record.scope) &&
      recordsConflict(candidate.record, record)
  );
}

function recordsConflict(left: MemoryRecord, right: MemoryRecord): boolean {
  return (
    left.supersedes.includes(right.id) ||
    right.supersedes.includes(left.id) ||
    (left.kind === right.kind &&
      normalizeTitle(left.title) === normalizeTitle(right.title))
  );
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function toBlockedMemoryRecord(
  record: MemoryRecord,
  reason: BlockedMemoryReason
): BlockedMemoryRecord {
  return {
    id: record.id,
    reason,
    scope: record.scope,
    scopeId: record.scopeId,
    status: record.status,
    title: reason === "access" ? "[restricted]" : record.title,
    recordHash: record.recordHash
  };
}

function dedupeBlockedRecords(
  records: readonly BlockedMemoryRecord[]
): BlockedMemoryRecord[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function createRetrievalProvenance(
  hits: readonly RetrievalHit[],
  records: readonly MemoryRecord[],
  accessContext: MemoryAccessContext
): RetrievalProvenance {
  return {
    subjectId: accessContext.subjectId,
    projectionVersion: "canonical-memory-v1",
    scopeRoots: createScopeRoots(records, accessContext),
    records: hits.map((hit) => ({
      id: hit.record.id,
      scope: hit.record.scope,
      scopeId: hit.record.scopeId,
      status: hit.record.status,
      contentHash: hit.record.contentHash,
      recordHash: hit.record.recordHash
    }))
  };
}

function createScopeRoots(
  records: readonly MemoryRecord[],
  accessContext: MemoryAccessContext
): RetrievalScopeRoot[] {
  const groups = new Map<string, MemoryRecord[]>();

  records
    .filter(
      (record) =>
        canAccessMemoryRecord(record, accessContext) &&
        !isBlockedLifecycle(record)
    )
    .forEach((record) => {
      const key = `${record.scope}:${record.scopeId}`;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    });

  return [...groups.values()]
    .map((group) => {
      const [first] = group;
      const sortedRecords = group.sort((left, right) =>
        left.id.localeCompare(right.id)
      );
      const recordIds = sortedRecords.map((record) => record.id);
      const recordHashes = sortedRecords.map((record) => record.recordHash);

      return {
        scope: first.scope,
        scopeId: first.scopeId,
        root: hashStableValue({
          scope: first.scope,
          scopeId: first.scopeId,
          recordHashes
        }),
        recordIds
      };
    })
    .sort((left, right) => {
      const scopeDelta =
        scopePrecedence(right.scope) - scopePrecedence(left.scope);
      if (scopeDelta !== 0) return scopeDelta;
      return left.scopeId.localeCompare(right.scopeId);
    });
}
