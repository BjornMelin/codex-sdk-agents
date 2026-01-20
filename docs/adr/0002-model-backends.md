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
- AI SDK Codex App Server provider: supports persistent threads and mid-execution injection.
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
- For injection and interrupts

1. Complement: Exec backend (codex exec)

- For scripts, CI-like flows, and structured outputs
- For capturing full JSONL event streams

1. Complement: SDK backend (@openai/codex-sdk)

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

1. Only exec backend

- Pros: easy automation
- Cons: weaker mid-execution correction, harder interactive experiences

1. Only Codex SDK

- Pros: strong programmatic control
- Cons: less aligned with the AI SDK UI and provider ecosystem, and may have Bun compatibility risks

## Consequences

- More implementation complexity (multiple backends).
- Much better “fit” across use cases:
  - workflows can use the best execution mode
  - full logs and structured outputs are always possible

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
- AI SDK Codex App Server provider supports injection and persistent threads.
