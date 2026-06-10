import { hashStableValue } from "./hash";
import {
  decodeMemoryRecord,
  type MemoryRecord,
  type MemoryRecordDraft
} from "./types";

export function createMemoryRecord(input: MemoryRecordDraft): MemoryRecord {
  const contentHash = hashMemoryContent(input);
  const recordHash = hashMemoryRecord({ ...input, contentHash });

  return decodeMemoryRecord({
    ...input,
    contentHash,
    recordHash
  });
}

export function hashMemoryContent(record: MemoryRecordDraft): string {
  return hashStableValue({
    kind: record.kind,
    title: record.title,
    body: record.body,
    evidence: record.evidence,
    rationale: record.rationale,
    reEvalTrigger: record.reEvalTrigger,
    consumerRules: record.consumerRules,
    tags: record.tags,
    supersedes: record.supersedes
  });
}

export function hashMemoryRecord(
  record: MemoryRecordDraft & { contentHash: string }
): string {
  return hashStableValue({
    id: record.id,
    kind: record.kind,
    scope: record.scope,
    scopeId: record.scopeId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    contentHash: record.contentHash
  });
}
