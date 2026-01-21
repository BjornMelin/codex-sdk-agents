# SPEC 020 — Codex backends (v1)

Status: **Completed** (2026-01-21)

## Goal

Provide a strict, testable, and backend-agnostic interface for running Codex in three modes:

- **App-server backend** (default/recommended): AI SDK community provider `ai-sdk-provider-codex-app-server`.
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
  reasoningEffort?: CodexReasoningEffort;
  threadMode?: CodexThreadMode;

  env?: Record<string, string>;

  mcpServers?: Record<string, CodexMcpServerConfig>;
  configOverrides?: Record<string, JsonValue>;

  signal?: AbortSignal;
  timeoutMs?: number;

  /** Exec-only */
  outputSchemaJson?: JsonValue;
  outputPath?: string;

  /** Exec/app-server */
  codexPath?: string;

  /** Exec-only: for test harnesses */
  codexArgsPrefix?: readonly string[];

  /** Exec/SDK: if supported */
  skipGitRepoCheck?: boolean;
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
  | {
      type: "codex.turn.completed";
      backend: CodexBackendKind;
      timestampMs: number;
      threadId?: string;
      turnId?: string;
      usage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
    }
  | { type: "codex.turn.failed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; message: string }
  | { type: "codex.message.delta"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; textDelta: string }
  | { type: "codex.message.completed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; text: string }
  | { type: "codex.tool.started"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; toolType: string }
  | {
      type: "codex.tool.completed";
      backend: CodexBackendKind;
      timestampMs: number;
      threadId?: string;
      turnId?: string;
      toolType: string;
      durationMs?: number;
    }
  | { type: "codex.file.changed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; path: string; kind: "added" | "modified" | "deleted" | "renamed" | "unknown" }
  | { type: "codex.command.executed"; backend: CodexBackendKind; timestampMs: number; threadId?: string; turnId?: string; command: string; exitCode?: number }
  | { type: "codex.exec.stdout"; backend: CodexBackendKind; timestampMs: number; line: string }
  | { type: "codex.exec.stderr"; backend: CodexBackendKind; timestampMs: number; line: string }
  | { type: "codex.error"; backend: CodexBackendKind; timestampMs: number; message: string };
```

Notes:

- **Exec backend** normalizes Codex JSONL events emitted by `codex exec --json` (thread/turn/item lifecycle).
- **App-server backend** maps AI SDK `streamText().fullStream` parts (at minimum, text deltas) to normalized message events.

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

- Implemented using `createCodexAppServer` provider and `streamText`.
- Supports `threadMode: persistent | stateless` and `reasoningEffort: none | low | medium | high` (provider contract).
- Exposes mid-execution controls:
  - `inject(content)` delegates to `session.injectMessage(content)` (provider session API).
  - `interrupt()` delegates to `session.interrupt()` (provider session API).

### Exec backend

- Runs `codex exec --json` and parses JSONL line-by-line.
- Uses `--output-schema <schema.json>` and `--output-last-message <path>` when `outputSchemaJson` is supplied, to produce a deterministic `structured` result.
- Converts `mcpServers` into `--config key=value` overrides (JSON-encoded values), using the Codex CLI config override mechanism.

### SDK backend

- Uses `@openai/codex-sdk` `Codex.startThread()` and `thread.runStreamed()` to receive event objects and normalize them.
- Optional: used only where direct SDK thread control is required.

## Security and safety

- Treat all JSONL events and tool outputs as **hostile input**:
  - Parse with strict validators (Zod) and ignore unknown event types/fields.
  - Never execute any content from events as code.
- Never persist secrets in artifacts:
  - Do not write merged `process.env` to disk.
  - `mcpServers.env` and headers should be passed only to subprocess/provider.
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
  - `app-server-backend.ts` wraps AI SDK app-server provider and exposes `inject`/`interrupt`.
- Tests: `tests/unit/codex-*.test.ts`

## References

- Codex CLI reference (exec, JSONL, output schema, global flags): <https://developers.openai.com/codex/cli/reference/>
- Codex config reference (config overrides, MCP servers): <https://developers.openai.com/codex/config>
- AI SDK codex app-server provider: <https://ai-sdk.dev/providers/community-providers/codex-app-server#codex-cli-app-server-provider>
- AI SDK MCP tools overview (context on MCP tool wiring): <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- Codex SDK (TypeScript) README: <https://github.com/openai/codex/blob/main/sdk/typescript/README.md>
