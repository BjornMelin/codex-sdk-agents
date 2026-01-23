---
id: SPEC-028
title: Codex config layering, cwd resolution, and requirements
status: In Progress
date: 2026-01-23
related_adrs:
  - docs/adr/0008-security.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/024-codex-app-server-endpoints.md
related_docs:
  - docs/codex-config-layering.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/core/src/config_loader/
---

## Goal

Expose the app-server layered configuration system, including cwd-aware
resolution and requirement allow-lists.

## Protocol details

`config/read`:

- `include_layers` controls whether raw layer list is returned.
- `cwd` resolves project layers relative to the caller's working directory.

`config/value/write` and `config/batchWrite`:

- enforce version conflict checks
- surface structured error codes

`configRequirements/read`:

- returns allowed approval policies and sandbox modes, or null if not set.

## UI requirements

- Display effective config and origin metadata.
- Optionally show layers when `include_layers` is true.
- Surface write conflicts with a clear resolution path.

## Acceptance criteria

- `config/read` supports cwd and include_layers.
- requirements and conflict codes are reflected in UI state.
- tests cover layered resolution and conflict handling.
