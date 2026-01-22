import type { CodexBackendKind } from "./backend.js";
import type { JsonObject } from "./types.js";

/** Token usage reported by Codex backends. */
export type CodexUsage = {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
};

/** Shared fields for all normalized Codex events. */
export type CodexEventBase = {
  backend: CodexBackendKind;
  timestampMs: number;
};

/** Emitted when a Codex thread is created or resumed. */
export type CodexThreadStartedEvent = CodexEventBase & {
  type: "codex.thread.started";
  threadId: string;
};

/** Emitted when a Codex turn begins. */
export type CodexTurnStartedEvent = CodexEventBase & {
  type: "codex.turn.started";
  threadId?: string | undefined;
  turnId?: string | undefined;
};

/** Emitted when a Codex turn completes successfully. */
export type CodexTurnCompletedEvent = CodexEventBase & {
  type: "codex.turn.completed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  usage?: CodexUsage | undefined;
};

/** Emitted when a Codex turn fails. */
export type CodexTurnFailedEvent = CodexEventBase & {
  type: "codex.turn.failed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  message: string;
  details?: JsonObject | undefined;
};

/** Emitted for incremental agent message deltas. */
export type CodexMessageDeltaEvent = CodexEventBase & {
  type: "codex.message.delta";
  threadId?: string | undefined;
  turnId?: string | undefined;
  textDelta: string;
};

/** Emitted when an agent message is finalized. */
export type CodexMessageCompletedEvent = CodexEventBase & {
  type: "codex.message.completed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  text: string;
};

/** Emitted when a tool call starts. */
export type CodexToolStartedEvent = CodexEventBase & {
  type: "codex.tool.started";
  threadId?: string | undefined;
  turnId?: string | undefined;
  toolType: string;
  toolName?: string | undefined;
  payload?: JsonObject | undefined;
};

/** Emitted when a tool call completes. */
export type CodexToolCompletedEvent = CodexEventBase & {
  type: "codex.tool.completed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  toolType: string;
  toolName?: string;
  durationMs?: number;
  result?: JsonObject;
};

/** Emitted when Codex reports a file change. */
export type CodexFileChangedEvent = CodexEventBase & {
  type: "codex.file.changed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  path: string;
  kind: "added" | "modified" | "deleted" | "renamed" | "unknown";
  summary?: string | undefined;
};

/** Emitted when Codex executes a shell command. */
export type CodexCommandExecutedEvent = CodexEventBase & {
  type: "codex.command.executed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  command: string;
  exitCode?: number | undefined;
  aggregatedOutputTail?: string | undefined;
};

/** Raw stdout lines from exec backend subprocesses. */
export type CodexExecStdoutEvent = CodexEventBase & {
  type: "codex.exec.stdout";
  line: string;
};

/** Raw stderr lines from exec backend subprocesses. */
export type CodexExecStderrEvent = CodexEventBase & {
  type: "codex.exec.stderr";
  line: string;
};

/** Emitted when a backend surfaces a runtime error. */
export type CodexErrorEvent = CodexEventBase & {
  type: "codex.error";
  message: string;
  details?: JsonObject;
};
/** Normalized event union emitted across Codex backends. */
export type CodexEvent =
  | CodexThreadStartedEvent
  | CodexTurnStartedEvent
  | CodexTurnCompletedEvent
  | CodexTurnFailedEvent
  | CodexMessageDeltaEvent
  | CodexMessageCompletedEvent
  | CodexToolStartedEvent
  | CodexToolCompletedEvent
  | CodexFileChangedEvent
  | CodexCommandExecutedEvent
  | CodexExecStdoutEvent
  | CodexExecStderrEvent
  | CodexErrorEvent;
