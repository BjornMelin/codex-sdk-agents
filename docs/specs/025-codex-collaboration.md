---
id: SPEC-025
title: Codex collaboration modes and collab tool calls
status: Completed
date: 2026-01-23
related_adrs:
  - docs/adr/0004-multi-agent-orchestration.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/024-codex-app-server-endpoints.md
related_docs:
  - docs/codex-collaboration.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/protocol/src/config_types.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
---

## Goal

Provide first-class support for Codex collaboration modes and collab tool calls
in the canonical app-server integration and UI.

## Collaboration modes

`CollaborationMode` variants are defined in
`codex-rs/protocol/src/config_types.rs`:

- `plan`
- `pair_programming`
- `execute`
- `custom`

Each variant wraps `Settings`:

- `model` (string)
- `reasoning_effort` (optional)
- `developer_instructions` (optional)

`collaborationMode/list` returns presets as these variants.

When `turn/start.collaboration_mode` is set, it **overrides** model, reasoning
settings, and developer instructions for that turn and becomes the new default
for subsequent turns.

## Collab tool call item

`ThreadItem::CollabAgentToolCall` includes:

- `id`
- `tool` (spawn_agent | send_input | wait | close_agent)
- `status` (inProgress | completed | failed)
- `sender_thread_id`
- `receiver_thread_ids` (array)
- `prompt` (optional)
- `agents_states` (map of thread id -> status + optional message)

Agent statuses:

- pendingInit
- running
- completed
- errored
- shutdown
- notFound

## UI requirements

- Render a collab timeline that includes tool, status, sender, receiver ids,
  and prompt.
- Provide a child-thread list for each `receiver_thread_id`.
- Surface `agents_states` to show live progress in parent thread.

## Acceptance criteria

- `collaborationMode/list` is wired to a UI picker.
- `turn/start` accepts `collaborationMode` override.
- Collab tool calls are normalized into `CodexEvent` and surfaced in
  `UIMessage` data parts.
- Tests cover spawn/send_input/wait/close with receiver ids and agent states.
