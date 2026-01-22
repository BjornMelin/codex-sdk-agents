# Repository Guidelines

## Setup

- Node.js 24+ (`.nvmrc`), pnpm (Corepack: `corepack enable`).
- Copy `.env.example` to `.env`; never commit real keys.

## Project Structure & Module Organization

- `apps/cli/`: CLI entrypoint and UX (`apps/cli/src/index.ts`)
- `packages/`: workspace packages
  - `packages/codex-toolloop/`: core runtime scaffold
  - `packages/codex/`: Codex backends (app-server / exec / sdk)
  - `packages/mcp/`: MCP tool substrate + policy
  - `packages/workflows/`: workflow and routing utilities
  - `packages/testkit/`: fixtures/mocks/temp dirs
- `src/`: root exports and prototype workflows
- `tests/unit/`: Vitest runtime tests; `tests/type/`: type-level `*.test-d.ts`
- `docs/`: PRD, architecture, ADRs (`docs/adr/`), specs (`docs/specs/`)
- `examples/`: runnable scripts (`pnpm examples:*`)

## Build, Test, and Development Commands

```bash
pnpm install
pnpm dev:cli -- doctor
pnpm build
pnpm fix:typecheck  # required before finishing work
pnpm test
pnpm test:watch
pnpm examples:basic
```

## Turborepo (Vercel)

- Use `turbo build` on Vercel (filters inferred by root).
- Ensure `turbo.json` defines `pipeline.build.outputs` for each framework output dir.
  - Next.js: `[".next/**", "!.next/cache/**"]`
- Never include `.next/cache/**` in outputs.
- Declare task `env` and `globalEnv` in `turbo.json` to avoid stale cache hits.
- Validate remote caching locally with `turbo run build` and inspect `node_modules/.cache/turbo`.

## Coding Style & Naming Conventions

- TypeScript ESM (NodeNext), `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Biome formatting/linting (`biome.json`): 2-space indent, 80-col.
- Naming: exported schemas use `...Schema`; keep exports small and explicit.

## Development Standards

Required before you mark a task done:

`pnpm -s fix:typecheck`

This runs `pnpm -s fix`, `pnpm -s typecheck`, and `pnpm -s test`. Commit any changes it makes.

Rules:

- **Biome**:
  - After autofix, no remaining diagnostics.
  - Do not ship `lint/correctness/` or `lint/complexity/`.
  - No broad suppressions.
  - `biome-ignore` only for a single line/block, with reason + link to issue or ADR/SPEC.
- **Promises**:
  - No floating promises.
  - Handle with `await`, `return`, `.catch(...)`, or `.then(..., onRejected)`.
  - In files importing/referencing `ai`, `@ai-sdk/*`, `@vercel/ai`, `openai`,
    `@openai/*`, avoid fire-and-forget; if you detach with `void`, add an
    adjacent comment and an explicit error surfacing path.
- **Tests**:
  - Do not add test-only helpers/shims/mocks/branches to production source.
  - Keep scaffolding in `tests/**` and test config.
- **TSDoc (TS/TSX)**:
  - Each changed/added export needs an immediately preceding `/** ... */`
    (no blank line).
  - Summary: one sentence ending with `.`.
  - Tags: allow only `@remarks @param @typeParam @returns @throws @example @see
    @deprecated` (in that order).
  - `@param name - description`; no brace-typing (`@param {`, `@returns {`).
  - If you add/modify `throw` inside an exported function, add `@throws` (one
    per exception type).
  - For AI/RAG code (paths `/agents/` `/rag/` `/mcp/` `/codex/` or AI/RAG
    imports), each exported function/class also needs `@see` (ADR/SPEC path or
    official docs URL) or `@remarks` containing `ADR-` or `SPEC-`.
  - Tooling: run `pnpm lint:docs` (ESLint with TSDoc/JSDoc rules via
    `eslint.config.js`) for syntax and tag ordering; AI/RAG `@see`/`@remarks`
    checks remain manual.
- **Characters**:
  - Do not introduce Unicode em dash U+2014; use `--`.
  - Detect with `rg -n --pcre2 "\\x{2014}" .`.

## Commits & PRs

- Use Conventional Commits for every commit and PR title: `feat:`, `fix:`, `docs:`, `chore:`. Prefer a scope when useful (example: `feat(mcp): ...`).
- pnpm v10 blocks lifecycle scripts by default; keep `pnpm-workspace.yaml#allowBuilds` minimal and audited (or use `pnpm approve-builds`).

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->
