# SPEC 000: Bootstrap the Codex ToolLoop monorepo (Bun + TS strict + Zod v4.3.5 + Vitest)

You are implementing the foundation repository scaffolding for Codex ToolLoop CLI.

## Objectives

1. Create a Bun workspace monorepo with strict TypeScript and consistent formatting.
2. Pin Zod to v4.3.5.
3. Add Vitest configuration and a working “hello unit test” and “hello type test.”
4. Add an `codex-toolloop doctor` skeleton command that prints environment checks (no Codex calls yet).
5. Provide a consistent internal package structure for later specs.

## Hard requirements

- Runtime: Bun for CLI execution.
- Language: TypeScript with `strict: true`.
- Zod: v4.3.5 pinned.
- Tests: Vitest configured. Tests must be runnable via a single top-level command.
- No `any` in TypeScript.

## Repository layout to create

Create this structure exactly:

```text
codex-toolloop/
  apps/
    cli/
      src/
        commands/
        index.ts
      package.json
      tsconfig.json
  packages/
    codex-toolloop/
      src/
        index.ts
      package.json
      tsconfig.json
    mcp/
      src/
        index.ts
      package.json
      tsconfig.json
    codex/
      src/
        index.ts
      package.json
      tsconfig.json
    workflows/
      src/
        index.ts
      package.json
      tsconfig.json
    testkit/
      src/
        index.ts
      package.json
      tsconfig.json
  tests/
    type/
      hello.test-d.ts
    unit/
      hello.test.ts
  docs/
    PRD.md
    ARCHITECTURE.md
    adr/
    specs/
  package.json
  tsconfig.json
  vitest.config.ts
  README.md
```

## Implementation steps

### Step 1: Root workspace

- Create root `package.json`:
  - mark `private: true`
  - use Bun workspaces for `apps/*` and `packages/*`
  - add scripts:
    - `dev:cli` runs the CLI entrypoint with bun
    - `test` runs Vitest using Node (invoked by Bun)
    - `lint` (optional for now) can be added later
    - `typecheck` runs `tsc -p tsconfig.json --noEmit`

### Step 2: Root tsconfig

- Create `tsconfig.json` at root with:
  - `strict: true`
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `moduleResolution` appropriate for modern bundlers
  - `target` modern (ES2022+)
  - `verbatimModuleSyntax: true`
  - references or path aliases are allowed but keep simple

Each package should have a `tsconfig.json` extending root and setting `outDir` only if needed.

### Step 3: Dependencies

Add these dependencies at root (or in packages where appropriate):

- `zod@4.3.5`
- `vitest`
- `typescript`

Keep later AI dependencies out of this spec unless needed by the skeleton.

### Step 4: Vitest setup

- Create `vitest.config.ts` at root:
  - Include `tests/unit/**/*.test.ts`
  - Enable `typecheck` tests:
    - include `tests/type/**/*.test-d.ts`
- Add `tests/unit/hello.test.ts`:
  - basic assertion
- Add `tests/type/hello.test-d.ts`:
  - use `expectTypeOf` to validate a simple type

### Step 5: CLI skeleton

- `apps/cli/src/index.ts` is the CLI entry:
  - parse args minimally (do not add heavy CLI framework yet)
  - implement `codex-toolloop doctor` command only:
    - check presence of `bun`, `node`, and `codex` binaries by attempting to spawn `--version`
    - print a clear pass/fail summary
    - exit code 0 if ok, non-zero if missing required binaries
- No external dependencies required; use Bun’s spawn APIs.

### Step 6: Package exports

- Each package in `packages/*` should export a single `index.ts` with a placeholder export (real code comes later).

## Acceptance criteria

1. `bun run dev:cli -- doctor` works and prints checks.
2. `bun run test` passes.
3. `bun run typecheck` passes.
4. Repository structure matches exactly.
5. No `any` types.

## Notes

- Do not implement Codex integration yet.
- Keep the scaffolding stable for later specs to build on.

## Deliverables

- All files created above, with correct content and runnable scripts.
