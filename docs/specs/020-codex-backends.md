# SPEC 020 -- Codex backends (v1)

Status: **Completed** (2026-01-21)

## Goal

Provide a strict, testable, and backend-agnostic interface for running Codex in three modes:

- **App-server backend** (default/recommended): internal JSONL-over-stdio client for `codex app-server` (schema-driven).
- **Exec backend** (fallback / deterministic CI-friendly mode): `codex exec --json` JSONL stream parsing.
- **SDK backend** (optional): `@openai/codex-sdk` (used when direct SDK control is required).

The interface normalizes streaming events and returns a final result (`text` plus optional `structured` JSON).

## Governing ADRs

- ADR 0002: Model backends (modes and defaults)
- ADR 0007: Observability & artifacts (normalized event stream)
- ADR 0008: Safety & trust (treat tool output and streamed events as hostile input)
- ADR 0006: Testing strategy (Vitest, avoid calling real Codex in tests)

## Non-goals

- Implementing MCP registry/routing logic (covered by SPEC 010/011).
- Running real Codex CLI in tests (tests must use mocks/stubs).
- Implementing structured output for app-server / SDK backends (v1 structured output is guaranteed for exec backend).
  - Note: app-server supports `outputSchema` at the protocol level, but this repo's v1 backend API does not expose it yet.

## Public API

Implemented in `packages/codex/src/**`.

### Types

```ts
export type CodexBackendKind = "app-server" | "exec" | "sdk";

export type CodexApprovalMode = "untrusted" | "on-failure" | "on-request" | "never";
export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/**
 * Superset of reasoning effort values. Individual backends may reject values
 * not supported by their underlying transport/provider.
 */
export type CodexReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type CodexThreadMode = "persistent" | "stateless";

export type CodexMcpServerConfig = {
  command?: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  httpHeaders?: Record<string, string>;
};

export type CodexRunOptions = {
  cwd?: string;
  model?: string;

  approvalMode?: CodexApprovalMode;
  sandboxMode?: CodexSandboxMode;
  sandboxPolicy?: v2.SandboxPolicy;
  reasoningEffort?: CodexReasoningEffort;
  reasoningSummary?: ReasoningSummary;
  threadMode?: CodexThreadMode;

  env?: Record<string, string>;

  mcpServers?: Record<string, CodexMcpServerConfig>;
  configOverrides?: Record<string, JsonValue>;
  baseInstructions?: string;
  developerInstructions?: string;

  signal?: AbortSignal;
  timeoutMs?: number;

  /** App-server only */
  outputSchema?: JsonValue;

  /** Exec-only */
  outputSchemaJson?: JsonValue;
  outputPath?: string;

  /** Exec/app-server */
  codexPath?: string;

  /** Exec-only: for test harnesses */
  codexArgsPrefix?: readonly string[];

  /** Exec/SDK: if supported */
  skipGitRepoCheck?: boolean;

  /** App-server only */
  collaborationMode?: CollaborationMode;
  input?: v2.UserInput[];
};

export type CodexRunResult = {
  backend: CodexBackendKind;
  model: string;
  threadId?: string;
  turnId?: string;
  text: string;
  structured?: JsonValue;
  exitCode?: number;
};
```

### Events

The backends emit a normalized event stream via an `onEvent` callback.

