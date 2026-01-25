---
id: SPEC-027
title: Codex skills discovery, configuration, and invocation
status: Completed
date: 2026-01-23
related_adrs:
  - docs/adr/0016-skills-only-instruction-packs.md
related_specs:
  - docs/specs/024-codex-app-server-endpoints.md
related_docs:
  - docs/codex-skills.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
---

## Goal

Provide full UI + API support for Codex Skills as the only reusable instruction
mechanism.

## Protocol details

`skills/list` returns entries by cwd with:

- `skills`: array of `SkillMetadata`
- `errors`: scan errors with `{ message: string, path?: string }`

`SkillMetadata` includes:

- Required fields: `name: string`, `path: string`, `scope: string`,
  `enabled: boolean`
- Optional fields: `description: string`, `short_description: string` (legacy),
  `interface`
- When present, `interface` includes: `display_name: string`,
  `short_description: string`, `icon_small: string`, `icon_large: string`,
  `brand_color: string`, `default_prompt: string`

`skills/config/write` accepts path + enabled and returns `effective_enabled`,
which may differ from the requested enabled value when global policy or scope
constraints override the user setting.

`skills/config/write` returns an error object on failure with the shape
`error: { message: string, code?: string }` for validation failures, permission
denials, or policy rejects.

Skill invocation uses `$skill-name` in the `turn/start` input text and a
matching `skill` input item (see SPEC-024 "Turns" section for `turn/start`
semantics). `$skill-name` is replaced verbatim with the registered skill
identifier (`SkillMetadata.name`) and is case-sensitive. Validation rule for
the skill identifier is the exact pattern `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`
(1-64 characters, ASCII letters/digits, hyphen, underscore only).

## UI requirements

- List skills by cwd with scope grouping and enable/disable toggles.
- Render interface metadata when present (icon, brand color, display name).
- Provide an explicit skill invocation action for `turn/start` that adds a
  `skill` input item plus `$skill-name` text prefix.

## Acceptance criteria

- `skills/list` and `skills/config/write` are wired in the UI.
- Skill invocation is supported and tested end-to-end.
