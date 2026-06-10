# Assistant Primitive Evals

Run the deterministic primitive evals:

```sh
bun run evals
```

The runner validates fixtures with Effect Schema, exercises the app-side Canonical Memory Store, memory-write admission, and routing primitives, then writes a JSONL trace to `.evals/latest.jsonl`.

## Adding A Regression

Add a fixture in `packages/evals/src/fixtures.ts` when the assistant makes a bad memory, retrieval, or routing decision.

A good fixture includes:

- seeded records that reproduce the state
- the user input
- expected record ids
- forbidden record ids
- expected memory write kind/status or route shape
- the metric the fixture protects

Keep the first check deterministic. Use model-judged evals only after the primitive can already prove it retrieved the right records and respected lifecycle status.
