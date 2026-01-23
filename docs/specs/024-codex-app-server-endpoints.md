---
id: SPEC-024
title: Codex app-server v2 endpoint coverage
status: In Progress
date: 2026-01-23
related_adrs:
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
  - docs/adr/0002-model-backends.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/026-codex-approvals-permissions.md
  - docs/specs/027-codex-skills.md
  - docs/specs/028-codex-config-layering.md
related_docs:
  - docs/codex-app-server-protocol.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/common.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server/src/codex_message_processor.rs
---

## Goal

Provide full, tested coverage of every Codex app-server v2 request and
notification that is exposed by the upstream protocol.

## Scope

This spec covers:

- JSON-RPC request methods and parameters
- server-initiated requests (approvals, user input)
- notifications emitted by the server
- field-level behaviors that differ from documentation (source-of-truth is
  the open-source Rust implementation)

## Source of truth

The authoritative method list and payload schemas are defined in:

- `codex-rs/app-server-protocol/src/protocol/common.rs`
- `codex-rs/app-server-protocol/src/protocol/v2.rs`

Runtime behaviors such as archived listing, includeTurns semantics, and
provider filtering are defined in:

- `codex-rs/app-server/src/codex_message_processor.rs`

## Required requests (client initiated)

### Threads

- `thread/start` – create a thread with optional model, provider, cwd,
  approval_policy, sandbox, config overrides.
- `thread/resume` – load a stored thread and resume future turns.
- `thread/fork` – create a new thread from history.
- `thread/read` – fetch a thread by id. `includeTurns` controls whether turns
  are populated; when false, `turns` is empty.
- `thread/list` – list stored threads with pagination, sort, provider filter,
  and `archived` filter.
  - Source behavior: when `model_providers` is `None`, the server filters to
    the configured provider; when `model_providers` is an empty list, all
    providers are included.
  - Source behavior: server uses `updated_at` sort by default.
- `thread/loaded/list` – list in-memory threads.
- `thread/archive` – move the thread JSONL to archived sessions; if a thread
  is running, the server requests shutdown and proceeds after a timeout.
- `thread/rollback` – drop the last N turns; `thread.turns` is populated and
  remains lossy (agent interactions are not fully persisted).

### Turns

- `turn/start` – accepts `cwd`, `approval_policy`, `sandbox_policy`, model,
  effort, summary, output_schema, and `collaboration_mode` (overrides model
  and developer instructions).
- `turn/interrupt` – cancels an in-flight turn.

### Review

- `review/start` – inline or detached review; response includes
  `review_thread_id`.

### Models

- `model/list` – list models and their effort options.

### Collaboration

- `collaborationMode/list` – list collaboration mode presets.

### Skills

- `skills/list` – list skills for cwds; defaults to current session cwd when
  empty. Supports `force_reload`.
- `skills/config/write` – enable/disable skill by path.

### Config

- `config/read` – `include_layers` and `cwd` resolved for layered config.
- `config/value/write` – write a single key with merge strategy.
- `config/batchWrite` – apply edits atomically.
- `configRequirements/read` – returns allow-lists or null.
- `config/mcpServer/reload` – reload MCP config from disk.

### MCP

- `mcpServerStatus/list` – list MCP servers + tool/resource metadata.
- `mcpServer/oauth/login` – start OAuth flow for HTTP MCP servers.

### Other

- `command/exec` – run a one-off command without a thread.
- `feedback/upload` – submit feedback with optional logs.
- `account/read`, `account/login/start`, `account/login/cancel`,
  `account/logout`, `account/rateLimits/read` – authentication surface.

## Required server requests

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/tool/requestUserInput`

## Required notifications

- `thread/started`
- `thread/tokenUsage/updated`
- `thread/compacted`
- `turn/started` / `turn/completed`
- `turn/diff/updated` / `turn/plan/updated`
- `item/started` / `item/completed`
- `item/agentMessage/delta`
- `item/reasoning/*` deltas
- `item/commandExecution/outputDelta`
- `item/commandExecution/terminalInteraction`
- `item/fileChange/outputDelta`
- `item/mcpToolCall/progress`
- `mcpServer/oauthLogin/completed`
- `account/updated` / `account/rateLimits/updated`
- `account/login/completed`
- `deprecationNotice`
- `configWarning`
- `windows/worldWritableWarning`
- `error`
- `rawResponseItem/completed` (internal but required for end_turn handling)

## Acceptance criteria

- Each request is exposed by the canonical client + bridge.
- Each server request is handled and surfaced through the event stream.
- Each notification is either mapped to an explicit event type or forwarded
  as a generic notification event.
- Tests cover thread/read, archived list filtering, config/read layering,
  approvals, requestUserInput, collab tool calls, and account updates.
