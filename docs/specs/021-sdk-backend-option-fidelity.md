# SPEC 021 -- SDK backend option fidelity (v1.1)

Status: **Completed** (2026-01-22)

## Goal

Ensure the `sdk` backend:

- Actually uses the caller-requested `model` and `reasoningEffort`.
- Returns accurate run metadata (`CodexRunResult.model`).
- Emits normalized `codex.file.changed.kind` values (no silent `unknown` downgrade for SDK events).

## Context

Codex ToolLoop supports multiple Codex execution backends behind one stable API (SPEC 020, ADR 0002).

The TypeScript Codex SDK (`@openai/codex-sdk`) applies certain settings (notably `model` and `modelReasoningEffort`) at thread creation time via
`Codex.startThread({ ...threadOptions })`. These options persist for subsequent turns on that thread.

The `sdk` backend currently caches a single thread per working directory and does not forward `options.model` or `options.reasoningEffort` into
`startThread()`. This causes:

- Runs to silently use the SDK thread defaults instead of the requested model/effort.
- `CodexRunResult.model` to be misleading (it reports the requested model even if it was not used).

Additionally, SDK file change events use `kind: add|update|delete`, but our event normalizer only recognizes `added|modified|deleted|renamed`, causing
file change kind to be reported as `unknown` to consumers.

## Upstream evidence (local, opensrc)

Inspected versions (from `opensrc list`):

- `@openai/codex-sdk@0.88.0`
- `@openai/codex@0.88.0`
- `ai@6.0.48`
- `zod@4.3.6`

Key details:

- `@openai/codex-sdk@0.88.0` defines `ThreadOptions.model` and `ThreadOptions.modelReasoningEffort` as thread options.
- `@openai/codex-sdk@0.88.0` defines file change kinds as `add|update|delete`.
- `@openai/codex-sdk@0.88.0` defines `ModelReasoningEffort` as `minimal|low|medium|high|xhigh` (does not include `none`).

## Decision framework (major choice)

We must choose how to honor per-run `model` and `reasoningEffort` for the SDK backend.

Options:

A) Keep one SDK thread per cwd and attempt per-run overrides (not supported by the SDK thread API; would require unsupported internals).

B) Treat `model` and `modelReasoningEffort` as thread-level defaults. Recreate the SDK thread whenever any thread-level setting changes, and pass the
requested model/effort to `startThread()` (supported by public SDK types).

Weighted scoring (10 max; threshold >= 9.0 required):

- Solution leverage (35%): A=3, B=9
- Application value (30%): A=4, B=9.5
- Maintenance and cognitive load (25%): A=5, B=9
- Architectural adaptability (10%): A=4, B=9

Total:

- A: 4.1/10
- B: 9.1/10 (selected)

## Requirements

### 1) Honor requested model/effort

- `options.model` MUST be applied by the SDK backend (not just reported).
- `options.reasoningEffort` MUST be applied when it is representable in SDK thread options.
- If `options.reasoningEffort` is set to a value not supported by `@openai/codex-sdk`, the backend MUST throw a `CodexBackendError` (do not silently
ignore or coerce).

Supported reasoning efforts for SDK backend:

- `minimal | low | medium | high | xhigh`

Explicitly unsupported for SDK backend (as of `@openai/codex-sdk@0.88.0`):

- `none`

### 2) Thread lifecycle semantics

The SDK backend MUST reuse a thread only when all thread-level settings are identical:

- `cwd`
- `model`
- `modelReasoningEffort` (or unset)
- `sandboxMode`
- `approvalPolicy`
- `skipGitRepoCheck`

If any of these change between runs, the backend MUST create a new thread via `codex.startThread(...)`.

### 3) Accurate result metadata

The SDK backend MUST return `CodexRunResult.model` equal to the effective model used by the thread:

- `effectiveModel = options.model ?? defaultModel`

### 4) File change kind normalization

The normalized `codex.file.changed.kind` MUST map SDK kinds as:

- `add` -> `added`
- `update` -> `modified`
- `delete` -> `deleted`

Existing values MUST be preserved:

- `added | modified | deleted | renamed` (pass-through)
- Any other kind maps to `unknown`

## Implementation plan

### Code changes

1. `packages/codex/src/sdk-backend.ts`
   - Compute an explicit thread configuration key that includes all thread-level settings.
   - Create/recreate the SDK thread when the key changes.
   - Pass `model` and `modelReasoningEffort` into `Codex.startThread(...)`.
   - Validate `options.reasoningEffort` and throw on unsupported values.
   - Return `model: effectiveModel` in the `CodexRunResult`.

2. `packages/codex/src/exec-events.ts`
   - Extend `normalizeFileChangeKind` to recognize SDK `add|update|delete`.

### Tests (Vitest)

Add unit tests to prevent regressions:

- `tests/unit/codex-sdk-backend.test.ts`
  - Mocks `@openai/codex-sdk` to assert `startThread()` receives `model` and `modelReasoningEffort`.
  - Verifies that changing any thread-level setting causes a new thread to be created.
  - Verifies that unsupported reasoning effort values throw a `CodexBackendError`.

- `tests/unit/codex-exec-events.test.ts`
  - Verifies `normalizeFileChangeKind` maps `add|update|delete` correctly.

## Documentation updates

- Update `docs/specs/020-codex-backends.md`:
  - Clarify SDK backend model/effort behavior and the supported `reasoningEffort` subset.
  - Note the `add|update|delete` mapping for SDK file change events.

## Verification plan

Required (repo standard):

- `pnpm -s fix:typecheck`

## Implementation

- `packages/codex/src/sdk-backend.ts`
- `packages/codex/src/exec-events.ts`
- `tests/unit/codex-sdk-backend.test.ts`
- `tests/unit/codex-exec-events.test.ts`

## References

- ADR 0002: Multi-backend Codex integration (AI SDK app-server default)
- SPEC 020: Codex backends (v1)
- OpenAI Codex App Server docs (threads/turns/items): <https://developers.openai.com/codex/app-server/>
- OpenAI Codex config reference: <https://developers.openai.com/codex/config-reference/>
- `@openai/codex-sdk` README: <https://github.com/openai/codex/blob/main/sdk/typescript/README.md>
