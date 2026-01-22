# Repository Guidelines

## Project Structure & Module Organization

- Monorepo root contains `apps/`, `packages/`, `tests/`, and `examples/`.
- This package lives at `packages/codex/` with source in `packages/codex/src/`.
- Build output for this package goes to `packages/codex/dist/` (TypeScript `outDir`).
- Tests live in `tests/unit/` and some `src/**/*.test.ts` files at the repo root.

## Build, Test, and Development Commands

Run commands from the repo root unless noted.

- `pnpm build`: TypeScript build for the entire workspace.
- `pnpm -C packages/codex build`: Build only this package to `packages/codex/dist/`.
- `pnpm test` / `pnpm test:watch`: Run Vitest once or in watch mode.
- `pnpm lint`: Run Biome lint checks.
- `pnpm format`: Apply Biome formatting.
- `pnpm check`: Typecheck + lint + tests in one pass.

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Prefer strict typing and explicit exports.
- Formatting: Biome with 2-space indentation and 80-character line width.
- File naming: use kebab-case (e.g., `exec-backend.ts`).
- Code naming: camelCase for variables/functions, PascalCase for types/classes.

## Testing Guidelines

- Framework: Vitest.
- Test files use `*.test.ts` naming.
- Place unit tests in `tests/unit/` unless they naturally live alongside source in `src/`.
- Keep tests focused and deterministic; avoid reliance on network or time.

## Environment & Tooling

- Package manager: `pnpm@10.28.1` (see root `package.json`).
- Node.js: `>=24.0.0`.
