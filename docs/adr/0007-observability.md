# ADR 0007: JSONL-first observability with normalized events

## Status

Accepted

## Context

Autonomous systems fail in complex ways. Codex ToolLoop must provide:

- replayable logs
- clear evidence of actions taken
- stable debugging artifacts

Codex emits event streams (JSONL in exec mode). AI SDK streaming provides text streams and provider-specific hooks.

We need a unified event model.

## Decision

- Codex ToolLoop adopts JSONL logs as the primary observability surface.
- Every run writes:
  - `events.jsonl`: normalized event objects
  - `codex-events.jsonl`: raw upstream events when available
  - `tool-calls.jsonl`: MCP tool calls and results (redacted)
  - `final-report.md`

Normalized event schema includes:

- timestamp
- runId
- stepId
- agentRole
- eventType
- payload (typed per eventType)

## Alternatives considered

1. Only console logs

- Pros: simple
- Cons: not replayable, not structured

1. Full OpenTelemetry stack

- Pros: powerful
- Cons: too heavy for local-first MVP

## Consequences

- Easy debugging and golden tests (compare event logs).
- Enables future UI and trace visualization.

## Implementation notes

- Provide `EventBus` and `JsonlLogger`.
- Redact secrets by default.
- Truncate large tool outputs with a stable policy and preserve hashes.
