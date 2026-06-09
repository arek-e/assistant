import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import { effectInputSchema } from "./effect-schema";

describe("effectInputSchema", () => {
  const inputSchema = effectInputSchema(
    Schema.Struct({
      city: Schema.String,
      count: Schema.Number
    })
  );

  test("accepts values decoded by the Effect schema", async () => {
    const result = await inputSchema.validate?.({
      city: "Stockholm",
      count: 2
    });

    expect(result).toEqual({
      success: true,
      value: { city: "Stockholm", count: 2 }
    });
  });

  test("returns a validation error instead of throwing", async () => {
    const result = await inputSchema.validate?.({
      city: "Stockholm",
      count: "many"
    });

    expect(result?.success).toBe(false);
    if (result?.success === false) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain("Expected number");
    }
  });
});