```ts
export type CodexEvent =
  | { type: "codex.thread.started"; backend: CodexBackendKind; timestampMs: number; threadId: string }
  | { type: "codex.turn.started"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string }
  | { type: "codex.turn.completed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; usage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number } }
  | { type: "codex.turn.failed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; message: string }
  | { type: "codex.message.delta"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId?: string; textDelta: string }
  | { type: "codex.message.completed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId?: string; text: string }
  | { type: "codex.tool.started"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; toolType: string; toolName?: string; payload?: JsonObject }
  | { type: "codex.tool.completed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; toolType: string; toolName?: string; durationMs?: number; result?: JsonObject }
  | { type: "codex.mcp.toolcall.progress"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId: string; message: string }
  | { type: "codex.file.changed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; path: string; kind: "added" | "modified" | "deleted" | "renamed" | "unknown"; movePath?: string; summary?: string }
  | { type: "codex.command.executed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; command: string; cwd?: string; commandActions?: v2.CommandAction[]; processId?: string; exitCode?: number; aggregatedOutputTail?: string; durationMs?: number }
  | { type: "codex.command.output.delta"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId?: string; delta: string }
  | { type: "codex.command.stdin"; backend: CodexBackendKind; timestampMs: number; threadId: string; turnId: string; itemId: string; processId: string; stdin: string }
  | { type: "codex.fileChange.output.delta"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId?: string; delta: string }
  | { type: "codex.reasoning.summary.delta"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId?: string; delta: string; summaryIndex?: number }
  | { type: "codex.reasoning.text.delta"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId?: string; delta: string; contentIndex?: number }
  | { type: "codex.turn.diff.updated"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; diff: string }
  | { type: "codex.turn.plan.updated"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; explanation?: string; plan: v2.TurnPlanStep[] }
  | { type: "codex.thread.tokenUsage.updated"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; usage: v2.ThreadTokenUsage }
  | { type: "codex.thread.compacted"; backend: CodexBackendKind; timestampMs: number; threadId: string; turnId: string }
  | { type: "codex.item.started"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; item: v2.ThreadItem }
  | { type: "codex.item.completed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; item: v2.ThreadItem }
  | { type: "codex.raw.response.item.completed"; backend: CodexBackendKind; timestampMs: number; threadId: string; turnId: string; item: ResponseItem }
  | { type: "codex.approval.requested"; backend: CodexBackendKind; timestampMs: number; requestId: RequestId; kind: "command" | "fileChange" | "applyPatch" | "execCommand"; params: v2.CommandExecutionRequestApprovalParams | v2.FileChangeRequestApprovalParams | ApplyPatchApprovalParams | ExecCommandApprovalParams }
  | { type: "codex.user_input.requested"; backend: CodexBackendKind; timestampMs: number; requestId: RequestId; params: v2.ToolRequestUserInputParams }
  | { type: "codex.collab.toolcall.updated"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; itemId: string; tool: v2.CollabAgentTool; status: v2.CollabAgentToolCallStatus; senderThreadId: string; receiverThreadIds: string[]; prompt?: string | null; agentsStates?: Record<string, v2.CollabAgentState | undefined> }
  | { type: "codex.account.updated"; backend: CodexBackendKind; timestampMs: number; authMode: AuthMode | null }
  | { type: "codex.account.rateLimits.updated"; backend: CodexBackendKind; timestampMs: number; rateLimits: v2.RateLimitSnapshot }
  | { type: "codex.account.login.completed"; backend: CodexBackendKind; timestampMs: number; loginId: string | null; success: boolean; error: string | null }
  | { type: "codex.mcp.oauth.completed"; backend: CodexBackendKind; timestampMs: number; name: string; success: boolean; error?: string }
  | { type: "codex.config.warning"; backend: CodexBackendKind; timestampMs: number; summary: string; details?: string | null }
  | { type: "codex.deprecation.notice"; backend: CodexBackendKind; timestampMs: number; summary: string; details?: string | null }
  | { type: "codex.windows.worldWritableWarning"; backend: CodexBackendKind; timestampMs: number; samplePaths: string[]; extraCount: number; failedScan: boolean }
  | { type: "codex.notification"; backend: CodexBackendKind; timestampMs: number; method: string; params: JsonObject }
  | { type: "codex.exec.stdout"; backend: CodexBackendKind; timestampMs: number; line: string }
  | { type: "codex.exec.stderr"; backend: CodexBackendKind; timestampMs: number; line: string }
  | { type: "codex.error"; backend: CodexBackendKind; timestampMs: number; message: string; details?: JsonObject };
```

Notes:

- **Exec backend** normalizes Codex JSONL events emitted by `codex exec --json` (thread/turn/item lifecycle).
- **App-server backend** maps `codex app-server` notifications (at minimum, `item/agentMessage/delta`) to normalized message events.

### Backend interface

```ts
export interface CodexBackend {
  readonly kind: CodexBackendKind;

  run(prompt: string, options: CodexRunOptions, onEvent?: (event: CodexEvent) => void | Promise<void>): Promise<CodexRunResult>;

  close?(): Promise<void>;
  inject?(content: string): Promise<void>;
  interrupt?(): Promise<void>;
}
```

## Backend behaviors

### App-server backend

- Implemented via an internal JSONL-over-stdio client (`codex app-server`) with
  Zod-based JSON-RPC envelope validation.
- Uses committed protocol types:
  - `packages/codex-app-server-protocol/src/generated/`
- JSON Schema bundles are generated into `tools/codex-schemas/` (ignored) for
  optional debugging or tooling use.
