# SPEC 000: Bootstrap the Codex ToolLoop monorepo (Node v24 LTS + pnpm + TS strict + Zod v4.3.6 + Vitest)

Status: **Implemented** (updated for Node v24 LTS + pnpm)

## Objectives

1. Establish a minimal, strict TypeScript monorepo structure.
2. Provide a bootstrap CLI entrypoint (`codex-toolloop doctor`).
3. Standardize lint/format (Biome) and tests (Vitest).
4. Keep the project Node-first to support AI SDK MCP STDIO transport (`Experimental_StdioMCPTransport`).

## Hard requirements

- Node.js **v24 LTS** runtime (ADR 0001).
- pnpm workspaces (ADR 0001).
- TypeScript strict, no `any`.
- Zod v4.3.6 for any schema validation.
- Biome for lint + format.
- Vitest for testing (ADR 0006).

## Repo layout

- `apps/`
  - `cli/` – bootstrap CLI
- `packages/`
  - `mcp/` – MCP platform
  - `codex/` – Codex backend integrations
  - `codex-toolloop/` – workflow engine + orchestration
  - `workflows/` – workflow definitions
- `docs/`
  - `adr/` – architecture decisions
  - `specs/` – system specifications

## Required root scripts

Root `package.json` scripts (required):

- `pnpm dev:cli -- doctor`
- `pnpm check` → `typecheck` + `lint` + `test`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format`
- `pnpm fix`

Examples are run via `tsx`:

- `pnpm examples:basic`
- `pnpm examples:stream`
- `pnpm examples:structured`

## pnpm v10 build-script allowlist

pnpm v10 blocks dependency lifecycle scripts by default.

This repo maintains a minimal allowlist in `pnpm-workspace.yaml` (`allowBuilds`) to ensure required build steps (e.g. `esbuild`, `@biomejs/biome`) run during install.

If install fails with ignored build scripts, update the allowlist and commit the change.

## Bootstrap CLI: `codex-toolloop doctor`

The bootstrap CLI must:

- exist at `apps/cli/src/index.ts`
- implement `doctor` as the only command for this phase
- check presence and basic functionality of:
  - `node` (must be >= 24)
  - `pnpm`
  - `codex`

## Acceptance criteria

1. `pnpm dev:cli -- doctor` works and prints checks.
2. `pnpm test` passes.
3. `pnpm typecheck` passes.
4. `pnpm lint` passes.

## References

- Node.js release lifecycle (verify v24 LTS): <https://nodejs.org/en/about/previous-releases>
- pnpm workspaces: <https://pnpm.io/workspaces>
- pnpm Corepack install: <https://pnpm.io/installation>
- pnpm supply-chain security defaults: <https://pnpm.io/supply-chain-security>
- AI SDK MCP stdio transport (`Experimental_StdioMCPTransport`): <https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-stdio-transport>
