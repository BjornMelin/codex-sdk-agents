# Structured outputs

Structured outputs make Codex runs reliable in automation: you get a predictable shape that downstream steps can validate.

## Pattern

1. Define a Zod schema for the expected output.
2. Generate JSON Schema with `z.toJSONSchema(schema)`.
3. Pass it to Codex as `outputSchema`.
4. Parse the final response as JSON and validate it with Zod before using it.

## In this repo

- Schema + prompt builder: `src/workflows/code-review.ts`
- Runnable example: `examples/review.ts`

## Minimal example

```ts
import { z } from "zod";
import { Codex } from "@openai/codex-sdk";

const Output = z.strictObject({
  summary: z.string(),
  status: z.enum(["ok", "action_required"]),
});

const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: process.cwd(),
  sandboxMode: "read-only",
  approvalPolicy: "never",
});

const turn = await thread.run("Summarize repo status.", {
  outputSchema: z.toJSONSchema(Output),
});

const parsed = JSON.parse(turn.finalResponse) as unknown;
const validated = Output.parse(parsed);
console.log(validated);
```
