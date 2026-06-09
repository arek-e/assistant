import { Effect } from "effect";

const conditions = ["sunny", "cloudy", "rainy", "snowy"] as const;

export const getDemoWeather = (city: string) =>
  Effect.gen(function* () {
    const temperature = yield* Effect.sync(
      () => Math.floor(Math.random() * 30) + 5
    );
    const condition = yield* Effect.sync(
      () => conditions[Math.floor(Math.random() * conditions.length)]
    );

    return {
      city,
      temperature,
      condition,
      unit: "celsius" as const
    };
  });
