---
title: Codex approvals and permissions
date: 2026-01-23
related_adrs:
  - docs/adr/0008-security.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/026-codex-approvals-permissions.md
related_docs:
  - docs/codex-app-server-protocol.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
---

Codex app-server uses server-initiated JSON-RPC requests to request approvals
for command executions and file changes.

## Command execution approvals

Request method: `item/commandExecution/requestApproval`

Payload includes:

- `command` (optional)
- `cwd` (optional)
- `command_actions` (optional parsed actions)
- `proposed_execpolicy_amendment` (optional)

UI should render all available metadata and support:

- accept
- decline
- accept + execpolicy amendment

## File change approvals

Request method: `item/fileChange/requestApproval`

Payload includes:

- `reason` (optional)
- `grant_root` (optional; unstable)

## Tool request user input

Request method: `item/tool/requestUserInput`

The request includes question metadata and optional options. The response
maps question ids to a list of answers.

## Permissions UI

Expose a UI that mirrors Codex /permissions behavior:

- show current approval policy and sandbox settings
- allow execpolicy updates
- apply updates via `config/value/write` or `config/batchWrite`
