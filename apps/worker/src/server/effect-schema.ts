import { JSONSchema, Schema } from "effect";
import { jsonSchema } from "ai";

export function effectInputSchema<A, I>(schema: Schema.Schema<A, I, never>) {
  return jsonSchema<A>(JSONSchema.make(schema), {
    validate: (value) => {
      const result = Schema.decodeUnknownEither(schema)(value);

      if (result._tag === "Right") {
        return { success: true, value: result.right };
      }

      return { success: false, error: new Error(result.left.message) };
    }
  });
}
