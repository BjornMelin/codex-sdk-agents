# ADR 0002: Multi-backend Codex integration (AI SDK app-server default)

## Status

Accepted

## Context

Codex ToolLoop needs:

- Codex as the primary coding model using ChatGPT subscription auth.
- Strong support for multi-step sessions, tool visibility, and course correction.
- Scriptable and deterministic modes for automation pipelines.

Codex integration options:

- AI SDK Codex CLI provider: simplest, but more “one-shot” oriented.
- AI SDK Codex App Server provider: supports persistent threads, but no
  mid-execution injection.
- Codex exec: stable CLI automation with JSONL and output schema.
- Codex TypeScript SDK: programmatic control and resumable threads.

Constraints:

- We want to leverage existing Codex CLI authentication.
- We want consistent event logs and artifacts.

## Decision

Codex ToolLoop will implement three backends behind a single `CodexBackend` interface:

1. Default: AI SDK Codex App Server provider backend

   - For interactive multi-step runs
   - For persistent thread mode
   - For interrupts (injection support removed as of 2026-01-23; see amendment note)

2. Complement: Exec backend (codex exec)

   - For scripts, CI-like flows, and structured outputs
   - For capturing full JSONL event streams

3. Complement: SDK backend (@openai/codex-sdk)

   - For programmatic integrations and experiments
   - For richer control in TS when needed

Codex ToolLoop chooses the backend per workflow:

- `feature-dev` uses app-server by default.
- `audit` may use exec for deterministic structured outputs.
- `research-only` may use app-server or sdk depending on needs.

## Alternatives considered

1. Only app-server backend

   - Pros: simplifies architecture
   - Cons: loses the simplicity and composability of exec for scripting

2. Only exec backend

   - Pros: easy automation
   - Cons: weaker mid-execution correction, harder interactive experiences

3. Only Codex SDK

   - Pros: strong programmatic control
   - Cons: less aligned with the AI SDK UI and provider ecosystem, and introduces a parallel API surface to maintain

## Consequences

- More implementation complexity (multiple backends).
- Much better “fit” across use cases:
  - workflows can use the best execution mode.
  - full logs and structured outputs are always possible.

## Implementation notes

- Define a stable normalized event model in packages/codex:
  - `CodexEvent` union
  - Parsers from exec JSONL
  - Adapters from app-server streaming
- Persist:
  - thread IDs and run IDs for resumption
- Provide a “backend capability matrix” to guide workflow selection.

## References (informational)

- Codex exec supports JSONL events and output schemas.
- AI SDK Codex App Server provider supports persistent threads (no injection).

## Amendments

### 2026-01-21 -- Codex backend v1 implemented

This ADR is implemented end-to-end via SPEC 020 (`packages/codex`).

- **Default backend remains app-server**. The initial v1 implementation used the AI SDK community provider `ai-sdk-provider-codex-app-server` and exposed a session API (`injectMessage`, `interrupt`) plus per-call options.
- **Exec backend** uses `codex exec --json` for streaming JSONL events and supports deterministic structured outputs via `--output-schema` + `--output-last-message`.
- **MCP server configuration** can be passed to Codex both via app-server provider settings and via Codex CLI config overrides (`--config key=value`) for the exec backend.

Notes:

- The app-server provider currently types `reasoningEffort` as `none | low | medium | high`; higher effort values (e.g., `xhigh`) should use the exec backend (or Codex-native config) until provider support expands.

References:

- AI SDK codex app-server provider: <https://ai-sdk.dev/providers/community-providers/codex-app-server#codex-cli-app-server-provider>
- Codex CLI reference: <https://developers.openai.com/codex/cli/reference/>
- Codex config reference: <https://developers.openai.com/codex/config>

### 2026-01-23 -- App-server backend migrated to internal schema-driven client

The app-server backend no longer relies on the AI SDK community provider.

- **Default backend remains app-server**, but is now implemented as a JSONL-over-stdio client for `codex app-server`.
- **Runtime safety improved**: JSON-RPC envelopes are validated with Zod while preserving forward-compatible fields.
- **Mid-execution injection removed**: the backend API no longer supports `inject()` for app-server v2 in this repo; interruption is supported via `turn/interrupt`.

References:

- Codex app-server docs: <https://developers.openai.com/codex/app-server/>
- ADR 0013: Protocol types policy -- `docs/adr/0013-codex-app-server-protocol-types.md`
- SPEC 023: Protocol workflow -- `docs/specs/023-codex-app-server-protocol.md`
