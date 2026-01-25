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

- `name: string`, `description: string`, `short_description: string` (legacy)
- `interface` metadata: `display_name: string`, `short_description: string`,
  `icon_small: string`, `icon_large: string`, `brand_color: string`,
  `default_prompt: string`
- `path: string`, `scope: string`, `enabled: boolean`

`skills/config/write` accepts path + enabled and returns `effective_enabled`,
which may differ from the requested enabled value when global policy or scope
constraints override the user setting.

## UI requirements

- List skills by cwd with scope grouping and enable/disable toggles.
- Render interface metadata when present (icon, brand color, display name).
- Provide an explicit skill invocation action for `turn/start` that adds a
  `skill` input item plus `$skill-name` text prefix.

## Acceptance criteria

- `skills/list` and `skills/config/write` are wired in the UI.
- Skill invocation is supported and tested end-to-end.
