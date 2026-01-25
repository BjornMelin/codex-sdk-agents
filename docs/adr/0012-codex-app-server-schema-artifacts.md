---
id: ADR-0012
title: Commit Codex app-server generated protocol artifacts
status: Superseded
date: 2026-01-23
related_adrs:
  - docs/adr/0002-model-backends.md
  - docs/adr/0006-testing-vitest.md
  - docs/adr/0008-security.md
  - docs/adr/0009-dynamic-tool-loading.md
  - docs/adr/0013-codex-app-server-protocol-types.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/022-codex-app-server-schemas.md
related_docs:
  - docs/research/codex-0.89.0-delta.md
  - packages/codex-app-server-protocol/README.md
---

> Superseded by ADR-0013: `docs/adr/0013-codex-app-server-protocol-types.md`.

## Context

Codex app-server is a JSON-RPC-over-stdio protocol that is intentionally forward-compatible:

- new fields can appear in messages
- new methods can be added
- message variants can grow over time

This repo needs two complementary properties to integrate safely:

1. Compile-time safety for request/response payload shapes.
2. Runtime validation of untrusted JSON arriving over stdio.

Codex provides a CLI generator for both:

- `codex app-server generate-ts` (TypeScript type definitions)
- `codex app-server generate-json-schema` (JSON Schema bundle)

Both outputs are version-specific to the Codex CLI binary used.

Repo constraints:

- We use TypeScript ESM with `moduleResolution: "NodeNext"`, which requires explicit file extensions in relative imports.
- We do not want formatting/lint churn in generated artifacts.
- Tests must not spawn real Codex processes (ADR 0006).

## Decision

We will **commit** the Codex-generated protocol artifacts to the repo as a first-class, reviewable "wire format contract", and treat them as the source of truth for the current pinned Codex version.

Specifically:

1. Commit both generated outputs:

   - `packages/codex-app-server-schema/ts/` (TypeScript types)
   - `packages/codex-app-server-schema/json-schema/` (JSON Schema bundle)

2. Keep **only one schema set** in the repo: the one matching the pinned Codex CLI version in `package.json`.

   - If we later need multi-version support, we will create versioned schema packages (example: `codex-app-server-schema-0_89`) and migrate call sites explicitly.

3. Treat the generated directories as generated source of truth:

   - do not hand-edit generated files
   - regenerate via `pnpm codex:app-server:schema:gen`
   - any post-processing must be deterministic and run as part of regeneration

4. Make the generated TS compatible with this repo's NodeNext resolution:

   - run `scripts/codex-app-server-schema-postprocess.mjs` after `generate-ts` to rewrite relative specifiers to include `.js` (and handle directory imports like `./v2/index.js`)

5. Use the JSON Schema bundle for runtime validation:

   - compile Ajv validators at runtime from the committed bundle
   - validation is a safety layer, not an excuse to drop type checking

## Consequences

### Positive

- Upgrading Codex becomes a straightforward, reviewable change:
  - bump version
  - regenerate
  - review diffs
  - update integration code for any protocol deltas
- Runtime validation reduces the chance of silently accepting malformed protocol messages.
- The repo can run tests deterministically without network and without requiring a globally installed Codex binary.

### Negative

- The repo contains a large number of generated files.
- Upgrades produce noisy diffs (mitigated by committing only the current version, and by avoiding formatter churn).

## Alternatives considered

1. Do not commit generated artifacts; generate in CI or at install time

   - Rejected: makes local development less reproducible and introduces implicit "generator version" drift.

2. Commit only JSON Schema and derive TypeScript types from it

   - Rejected: type generation tends to be less ergonomic and can lose intent present in upstream types.

3. Commit only TypeScript and rely on type checking without runtime validation

   - Rejected: the protocol is untrusted runtime input; schema validation is needed (ADR 0008).

## Implementation notes

- Regeneration is centralized in `pnpm codex:app-server:schema:gen`.
- `packages/codex/src/app-server/schema.ts` loads schemas from `@codex-toolloop/codex-app-server-schema/json-schema/*` and compiles Ajv validators.
- The Codex app-server integration should reference these artifacts instead of duplicating protocol types manually.

## Amendments

- 2026-01-23: Adopted for Codex app-server v2 integration and schema generation workflow.
