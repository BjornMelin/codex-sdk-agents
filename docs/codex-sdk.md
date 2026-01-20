# Codex SDK (TypeScript)

The Codex SDK (`@openai/codex-sdk`) spawns the bundled `codex` binary and exchanges JSONL events over stdin/stdout.

## Core concepts

- `Codex`: client for creating and resuming threads
- `Thread`: a conversation container (multiple turns)
- `run()`: returns a completed turn (buffered)
- `runStreamed()`: streams structured events as the agent works

## Thread options that matter in practice

When creating a thread, the most common controls are:

- `workingDirectory`: where Codex operates
- `sandboxMode`: `read-only` | `workspace-write` | `danger-full-access`
- `approvalPolicy`: `never` | `on-request` | `on-failure` | `untrusted`
- `webSearchMode`: `disabled` | `cached` | `live` (and related feature flags)

## Structured output

If downstream code needs stable fields, pass an `outputSchema` per turn and validate the result before using it.

In this repo:

- `src/workflows/code-review.ts` exports a Zod schema for validation.
- `codeReviewJsonSchema` is generated via Zod v4’s built-in `z.toJSONSchema()` and passed to Codex as a JSON Schema.
- `docs/structured-outputs.md` shows the pattern end-to-end.

## Examples

- `examples/basic.ts`
- `examples/stream.ts`
- `examples/structured.ts`
- `examples/review.ts`
