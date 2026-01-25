---
id: SPEC-026
title: Codex approvals, execpolicy, and permissions UI
status: Draft
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

- `threadId` (required)
- `turnId` (required)
- `itemId` (required)
- `reason` (required)
- `command` (optional)
- `cwd` (optional)
- `commandActions` (optional list of parsed actions)
- `proposedExecpolicyAmendment` (required, non-nullable)

UI must:

- Render reason, command, cwd, and parsed actions when present.
- Support accept / decline.
- Support accept + execpolicy amendment (persist to config via
  `proposedExecpolicyAmendment`).

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

Example request payload:

```json
{
  "threadId": "thr_123",
  "turnId": "turn_456",
  "itemId": "item_789",
  "questions": [
    {
      "id": "confirm",
      "header": "Confirm action",
      "question": "Proceed with the migration?",
      "options": null
    },
    {
      "id": "environment",
      "header": "Target environment",
      "question": "Where should we deploy?",
      "options": [
        { "label": "staging", "description": "Deploy to staging first" },
        { "label": "prod", "description": "Deploy directly to production" }
      ]
    }
  ]
}
```

Example response payload:

```json
{
  "answers": {
    "confirm": { "answers": ["yes"] },
    "environment": { "answers": ["staging"] }
  }
}
```

Usage notes:

- Single-question flows send one question and a single answer array.
- Multi-option flows include `options` and return the selected labels.
- Multi-question flows return an `answers` map keyed by question id.
- Clients should validate that answer keys match requested question ids and
  respond with a user-visible error if required answers are missing.

## Acceptance criteria

- Approval request payloads are surfaced as `CodexEvent` with full params.
- Approvals accept/deny and accept-with-amendment are wired to
  `config/value/write` or `config/batchWrite`. Use `config/value/write` for
  single approval amendments or simple single-key updates (example: accept a
  command approval and toggle one execpolicy key). Use `config/batchWrite` for
  multiple simultaneous amendments or complex multi-key updates (example:
  accept-with-amendment that updates several execpolicy fields together). This
  keeps single-key writes lean and avoids partial updates for multi-key changes.
- Tests cover command + file change approvals and user input responses.
