---
title: Codex app-server schemas (how to generate, upgrade, and integrate)
date: 2026-01-23
related_adrs:
  - docs/adr/0012-codex-app-server-schema-artifacts.md
  - docs/adr/0006-testing-vitest.md
  - docs/adr/0008-security.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/022-codex-app-server-schemas.md
---

This repo commits Codex app-server protocol artifacts so that:

- TypeScript types match the pinned Codex CLI version
- runtime validation can be performed on JSONL protocol messages
- upgrades are reproducible and reviewable

For policy and requirements, see:

- ADR 0012: `docs/adr/0012-codex-app-server-schema-artifacts.md`
- SPEC 022: `docs/specs/022-codex-app-server-schemas.md`

## Where the schemas live

Schemas are stored in this workspace package:

- `packages/codex-app-server-schema/ts/` -- generated TypeScript types
- `packages/codex-app-server-schema/json-schema/` -- generated JSON Schema bundle

Consumer code should import protocol types from:

- `@codex-toolloop/codex-app-server-schema`

Consumer code should load JSON schema files via the package exports:

- `@codex-toolloop/codex-app-server-schema/json-schema/<File>.json`

## How to regenerate (current pinned Codex version)

1. Ensure the repo dependencies are installed:

    ```bash
    pnpm install
    ```

2. Regenerate schemas using the workspace-local Codex CLI:

    ```bash
    pnpm codex:app-server:schema:gen
    ```

3. Verify:

    ```bash
    pnpm -s fix:typecheck
    ```

## How to upgrade Codex app-server protocol support

An upgrade is not "just bump a dependency".

It is a protocol contract change, and must include both regeneration and integration updates.

### Step-by-step

1. Bump `@openai/codex` in the repo root `package.json`.
2. Run `pnpm install`.
3. Regenerate artifacts:

    ```bash
    pnpm codex:app-server:schema:gen
    ```

4. Review the generated diffs:
   - new methods and params
   - new notification or server-request variants
   - new optional fields (must be preserved end-to-end)
5. Update app-server integration code:
   - `packages/codex/src/app-server/schema.ts` (schema loading and Ajv settings if needed)
   - `packages/codex/src/app-server/process.ts` (wire transport and routing)
   - `packages/codex/src/app-server-backend.ts` (behavioral mapping into our normalized events)
6. Update unit tests to cover newly handled protocol surfaces and invariants.
7. Run `pnpm -s fix:typecheck`.

## Important rules

- Do not hand-edit generated files under `packages/codex-app-server-schema/ts/` or `json-schema/`.
- Do not run formatters over generated files; regenerate them.
- Do not spawn real `codex app-server` processes from tests (use mocks/stubs).
- Treat JSONL messages as untrusted input; validate and handle unknown fields safely.
