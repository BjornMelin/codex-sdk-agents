---
id: ADR-0016
title: Skills-only instruction packs (custom prompts deprecated)
status: Accepted
date: 2026-01-23
related_adrs:
  - docs/adr/0002-model-backends.md
  - docs/adr/0004-multi-agent-orchestration.md
  - docs/adr/0008-security.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/027-codex-skills.md
related_docs:
  - docs/codex-skills.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server/README.md
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
---

## Context

Codex app-server exposes Skills as the native reusable instruction mechanism.
Skill metadata includes interface presentation details (name, description,
icons, brand color, default prompt) and supports enable/disable toggles
persisted in config.

Legacy custom prompt files are deprecated upstream and do not integrate with
Skills configuration or discovery.

## Decision

Adopt Skills as the **only** reusable instruction mechanism. Any legacy
custom prompt system is removed or migrated to Skills with `SKILL.toml`
interface metadata.

## Consequences

- **Positive**: consistent behavior with Codex app-server, centralized
  configuration, and better UX for skill discovery.
- **Negative**: migration work for any custom prompt packs.

## Implementation notes

- Use `skills/list` to discover skills (scoped by `cwds`, optional
  `force_reload`).
- Use `skills/config/write` to enable or disable skills by path.
- Invoke a skill explicitly via `turn/start` input with a `skill` item
  and `$skill-name` in the text input.

## Amendment history

- 2026-01-23: Initial adoption.
