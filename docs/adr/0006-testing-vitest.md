# ADR 0006: Vitest standardization on Node.js

Status: **Accepted**

## Context

This repo needs a fast, TypeScript-friendly test runner with strong ESM support.

The project is Node.js-first (ADR 0001) and uses:

- TypeScript (`strict: true`)
- Biome for lint/format

We want:

- deterministic CI-friendly `test` command
- first-class typecheck in tests (Vitest's type tests)
- no reliance on runtime-specific built-in test runners

## Decision

- Standardize on **Vitest** as the test runner.
- Run Vitest directly in Node via pnpm scripts:
  - `pnpm test` → `vitest run`
  - `pnpm test:watch` → `vitest`

## Consequences

- All tests live under:
  - `tests/unit/**/*.test.ts`
  - optionally `src/**/*.test.ts` for package-local tests
- Type-only tests live under `tests/type/**/*.test-d.ts` and are executed via Vitest's built-in typecheck mode.

## References

- Vitest documentation: <https://vitest.dev/guide/>
- pnpm workspaces: <https://pnpm.io/workspaces>
