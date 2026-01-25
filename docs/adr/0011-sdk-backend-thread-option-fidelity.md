# ADR 0011: SDK backend thread defaults must match run options

## Status

Accepted

## Context

Codex ToolLoop exposes a backend-agnostic `CodexBackend` API (ADR 0002, SPEC 020).

The SDK backend (`@openai/codex-sdk`) runs prompts by creating a thread via `Codex.startThread()` and then streaming a turn with
`thread.runStreamed(prompt)`.

Thread-level defaults (model selection, reasoning effort, sandbox, approval) are configured on `startThread()` and persist for later turns on the same
thread. This makes thread reuse a correctness hazard when callers vary `CodexRunOptions` between runs.

Observed problems in the current implementation:

- `options.model` and `options.reasoningEffort` are not passed into `startThread()`, so runs may silently use stale SDK defaults.
- The SDK backend reports `CodexRunResult.model` as `options.model ?? defaultModel` even when the thread did not use that model.
- SDK file change items use `kind: add|update|delete`, but our normalizer only recognizes `added|modified|deleted|renamed`, downgrading SDK changes to
`unknown`.

## Decision

The SDK backend will treat model selection and reasoning effort as thread-level defaults and will:

1. Recreate the SDK thread whenever any thread-level option changes.
2. Forward `model` and `modelReasoningEffort` to `Codex.startThread()`.
3. Reject unsupported reasoning effort values for the SDK backend rather than silently ignoring them.
4. Normalize SDK file change kinds `add|update|delete` to our canonical `added|modified|deleted`.

## Alternatives considered

1. Keep a single thread per cwd and attempt to override model/effort per run.

   - Rejected: `@openai/codex-sdk` does not expose per-turn overrides for these fields; implementing this would require relying on unstable internals.

2. Silently coerce unsupported effort values (e.g., map `none` to unset/default).

   - Rejected: it violates caller intent and recreates the original bug class (misleading metadata).

## Consequences

- Correctness: requested model/effort is actually applied, and returned metadata matches reality.
- Predictability: callers can safely switch model/effort between runs without hidden thread state.
- Compatibility: SDK backend will throw for `reasoningEffort: "none"` (as of `@openai/codex-sdk@0.88.0`), even though other backends may support it.
  This is consistent with SPEC 020: `CodexReasoningEffort` is a superset and individual backends may reject unsupported values.

## Implementation notes

- Create a stable thread cache key across all relevant thread-level settings.
- Ensure event normalization maps SDK file change kinds into the shared `CodexEvent` contract.

## References

- ADR 0002: Multi-backend Codex integration (AI SDK app-server default)
- SPEC 020: Codex backends (v1)
- SPEC 021: SDK backend option fidelity (v1.1)
