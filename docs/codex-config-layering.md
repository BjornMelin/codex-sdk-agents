---
title: Codex config layering and requirements
date: 2026-01-23
related_adrs:
  - docs/adr/0008-security.md
  - docs/adr/0014-codex-app-server-v2-canonical-client.md
related_specs:
  - docs/specs/028-codex-config-layering.md
related_docs:
  - docs/codex-app-server-protocol.md
upstream_refs:
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server-protocol/src/protocol/v2.rs
  - opensrc/repos/github.com/openai/codex/codex-rs/core/src/config_loader/
---

Codex uses layered configuration resolved from the current working directory.
Use `config/read` with `cwd` to compute the effective config as seen from that
path, and optionally request raw layer details with `include_layers`.

`configRequirements/read` returns allow-lists for approval policies and sandbox
modes when requirements are configured.

## Write behavior

`config/value/write` and `config/batchWrite` support version conflict detection
and return structured error codes. Use these to surface safe UI updates.
