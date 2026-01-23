---
id: SPEC-026
title: Codex approvals, execpolicy, and permissions UI
status: In Progress
date: 2026-01-23
related_adrs:
  - docs/adr/0008-security.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/024-codex-app-server-endpoints.md
related_docs:
  - docs/codex-approvals-permissions.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/common.rs
---

## Goal

Expose app-server approval flows (command execution and file changes) with a
first-class UI that mirrors Codex CLI permissions and execpolicy behavior.

## Command approvals

`item/commandExecution/requestApproval` includes:

- `command` (optional)
- `cwd` (optional)
- `command_actions` (optional list of parsed actions)
- `proposed_execpolicy_amendment` (optional)

UI must:

- Render command, cwd, and parsed actions when present.
- Support accept / decline.
- Support accept + execpolicy amendment (persist to config).

## File change approvals

`item/fileChange/requestApproval` includes:

- `reason` (optional)
- `grant_root` (optional, unstable)

UI must:

- Render the diff + reason.
- Allow accept / decline.
- Optionally expose grant_root requests.

## Request user input

`item/tool/requestUserInput` is EXPERIMENTAL and includes question metadata and
optional options. Responses map question ids to answer arrays.

## Acceptance criteria

- Approval request payloads are surfaced as `CodexEvent` with full params.
- Approvals accept/deny and accept-with-amendment are wired to
  `config/value/write` or `config/batchWrite`.
- Tests cover command + file change approvals and user input responses.
