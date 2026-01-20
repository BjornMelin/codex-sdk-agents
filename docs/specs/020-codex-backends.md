# SPEC 020: Codex backends (AI SDK app-server default + exec JSONL + optional TS SDK)

You are implementing `packages/codex` which provides a unified interface for calling Codex in three modes:

- app-server mode via AI SDK provider
- exec mode via codex CLI subprocess
- optional direct TS SDK mode

## Objectives

1. Provide a single `CodexBackend` interface with consistent inputs/outputs and a normalized event stream.
2. Implement:
   - `AppServerBackend` (default)
   - `ExecBackend` (JSONL parsing)
   - `SdkBackend` (optional, feature-flagged)
3. Ensure all backends can:
   - run a prompt
   - emit normalized events
   - return a final result (text + optional structured JSON)

## Hard requirements

- TypeScript strict, no `any`.
- Bun runtime for execution.
- Must integrate:
  - AI SDK v6 (`ai`) and `ai-sdk-provider-codex-app-server`
  - codex CLI subprocess for exec backend
  - `@openai/codex-sdk` optionally behind a capability check

## Normalized event model

Define `CodexEvent` union:

- `codex.thread.started` { threadId }
- `codex.turn.started` { }
- `codex.tool.started` { toolType, toolName?, payload }
- `codex.tool.completed` { toolType, toolName?, payload, durationMs }
- `codex.file.changed` { path, changeType, summary }
- `codex.command.executed` { command, exitCode, stdoutTail, stderrTail }
- `codex.message.delta` { textDelta }
- `codex.message.completed` { text }
- `codex.turn.completed` { usage? }
- `codex.error` { message, details? }

Exec backend mapping:

- Parse JSONL events from `codex exec --json` and map:
  - `thread.started`, `turn.started`, `item.*`, `turn.completed`, `turn.failed`, `error`

App-server backend mapping:

- Use AI SDK streaming result plus provider session controls.
- Capture:
  - text stream into `message.delta`
  - tool streaming events if available from provider (if not directly exposed, emit minimal events and rely on run artifacts)

## Backend API

Create:

```ts
interface CodexRunOptions {
  model: string; // default gpt-5.2-codex
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  approvalMode?: "untrusted" | "on-failure" | "on-request" | "never";
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  mcpServers?: Record<string, unknown>; // typed later
  cwd: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  outputSchemaJson?: unknown; // JSON Schema for exec mode output-schema
}

interface CodexRunResult {
  threadId?: string;
  text: string;
  structured?: unknown;
  raw?: unknown;
}

type CodexEventSink = (event: CodexEvent) => void | Promise<void>;

interface CodexBackend {
  readonly kind: "app-server" | "exec" | "sdk";
  run(prompt: string, options: CodexRunOptions, onEvent: CodexEventSink): Promise<CodexRunResult>;
  inject?(message: string): Promise<void>;
  interrupt?(): Promise<void>;
}
```

## Exec backend details

- Command:
  - `codex exec --json "<prompt>"`
- If `outputSchemaJson` is provided:
  - write JSON schema to a temp file
  - use `--output-schema <file> -o <output.json>`
- Capture:
  - JSONL stream from stdout
  - stderr progress stream should be captured for artifacts but not required in normalized events
- Extract:
  - final agent message from `item.completed` where item.type == agent_message (best effort)
  - usage from `turn.completed`

## App-server backend details

- Use `ai`:
  - `streamText({ model: provider("gpt-5.2-codex"), prompt, providerOptions: { "codex-app-server": { reasoningEffort, threadMode }}})`
- Capture streaming deltas.
- Store the session object from `onSessionCreated` and expose `inject`/`interrupt`.

## SDK backend (optional)

- Try to import and run `@openai/codex-sdk`.
- If it fails under Bun in a given environment, detect and disable gracefully:
  - `codex-toolloop doctor` can report availability later.

## Testing

- Unit tests:
  - JSONL parser mapping from a fixture log file into normalized events.
- Integration tests:
  - Exec backend in “dry mode” by mocking `codex` binary:
    - provide a fake `codex` executable in PATH during test that emits known JSONL

Do NOT run real Codex in tests.

## Acceptance criteria

1. `ExecBackend` can parse fixture JSONL and return final text.
2. `AppServerBackend` compiles and can be instantiated (full runtime tested later).
3. Normalized events are emitted.
4. No real Codex calls in test suite.
