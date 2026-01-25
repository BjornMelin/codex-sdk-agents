---
id: ADR-0014
title: Codex app-server v2 canonical client + event model
status: Accepted
date: 2026-01-23
related_adrs:
  - docs/adr/0002-model-backends.md
  - docs/adr/0004-multi-agent-orchestration.md
  - docs/adr/0007-observability.md
  - docs/adr/0008-security.md
  - docs/adr/0013-codex-app-server-protocol-types.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/024-codex-app-server-endpoints.md
  - docs/specs/029-ai-sdk-ui-stream-contract.md
related_docs:
  - docs/codex-app-server-protocol.md
  - docs/codex-collaboration.md
  - docs/codex-approvals-permissions.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server/
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/
  - opensrc/repos/github.com/openai/codex/codex-rs/protocol/
---

## Context

Codex app-server v2 provides a rich JSON-RPC protocol surface that includes
thread history, approvals, tool calls, collaboration modes, and streaming
item deltas. The protocol is defined in the Rust sources and exported to
TypeScript via the Codex CLI generator.

We previously had multiple partial integrations across the repo, which risks
schema drift and missing features when new protocol fields appear.

## Decision

Adopt a **single canonical app-server client** and **single internal event
model** for all app-server usage. Every module that needs Codex app-server
interactions must go through this client and normalized event stream.

Concretely:

1. One JSON-RPC client over stdio, with a strict initialize/initialized
   handshake and JSONL framing.
2. All protocol payloads are typed using generated TS types from
   `codex app-server generate-ts`.
3. Runtime validation applies to JSON-RPC envelopes only (Zod v4), to avoid
   rejecting forward-compatible fields.
4. A single `CodexEvent` union captures normalized events, including
   approvals, collaboration tool calls, request-user-input, token usage,
   and raw response items for end_turn handling.

## Consequences

- **Positive**: consistent behavior, full protocol coverage, and fewer edge
  cases when Codex adds new fields.
- **Negative**: integration points must migrate to the canonical client (no
  ad-hoc subprocess usage).

## Implementation notes

- Protocol definitions: `codex-rs/app-server-protocol/src/protocol/common.rs`
  and `codex-rs/app-server-protocol/src/protocol/v2.rs`.
- Runtime behaviors (archived threads, includeTurns, provider filtering) are
  sourced from `codex-rs/app-server/src/codex_message_processor.rs`.
- `end_turn` appears in the core protocol model and must be preserved in raw
  response items.

## Alternatives considered

1. Multiple per-module clients
   - Rejected: creates drift and inconsistent behavior.
2. Full JSON Schema validation
   - Rejected: large runtime overhead, strictness harms forward compatibility.

## Amendment history

- 2026-01-23: Initial adoption.
