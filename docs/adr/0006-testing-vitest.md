# ADR 0006: Vitest standardization with Node execution invoked from Bun

## Status

Accepted

## Context

Codex ToolLoop requires:

- modern testing (unit, integration, type tests)
- stable CI-like behavior locally
- compatibility with Node-oriented dependencies

Vitest is the desired test framework, but Bun support remains inconsistent in practice across versions and modes.

## Decision

- Use Vitest for:
  - unit tests
  - integration tests
  - type tests (`expectTypeOf`)
- Execute Vitest using Node, invoked by Bun scripts:
  - `bun run test` spawns `node` to run the Vitest CLI entrypoint
- Use Bun for:
  - building and running the CLI and MCP servers
  - orchestration scripts

## Alternatives considered

1. Bun test runner

- Pros: tight Bun integration
- Cons: deviates from requirement and ecosystem expectations for plugin integrations

1. Vitest under Bun directly

- Pros: single runtime
- Cons: can break in run mode or under certain pools; reliability risk

## Consequences

- Requires Node installed.
- Delivers consistent testing behavior and easiest ecosystem compatibility.

## Implementation notes

- Provide:
  - `vitest.config.ts`
  - `tsconfig.json` with strict settings
  - `tests/` structure and fixtures
- Integration tests mock Codex and MCP to avoid external side effects.
