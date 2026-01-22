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

## Artifact guarantees

On abrupt termination (signal or crash):

- **events.jsonl, codex-events.jsonl, tool-calls.jsonl**: Line-oriented JSONL files are appended as events arrive. Files remain line-delimited and parseable per-line even if the run is interrupted; the last line may be incomplete but does not corrupt prior entries.
- **final-report.md**: Only written on successful completion. Absence of this file indicates the run did not finish cleanly (crash, signal, or error).
- **Flush behavior**: On Node.js, JSONL files are flushed on signal handlers; final-report.md is only created on clean exit. Downstream tools can detect incomplete runs by checking for the absence of final-report.md or looking for a special "run_complete" event in events.jsonl.

## Implementation notes

- Provide `EventBus` and `JsonlLogger`.
- Redact secrets by default.
- Truncate large tool outputs with a stable policy and preserve hashes.
- **Media handling:** JsonlLogger treats non-text media (images, audio, files) as follows:
  - Small media items (below a configurable size threshold) are included inline in tool-calls.jsonl as base64-encoded strings, accompanied by their MIME type and SHA-256 hash.
  - Media above the size threshold is written to a separate artifact file; tool-calls.jsonl records the artifact path/ID, MIME type, and SHA-256 hash instead of the full base64 blob.
  - EventBus consumers must handle both inline base64+hash and external artifact reference+hash representations.
- Explicitly preserve SHA-256 hashes for all media: both inline base64 items and external artifact files record their hash to enable integrity verification and deduplication across runs.
- Install signal handlers for deterministic flush and artifact finalization.
