---
id: SPEC-029
title: AI SDK UI message stream contract
status: Completed
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
  - >-
    opensrc/repos/github.com/vercel/ai/packages/ai/src/
    ui-message-stream/ui-message-chunks.ts
  - >-
    opensrc/repos/github.com/vercel/ai/packages/ai/src/ui/
    process-ui-message-stream.ts
---

## Goal

Define a stable, typed UI stream contract for all Codex and non-Codex
interactive flows using AI SDK v6.

## Source of truth

The UI message model and streaming chunks are defined by AI SDK:

- `ui-messages.ts` -- UIMessage parts and tool approval states.
- `ui-message-chunks.ts` -- stream chunk types (`start`, `text-start`,
  `text-delta`, `text-end`, `reasoning-start`, `reasoning-delta`,
  `reasoning-end`, `error`, `tool-input-start`, `tool-input-delta`,
  `tool-input-available`, `tool-input-error`, `tool-approval-request`,
  `tool-output-available`, `tool-output-error`, `tool-output-denied`,
  `source-url`, `source-document`, `file`, `data-*`, `start-step`,
  `finish-step`, `finish`, `abort`, `message-metadata`).
- `process-ui-message-stream.ts` -- state machine for approvals and tool calls.

## Required contract

- All Codex app-server events emit `data-codex-event` parts.
- Use `transient: true` for ephemeral updates unless persistence is required.
- Emit text and reasoning chunks for agent output and reasoning streams.
- Tool approval requests for AI SDK tools emit `tool-approval-request` chunks,
  which transition tool parts to `approval-requested`; Codex-native approvals
  emit `data-codex-event` parts.

## Notes from source

- `UIMessage` tool parts support states: input-streaming, input-available,
  approval-requested, approval-responded, output-available, output-denied,
  output-error.
- Data parts support `transient` to avoid persisting ephemeral updates.
- Approval responses are handled client-side via `addToolApprovalResponse` and
  do not emit a dedicated stream chunk type.
- The SSE stream terminates with `data: [DONE]`, which is transport-level and
  not a `UIMessageChunk`.

## Acceptance criteria

- Codex UI stream yields valid `UIMessageChunk` sequences.
- `readUIMessageStream` can reconstruct state from the stream.
- Tests cover transient data parts and approval response handling.
