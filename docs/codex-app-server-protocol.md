---
title: Codex app-server protocol types (generation, upgrade, and integration)
date: 2026-01-23
related_adrs:
  - docs/adr/0013-codex-app-server-protocol-types.md
  - docs/adr/0002-model-backends.md
  - docs/adr/0006-testing-vitest.md
  - docs/adr/0008-security.md
related_specs:
  - docs/specs/020-codex-backends.md
  - docs/specs/023-codex-app-server-protocol.md
related_docs:
  - docs/research/codex-0.89.0-delta.md
  - packages/codex-app-server-protocol/README.md
upstream_docs:
  - https://developers.openai.com/codex/app-server/
  - https://developers.openai.com/codex/cli/reference/
---

This repo treats the Codex app-server protocol as a **versioned contract**.
The contract is derived from the Codex CLI generator and pinned to the version
in the root `package.json`.

## Where the protocol types live

Committed, generated TypeScript:

- `packages/codex-app-server-protocol/src/generated/`

Re-exported entrypoint:

- `packages/codex-app-server-protocol/src/index.ts`

Ignored (reproducible) JSON Schema output:

- `tools/codex-schemas/app-server-protocol/`

## Generation commands

From repo root:

```bash
pnpm install
pnpm codex:gen
```

What this does:

1. `codex app-server generate-ts --out packages/codex-app-server-protocol/src/generated`
2. `node scripts/codex-app-server-protocol-postprocess.mjs`
3. `codex app-server generate-json-schema --out tools/codex-schemas/app-server-protocol`

## Commit policy (definitive)

- **Commit** TypeScript artifacts under `packages/codex-app-server-protocol/`.
- **Do not commit** JSON schema bundles under `tools/codex-schemas/`.
- Do not hand-edit generated files. Regenerate instead.

## Runtime validation approach

We validate **JSON-RPC envelopes only** with Zod to avoid rejecting new fields:

- `packages/codex/src/app-server/schema.ts`

If full payload validation becomes necessary later, we can reintroduce JSON
Schema validation using the generated bundle in `tools/codex-schemas/`.

## Upgrade workflow (Codex app-server)

Upgrading Codex is not a dependency bump alone. It is a protocol update.

### Steps

1. Bump `@openai/codex` (root `package.json`).
2. Run `pnpm install`.
3. Regenerate protocol artifacts:

   ```bash
   pnpm codex:gen
   ```

4. Review generated diffs for new methods or fields.
5. Update integration code:

   - `packages/codex/src/app-server/**`
   - `packages/codex/src/app-server-backend.ts`

6. Update tests and docs to cover new features.
7. Verify:

   ```bash
   pnpm -s fix:typecheck
   ```

## CI check

CI enforces protocol drift safety:

```bash
pnpm -s codex:gen:check
```

This regenerates and verifies that committed TypeScript types match the pinned
Codex CLI version.

## Required integration updates when the protocol changes

- Update request/response payload builders in the app-server client.
- Preserve any new optional fields in event mapping.
- Add tests for new message variants or requests.
- Update specs/ADRs if the contract changes materially.

## Quick reminder: Codex SDK guidance

When the Codex SDK is involved in upgrades or behavior changes, re-check the
Codex SDK guidance in AGENTS.md and the `codex-sdk` skill. It contains the
workflow constraints for safe, reproducible updates and integration testing.
