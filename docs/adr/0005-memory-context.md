# ADR 0005: Local-first artifacts + context packs + optional retrieval memory

## Status

Accepted

## Context

Autonomous coding agents require:

- stable shared context
- bounded token usage
- durable run artifacts for audits and replays
- cross-run memory for repo conventions and decisions

But local-first constraints:

- no required external DB
- must be inspectable
- must not leak secrets by default

## Decision

Codex ToolLoop will implement:

1. Run artifacts directory (primary truth)

- All runs write to `~/.codex-toolloop/runs/<runId>/...` by default (configurable).
- Includes JSONL logs, structured step outputs, diffs summaries, and final report.

1. Context packs (bounded injection units)

- Generated for each step.
- Include only necessary repo excerpts and summaries.
- Always size-bounded.

1. Optional memory stores (pluggable)

- MVP: file-based “notes” + summaries per repo
- Phase 3: optional vector retrieval
  - local Qdrant (docker) or other backend is optional
  - never required

## Alternatives considered

1. Always-on vector DB required

- Pros: strong retrieval
- Cons: violates local-first simplicity requirement

1. Only ephemeral memory

- Pros: simple
- Cons: weak cross-run improvement

## Consequences

- Strong auditability and reproducibility.
- Retrieval can be added without refactoring core runtime.

## Implementation notes

- Define interfaces:
  - `ArtifactStore`
  - `ContextPackBuilder`
  - `MemoryStore` (optional)
- Ensure secret redaction:
  - environment variables never dumped
  - tool outputs pass through redactor before persistence
