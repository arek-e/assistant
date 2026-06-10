import { Database } from "bun:sqlite";

import type {
  MemorySqlCursor,
  MemorySqlStorage,
  MemorySqlValue
} from "@teampitch/worker/server/assistant-primitives";

export function createEvalMemorySqlStorage(): MemorySqlStorage {
  return new BunMemorySqlStorage(new Database(":memory:"));
}

class BunMemorySqlStorage implements MemorySqlStorage {
  constructor(private readonly database: Database) {}

  exec(query: string, ...params: MemorySqlValue[]): MemorySqlCursor {
    const statement = this.database.query(query);
    const normalizedParams = params.map(normalizeSqlValue);

    if (returnsRows(query)) {
      const rows = statement.all(...normalizedParams) as Record<string, MemorySqlValue>[];
      return { toArray: () => rows };
    }

    statement.run(...normalizedParams);
    return { toArray: () => [] };
  }
}

function returnsRows(query: string) {
  const normalized = query.trim().toLowerCase();
  return (
    normalized.startsWith("select") ||
    normalized.startsWith("with") ||
    normalized.startsWith("pragma")
  );
}

function normalizeSqlValue(value: MemorySqlValue) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}
