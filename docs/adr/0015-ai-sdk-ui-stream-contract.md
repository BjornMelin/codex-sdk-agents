---
id: ADR-0015
title: AI SDK UI stream as the sole client-facing transport
status: Accepted
date: 2026-01-23
related_adrs:
  - docs/adr/0002-model-backends.md
  - docs/adr/0007-observability.md
  - docs/adr/0008-security.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/029-ai-sdk-ui-stream-contract.md
related_docs:
  - docs/codex-app-server-protocol.md
  - docs/codex-approvals-permissions.md
  - docs/codex-collaboration.md
upstream_refs:
  - opensrc/repos/github.com/vercel/ai/packages/ai/src/ui-message-stream/
  - opensrc/repos/github.com/vercel/ai/packages/ai/src/ui/
---

## Context

AI SDK v6 provides a stable, typed `UIMessage` stream contract with support for
text, reasoning, tool calls, approvals, and custom data parts. It is the most
robust way to expose streaming data to the frontend while preserving the full
state required for rendering and rehydration.

Codex app-server emits low-level JSON-RPC notifications; we need a single
client-facing stream format that is compatible with AI SDK UI hooks.

## Decision

Standardize on **AI SDK UI message streams** as the only client-facing stream
format. Codex app-server notifications are mapped into `UIMessage` data parts
and text/reasoning parts as appropriate.

Concretely:

- Use `createUIMessageStream` and `createUIMessageStreamResponse` to emit
  stream chunks.
- Use `readUIMessageStream` for resumption and state reconstruction.
- Encode Codex events as `data-codex-event` parts with optional `transient`
  to avoid persisting ephemeral updates.
- Preserve tool approvals as AI SDK approval parts for non-Codex tool flows
  and as data parts for Codex-native approvals.

## Consequences

- **Positive**: consistent UI contract across backends, supports caching and
  resumption, and aligns with AI SDK tooling.
- **Negative**: requires an explicit mapping layer and tests for data-part
  correctness.

## Implementation notes

- `UIMessage` parts and approval states are defined in
  `packages/ai/src/ui/ui-messages.ts`.
- Stream chunk types are defined in
  `packages/ai/src/ui-message-stream/ui-message-chunks.ts`.
- `process-ui-message-stream.ts` describes the state machine for approval and
  tool states; match its expectations when emitting chunks.

## Amendment history

- 2026-01-23: Initial adoption.
