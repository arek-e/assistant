import type { LifecycleStatus, MemoryRecordKind } from "./types";

export type MemoryWriteKind = MemoryRecordKind | "none";
export type MemoryWriteStatus = LifecycleStatus | "none";

export interface MemoryWriteDecision {
  shouldWrite: boolean;
  kind: MemoryWriteKind;
  status: MemoryWriteStatus;
  reason: string;
  hasEvidence: boolean;
}

const PREFERENCE_MARKERS = ["i prefer", "my preference", "always use"];
const DECISION_MARKERS = ["we chose", "we decided", "lets use", "let's use"];
const IMPLEMENTATION_MARKERS = ["implemented", "shipped", "deployed"];

type MemoryWriteRule = (
  lowerInput: string,
  originalInput: string
) => MemoryWriteDecision | null;

const MEMORY_WRITE_RULES: MemoryWriteRule[] = [
  shortInputRule,
  explicitPreferenceRule,
  decisionIntentRule
];

export function proposeMemoryWrite(input: string): MemoryWriteDecision {
  const lowerInput = input.toLowerCase();
  const rule = MEMORY_WRITE_RULES.find(
    (candidate) => candidate(lowerInput, input) !== null
  );

  return (
    rule?.(lowerInput, input) ??
    noWrite("no durable preference, decision, term, or lesson detected")
  );
}

function shortInputRule(
  _lowerInput: string,
  originalInput: string
): MemoryWriteDecision | null {
  if (originalInput.trim().length >= 24) return null;
  return noWrite("input is too small to justify durable memory");
}

function explicitPreferenceRule(
  lowerInput: string,
  _originalInput: string
): MemoryWriteDecision | null {
  if (!includesAny(lowerInput, PREFERENCE_MARKERS)) return null;
  return writeDecision(
    "preference_record",
    "active",
    "explicit user preference",
    true
  );
}

function decisionIntentRule(
  lowerInput: string,
  _originalInput: string
): MemoryWriteDecision | null {
  if (!includesAny(lowerInput, DECISION_MARKERS)) return null;
  return decisionRecordWrite(includesAny(lowerInput, IMPLEMENTATION_MARKERS));
}

function decisionRecordWrite(implemented: boolean): MemoryWriteDecision {
  return writeDecision(
    "decision_record",
    implemented ? "active" : "proposed",
    implemented
      ? "decision includes implementation evidence"
      : "decision intent needs implementation evidence before active status",
    true
  );
}

function includesAny(value: string, markers: readonly string[]) {
  return markers.some((marker) => value.includes(marker));
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
  kind: MemoryWriteKind,
  status: MemoryWriteStatus,
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
