---
id: SPEC-022
title: Codex app-server protocol schemas and upgrade workflow
status: Completed
date: 2026-01-23
related_adrs:
  - docs/adr/0012-codex-app-server-schema-artifacts.md
  - docs/adr/0002-model-backends.md
  - docs/adr/0006-testing-vitest.md
  - docs/adr/0008-security.md
related_specs:
  - docs/specs/020-codex-backends.md
related_docs:
  - docs/research/codex-0.89.0-delta.md
upstream_docs:
  - https://developers.openai.com/codex/app-server/
  - opensrc/repos/github.com/openai/codex/codex-rs/app-server/README.md
---

## Goal

Make Codex app-server integration:

- version-pinned (schemas match the Codex CLI we run)
- strongly typed (no hand-rolled protocol types)
- runtime validated (Ajv against committed JSON Schema bundle)
- reproducible to upgrade (clear steps, clear files to touch, clear verification)

## Non-goals

- Defining the full Codex app-server protocol surface (use upstream generated artifacts).
- Supporting multiple Codex protocol versions simultaneously (single pinned version only).

## Terminology

- **Codex CLI version**: the version of `@openai/codex` installed in the repo root (provides the `codex` binary).
- **Schema artifacts**: generated TypeScript and JSON Schema outputs from `codex app-server generate-*`.
- **Postprocess**: deterministic rewrite step that makes generated TS compatible with `moduleResolution: "NodeNext"`.

## Source of truth

This repo treats the following as source of truth:

1. Codex CLI generator output, committed in:
   - `packages/codex-app-server-schema/ts/`
   - `packages/codex-app-server-schema/json-schema/`
2. Upstream docs and open-source implementation for semantics:
   - `https://developers.openai.com/codex/app-server/`
   - `opensrc/repos/github.com/openai/codex/codex-rs/app-server/README.md`

## Directory layout

### Schema package

`packages/codex-app-server-schema/` is a workspace package that contains only:

- generated artifacts
- a small `package.json` defining `exports` for schema files and types
- a runtime `index.js` stub so NodeNext can resolve the package

It is consumed by `packages/codex` for:

- TypeScript imports of protocol types
- runtime loading of JSON schema files via `createRequire().resolve(...)`

## Generation commands (reproducible)

### Preconditions

- Run from repo root.
- Ensure `@openai/codex` is installed (repo devDependency).
- Use the workspace-local binary (not a global Codex install).

### Generate

Run:

```bash
pnpm install
pnpm codex:app-server:schema:gen
```

This command:

1. Runs `codex app-server generate-ts --out packages/codex-app-server-schema/ts`
2. Runs `node scripts/codex-app-server-schema-postprocess.mjs`
3. Runs `codex app-server generate-json-schema --out packages/codex-app-server-schema/json-schema`

### Postprocess details

The Codex TS generator emits relative imports without explicit file extensions (example: `from "./ThreadId"`).

This repo uses `moduleResolution: "NodeNext"`, which requires explicit extensions in ESM relative imports.

`scripts/codex-app-server-schema-postprocess.mjs` rewrites generated files to:

- append `.js` to extensionless relative specifiers
- rewrite directory module specifiers to `.../index.js` (example: `./v2/index.js`)

The postprocess step is deterministic and must run only during regeneration.

## Commit policy (definitive)

1. The generated schema artifacts are committed to git.
2. Do not hand-edit generated artifacts.
3. Do not apply formatters to generated artifacts; regenerate instead.
4. Keep only the latest pinned Codex version's artifacts in the repo.
5. Schema upgrades must be accompanied by:
   - a schema regeneration commit
   - integration code changes as needed for protocol deltas
   - tests validating the updated assumptions

## Runtime validation (Ajv)

### Why

App-server messages arrive over stdio, and must be treated as untrusted runtime input (ADR 0008).

### How

- `packages/codex/src/app-server/schema.ts` loads JSON Schema files from
  `@codex-toolloop/codex-app-server-schema/json-schema/*`.
- Validators are compiled once per process (singleton cache).
- Ajv is configured with:
  - `strict: false` to tolerate upstream schema patterns
  - `validateFormats: false` to avoid requiring custom format registrations for Rust-derived formats like `int64`

## Upgrade workflow (Codex app-server protocol)

When upgrading Codex app-server support (example: from 0.89.x to 0.90.x):

1. Bump `@openai/codex` (repo root) to the desired version.
2. Run `pnpm install`.
3. Run `pnpm codex:app-server:schema:gen`.
4. Review schema diffs:
   - new methods
   - added/removed fields
   - changed unions and item variants
5. Update integration code in `packages/codex/src/app-server/**`:
   - update request builders for new required params
   - update notification/request handling for new variants
   - preserve optional fields for forward compatibility
6. Update any docs/research artifacts if the change is non-trivial:
   - `docs/research/codex-<version>-delta.md` (when doing a major protocol jump)
7. Run verification:

```bash
pnpm -s fix:typecheck
```

## Required invariants

The following must remain true after any schema upgrade:

- The repo does not depend on a globally installed `codex` binary.
- Schema generation uses the workspace-local `codex` binary.
- Tests do not spawn real `codex app-server` processes (ADR 0006).
- No production code manually redefines protocol unions already provided by the generator.
- Runtime validation uses the committed schema bundle (no downloading at runtime).

## Files to touch during upgrades (checklist)

- `package.json` (bump `@openai/codex`)
- `pnpm-lock.yaml`
- `packages/codex-app-server-schema/ts/**` (regenerated)
- `packages/codex-app-server-schema/json-schema/**` (regenerated)
- `packages/codex/src/app-server/**` (integration changes as required)
- tests under `tests/unit/**` that assert protocol behavior
- docs: this spec and any impacted specs/ADRs