- Supports `threadMode: persistent | stateless`.
- Supports `reasoningEffort` by mapping it into the thread's `config` overrides (`model_reasoning_effort`).
- Uses raw response item notifications (`experimentalRawEvents`) to honor `end_turn`
  boundaries when finalizing streamed assistant messages.
- Exposes mid-execution controls:
  - `interrupt()` delegates to `turn/interrupt` for the active `(threadId, turnId)`.
  - `inject(content)` is not supported by app-server v2 in this repo's backend API.

### Exec backend

- Runs `codex exec --json` and parses JSONL line-by-line.
- Uses `--output-schema <schema.json>` and `--output-last-message <path>` when `outputSchemaJson` is supplied, to produce a deterministic `structured` result.
- Converts `mcpServers` into `--config key=value` overrides (JSON-encoded values), using the Codex CLI config override mechanism.

### SDK backend

- Uses `@openai/codex-sdk` `Codex.startThread()` and `thread.runStreamed()` to receive event objects and normalize them.
- Optional: used only where direct SDK thread control is required.
- Treats `model` and `reasoningEffort` as **thread-level defaults**:
  - The backend creates a new SDK thread whenever any thread-level setting changes: `cwd`, `model`, `reasoningEffort`, `sandboxMode`, `approvalMode`,
    `skipGitRepoCheck`.
  - This ensures per-run options are actually applied and that returned metadata reflects the model used.
- SDK reasoning effort support is limited by `@openai/codex-sdk` thread option types:
  - Supported: `minimal | low | medium | high | xhigh`
  - Unsupported (throws): `none`
- SDK file change kinds are normalized:
  - SDK emits `add | update | delete` which are mapped to `added | modified | deleted` for `codex.file.changed.kind`.

## Security and safety

- Treat all JSONL events and tool outputs as **hostile input**:
  - Parse with strict validators (Zod) and ignore unknown event types/fields.
  - Never execute any content from events as code.
- Never persist secrets in artifacts:
  - Do not write merged `process.env` to disk.
  - `mcpServers.env` and headers should be passed only to subprocesses.
- Enforce timeouts and abort handling for exec backend:
  - `timeoutMs` kills the subprocess (best effort) and emits `codex.error`.

## Test plan

- Unit tests:
  - `buildCodexExecArgs()` encodes config overrides (JSON-encoded `--config` values).
  - Exec JSONL normalization (`thread.started`, message deltas/completions, usage mapping).
- Integration-style unit test:
  - Spawn a mock “codex” implemented as a node script that prints JSONL and writes an output file.
  - Ensure `ExecBackend.run()` returns `text` and `structured` and emits normalized events.

## Verification plan

- `pnpm -s check`
- `pnpm -s build`
- `pnpm -s test` (via `pnpm -s check`)

## Implementation notes

- Primary implementation: `packages/codex/src/**`
  - `exec-events.ts` implements JSONL-to-normalized event mapping shared by exec and SDK backends.
  - `exec-backend.ts` implements `codex exec --json` subprocess runner plus output schema support.
  - `app-server/process.ts` implements the JSONL-over-stdio `codex app-server` process manager.
  - `app-server/schema.ts` builds Zod validators for JSON-RPC envelopes.
  - `app-server/event-mapper.ts` normalizes app-server v2 notifications into `CodexEvent` shapes (including end_turn handling and collab tool calls).
  - `app-server/ui-stream.ts` streams app-server events using AI SDK v6 UI data parts.
  - `app-server-backend.ts` implements the `app-server` backend on top of the process manager.
- Tests: `tests/unit/codex-*.test.ts`

## References

- Codex CLI reference (exec, JSONL, output schema, global flags): <https://developers.openai.com/codex/cli/reference/>
- Codex config reference (config overrides, MCP servers): <https://developers.openai.com/codex/config>
- Codex app-server docs: <https://developers.openai.com/codex/app-server/>
- ADR 0013: App-server protocol types -- `docs/adr/0013-codex-app-server-protocol-types.md`
- SPEC 023: App-server protocol workflow -- `docs/specs/023-codex-app-server-protocol.md`
- AI SDK MCP tools overview (context on MCP tool wiring): <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- Codex SDK (TypeScript) README: <https://github.com/openai/codex/blob/main/sdk/typescript/README.md>
- SPEC 021: SDK backend option fidelity (v1.1) -- `docs/specs/021-sdk-backend-option-fidelity.md`
