---
title: Codex skills (discovery, configuration, invocation)
date: 2026-01-23
related_adrs:
  - docs/adr/0016-skills-only-instruction-packs.md
related_specs:
  - docs/specs/027-codex-skills.md
related_docs:
  - docs/codex-app-server-protocol.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
---

Codex skills are the only reusable instruction packs. Skills are discoverable
via the app-server and can be enabled/disabled per path.

## Discover skills

Call `skills/list` with `cwds` (or empty for default cwd). Each entry includes
skill metadata and scan errors.

## Configure skills

Call `skills/config/write` with a skill path and enabled flag. The response
returns `effective_enabled`.

## Invoke a skill explicitly

Include a `skill` input item in `turn/start` plus a `$skill-name` prefix in
text input. This ensures full instructions are injected.
