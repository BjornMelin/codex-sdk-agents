# Workflows

This repo is intentionally small; the goal is to make it easy to assemble reliable “loops” that call Codex, validate output, and then apply follow-up steps.

## A reliable loop shape

1. Gather inputs (diffs, logs, failing test output, file list).
2. Call Codex with explicit constraints and a structured schema.
3. Validate the response (Zod or JSON schema validation).
4. Apply the result (post a comment, write a report, or open a PR).
5. Re-run checks and stop.

## Code review (structured)

Files:

- Prompt builder + schema: `src/workflows/code-review.ts`
- Runnable example: `examples/review.ts`

What it demonstrates:

- Pulling a Git diff
- Asking Codex for a structured review response
- Validating JSON before printing/using it

## CI autofix (CLI pattern)

For automation in CI, `codex exec --json` + `--output-schema` is a common pattern:

- JSONL gives you complete traceability.
- A schema gives downstream steps stable fields.
- Resume mode supports multi-stage pipelines.

See: `docs/reference/non-interactive.md`
