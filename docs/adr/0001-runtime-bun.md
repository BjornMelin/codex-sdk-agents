# ADR 0001: Bun as primary runtime with Node compatibility fallback

## Status

Accepted

## Context

Codex ToolLoop must be TypeScript-first and optimized for local developer experience. Bun provides fast startup, integrated package management, and a cohesive runtime for local tooling.

However:

- Some dependencies in the ecosystem still assume Node.js semantics.
- Vitest support under Bun is not consistently reliable in all modes.
- Some Codex-related libraries explicitly document Node.js requirements.

## Decision

- Bun is the primary runtime for:
  - apps/cli
  - packages/codex-toolloop
  - packages/mcp (servers and client manager)
  - packages/workflows

- Node.js is treated as a required local dependency (not a runtime preference) for:
  - executing Vitest (via node entrypoints, invoked from Bun scripts)
  - optional subprocess fallback for libraries that do not behave correctly under Bun

Codex ToolLoop will provide:

- `codex-toolloop doctor` checks for both `bun` and `node`.
- A single command surface that always runs from Bun.
- Internally, specific tasks may spawn Node as needed.

## Alternatives considered

1. Node-only runtime

- Pros: maximum compatibility
- Cons: less cohesive DX compared to Bun for local toolchains

1. Bun-only, no Node required

- Pros: simple environment story
- Cons: fragile; breaks when ecosystem assumptions exist

1. Deno runtime

- Pros: secure by default
- Cons: incompatible with many Node-oriented dependencies in practice

## Consequences

- Slightly higher environment burden (Bun + Node installed).
- Higher reliability for testing and some library edge cases.
- Clear separation: Bun is the main runtime; Node is a compatibility tool invoked when necessary.

## Implementation notes

- Root scripts use `bun run`.
- Testing script uses `node` to run Vitest.
- CLI prints actionable guidance if Node is missing.

## References (informational)

- Vitest + Bun support is still inconsistent per community and issue trackers.
- Bun remains a fast and ergonomic runtime for local CLIs and servers.
