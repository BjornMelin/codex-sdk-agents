---
id: ADR-0013
title: Commit Codex app-server protocol TypeScript artifacts only
status: Accepted
date: 2026-01-23
related_adrs:
  - docs/adr/0002-model-backends.md
  - docs/adr/0006-testing-vitest.md
  - docs/adr/0008-security.md
  - docs/adr/0012-codex-app-server-schema-artifacts.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/023-codex-app-server-protocol.md
related_docs:
  - docs/codex-app-server-protocol.md
  - docs/research/codex-0.89.0-delta.md
  - packages/codex-app-server-protocol/README.md
---

## Context

Codex app-server is a JSON-RPC-over-stdio protocol that evolves over time:

- new methods appear
- new fields are added to existing items
- server-request shapes expand

We need two things to keep integration safe:

1. Strong TypeScript typing that matches the pinned Codex CLI version.
2. Runtime validation that rejects malformed envelopes without hard-failing on
   forward-compatible fields.

Codex provides CLI generators for both TypeScript types and JSON Schema bundles.
Each output is specific to the Codex version you ran.

The previous policy (ADR-0012) committed **both** the TypeScript and JSON Schema
artifacts. As we integrated app-server v2, we standardized on Zod envelope
validation and stopped using the JSON Schema bundle at runtime.

## Decision

We will **commit only** the generated TypeScript protocol types and treat JSON
Schema output as a reproducible but ignored artifact.

Specifically:

1. Commit generated TypeScript artifacts under:

   - `packages/codex-app-server-protocol/src/generated/`

2. Generate JSON Schema bundles into a **git-ignored** directory:

   - `tools/codex-schemas/app-server-protocol/`

3. Keep only the latest pinned Codex version's artifacts in the repo.

4. Postprocess generated TypeScript to satisfy NodeNext ESM resolution:

   - `scripts/codex-app-server-protocol-postprocess.mjs`

5. Perform runtime validation only on JSON-RPC envelopes using Zod:

   - `packages/codex/src/app-server/schema.ts`

6. Enforce protocol drift checks in CI:

   - `pnpm -s codex:gen:check`

This decision **supersedes ADR-0012**.

## Consequences

### Positive

- Smaller diffs and less churn in version bumps.
- TypeScript stays authoritative for compile-time safety.
- JSON Schema generation remains available when needed (debugging or tooling),
  without committing large bundles.

### Negative

- Runtime validation is limited to JSON-RPC envelope integrity rather than full
  schema validation of every payload.
- Teams that need full JSON Schema validation must opt-in explicitly.

## Alternatives considered

1. Commit both TypeScript and JSON Schema bundles (ADR-0012)

   - Rejected due to size and churn without corresponding runtime usage.

2. Generate everything on demand only

   - Rejected: makes local development less reproducible and weakens review
     visibility on protocol changes.

3. Commit only JSON Schema and derive TypeScript from it

   - Rejected: loses fidelity vs the upstream TypeScript output and adds extra
     generation complexity.

## Implementation notes

- Regeneration commands are centralized in `pnpm codex:gen`.
- The schema output is still generated (ignored) to verify the CLI is correct.
- If we later need runtime validation of full payloads, we can adopt the JSON
  Schema bundle as an optional runtime dependency and update SPEC-023.

## Amendments

- 2026-01-23: Adopted and supersedes ADR-0012 for Codex app-server v2 upgrades.
