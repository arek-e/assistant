import { hashStableValue } from "./hash";
import { createLocalMemoryAccessContext, toMemoryRecordActor } from "./access";
import {
  decodeMemoryRecord,
  type MemoryRecord,
  type MemoryRecordDraft
} from "./types";

export function createMemoryRecord(input: MemoryRecordDraft): MemoryRecord {
  const record = {
    ...input,
    actor: input.actor ?? toMemoryRecordActor(createLocalMemoryAccessContext())
  };
  const contentHash = hashMemoryContent(record);
  const recordHash = hashMemoryRecord({ ...record, contentHash });

  return decodeMemoryRecord({
    ...record,
    contentHash,
    recordHash
  });
}

function hashMemoryContent(record: MemoryRecordDraft): string {
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

function hashMemoryRecord(
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
    actor: record.actor,
    contentHash: record.contentHash
  });
}
