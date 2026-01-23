---
title: Codex collaboration modes and multi-agent orchestration
date: 2026-01-23
related_adrs:
  - docs/adr/0004-multi-agent-orchestration.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/025-codex-collaboration.md
related_docs:
  - docs/codex-app-server-protocol.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/protocol/src/config_types.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
---

Codex collaboration modes provide native multi-agent behavior via the
app-server protocol. This repo exposes them through the canonical app-server
client and the Codex UI stream.

## Collaboration modes

Use `collaborationMode/list` to fetch presets. Each preset is a `CollaborationMode`
variant (`plan`, `pair_programming`, `execute`, `custom`) with settings:

- `model`
- `reasoning_effort`
- `developer_instructions`

When you pass `collaborationMode` in `turn/start`, it overrides model and
reasoning settings for that turn and becomes the default for subsequent turns.

## Collab tool calls

`ThreadItem::collabAgentToolCall` includes:

- tool: spawn_agent | send_input | wait | close_agent
- status: inProgress | completed | failed
- sender_thread_id
- receiver_thread_ids (array)
- prompt (optional)
- agents_states (map of thread id -> status + message)

Render these as timeline events and expose a subagent thread list for
`receiver_thread_ids`.

## UI expectations

- Parent thread shows collab tool call updates and agent states.
- Child threads are addressable by id and openable in the UI.
- Summaries or final messages from child threads should be surfaced back to
  the parent thread timeline.
