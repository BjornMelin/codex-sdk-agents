# Repository Guidelines

## Setup

- Node.js 24+ (`.nvmrc`), pnpm (Corepack: `corepack enable`).
- Copy `.env.example` to `.env`; never commit real keys.

## Project Layout

- `apps/cli/`: CLI entrypoint (`apps/cli/src/index.ts`).
- `packages/`: workspace packages
  - `packages/codex-toolloop/`: core runtime scaffold
  - `packages/codex/`: Codex backends (app-server / exec / sdk)
  - `packages/mcp/`: MCP tool substrate + policy
  - `packages/workflows/`: workflow + routing utilities
  - `packages/testkit/`: fixtures/mocks/temp dirs
- `src/`: root exports + prototype workflows
- `tests/unit/`: Vitest runtime tests; `tests/type/`: `*.test-d.ts`
- `docs/`: PRD, ADRs (`docs/adr/`), specs (`docs/specs/`)
- `examples/`: runnable scripts (`pnpm examples:*`)

## Commands

```bash
pnpm install
pnpm dev:cli -- doctor
pnpm build
pnpm fix:typecheck  # required before finishing work
pnpm test
pnpm test:watch
pnpm examples:basic
```

## Codex app-server schema upgrades

- If pinned `@openai/codex` version changes, run `pnpm codex:gen` and update integration code for protocol deltas.
- Guide: `docs/codex-app-server-protocol.md` (ADR 0013/0014, SPEC 023/024-029).
- When Codex SDK is involved, use the `$codex-sdk` skill guide.

## Turborepo (Vercel)

- Use `turbo run build` on Vercel (filters inferred by root).
- In `turbo.json`, define `tasks.build.outputs` for each framework output dir.
  - Next.js: `[".next/**", "!.next/cache/**"]`
- Never include `.next/cache/**` in outputs.
- Declare task `env` + `globalEnv` to avoid stale cache hits.
- Validate remote caching locally: `turbo run build`, then inspect `node_modules/.cache/turbo`.

## Style

- TypeScript ESM (NodeNext), `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Biome (`biome.json`): 2-space indent, 80-col.
- Exported schemas use `...Schema`; keep exports small and explicit.

## Development Standards

Required before you finish:

`pnpm -s fix:typecheck` (runs `pnpm -s fix`, `pnpm -s typecheck`, `pnpm -s test`). Keep its changes.

Rules:

- **Biome**: no remaining diagnostics; no `lint/correctness/` or `lint/complexity/`; no broad suppressions; `biome-ignore` only for one line/block with reason + ADR/SPEC link.
- **Promises**: no floating promises; use `await`/`return`/`.catch`/`.then(..., onRejected)`.
- **AI imports** (`ai`, `@ai-sdk/*`, `@vercel/ai`, `openai`, `@openai/*`): no fire-and-forget; if detached with `void`, add a nearby comment and explicit error surfacing.
- **Tests**: keep helpers/shims/mocks in `tests/**` and test config only.
- **TSDoc** (TS/TSX): every changed/added export gets `/** ... */` (no blank line). One-sentence summary ending with `.`. Allowed tags only: `@remarks @param @typeParam @returns @throws @example @see @deprecated` (order matters). Use `@param name - desc` and no brace typing. If you add/modify a `throw` in an exported function, add `@throws`. For AI/RAG code (`/agents/`, `/rag/`, `/mcp/`, `/codex/` or AI/RAG imports), each exported function/class must include `@see` (ADR/SPEC path or official docs) or `@remarks` containing `ADR-` or `SPEC-`.
- **Tooling**: run `pnpm lint` (ESLint rules in `eslint.config.js`); AI/RAG `@see`/`@remarks` checks stay manual.
- **Characters**: no Unicode em dash U+2014; use `--`. Detect with `rg -n --pcre2 "\\x{2014}" .`.

## Commits

- Use Conventional Commits for commit messages: `feat:`, `fix:`, `docs:`, `chore:`. Prefer scopes when useful (e.g. `feat(mcp): ...`).

## pnpm-workspace.yaml allowBuilds

pnpm v10+ requires explicit allowlist entries in `pnpm-workspace.yaml#allowBuilds` for packages with lifecycle scripts. Keep this list minimal.

Current allowBuilds entries (defined in `pnpm-workspace.yaml`):

- `@biomejs/biome` -- Biome binary build; required for `pnpm -s fix`.
- `esbuild` -- Native bundler used by the build pipeline.

When adding a new entry:

1. Audit the package `package.json` lifecycle scripts and source.
2. Add the entry in `pnpm-workspace.yaml`, alphabetically, with a short inline comment.
3. Run `pnpm install`, then `pnpm build` and `pnpm -s fix:typecheck`.

Alternatives for temporary needs: prefer prebuilt binaries, vendoring (if license allows), or `pnpm approve-builds` during local debugging only.

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
