---
id: SPEC-029
title: AI SDK UI message stream contract
status: In Progress
date: 2026-01-23
related_adrs:
  - docs/adr/0015-ai-sdk-ui-stream-contract.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/024-codex-app-server-endpoints.md
related_docs:
  - docs/codex-app-server-protocol.md
upstream_refs:
  - opensrc/repos/github.com/vercel/ai/packages/ai/src/ui/ui-messages.ts
  - opensrc/repos/github.com/vercel/ai/packages/ai/src/ui-message-stream/ui-message-chunks.ts
  - opensrc/repos/github.com/vercel/ai/packages/ai/src/ui/process-ui-message-stream.ts
---

## Goal

Define a stable, typed UI stream contract for all Codex and non-Codex
interactive flows using AI SDK v6.

## Source of truth

The UI message model and streaming chunks are defined by AI SDK:

- `ui-messages.ts` — UIMessage parts and tool approval states.
- `ui-message-chunks.ts` — stream chunk types (`text-*`, `reasoning-*`,
  `tool-*`, `data-*`, `start`/`finish`, `message-metadata`, `abort`).
- `process-ui-message-stream.ts` — state machine for approvals and tool calls.

## Required contract

- All Codex app-server events emit `data-codex-event` parts.
- Use `transient: true` for ephemeral updates unless persistence is required.
- Emit text and reasoning chunks for agent output and reasoning streams.
- Tool approval requests must map to `tool-approval-request` chunks when using
  AI SDK tools, and to `data-codex-event` when the approval is Codex-native.

## Notes from source

- `UIMessage` tool parts support states: input-streaming, input-available,
  approval-requested, approval-responded, output-available, output-denied,
  output-error.
- Data parts support `transient` to avoid persisting ephemeral updates.
- Approval responses are handled client-side via `addToolApprovalResponse` and
  do not emit a dedicated stream chunk type.

## Acceptance criteria

- Codex UI stream yields valid `UIMessageChunk` sequences.
- `readUIMessageStream` can reconstruct state from the stream.
- Tests cover transient data parts and approval response handling.
