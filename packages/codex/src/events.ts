import type {
  ApplyPatchApprovalParams,
  AuthMode,
  ExecCommandApprovalParams,
  RequestId,
  ResponseItem,
  v2,
} from "@codex-toolloop/codex-app-server-protocol";
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
  itemId?: string | undefined;
  textDelta: string;
};

/** Emitted when an agent message is finalized. */
export type CodexMessageCompletedEvent = CodexEventBase & {
  type: "codex.message.completed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId?: string | undefined;
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
  toolName?: string | undefined;
  durationMs?: number | undefined;
  result?: JsonObject | undefined;
};

/** Emitted when an MCP tool call reports progress. */
export type CodexMcpToolCallProgressEvent = CodexEventBase & {
  type: "codex.mcp.toolcall.progress";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId: string;
  message: string;
};

/** Emitted when Codex reports a file change. */
export type CodexFileChangedEvent = CodexEventBase & {
  type: "codex.file.changed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  path: string;
  kind: "added" | "modified" | "deleted" | "renamed" | "unknown";
  movePath?: string | undefined;
  summary?: string | undefined;
};

/** Emitted when Codex executes a shell command. */
export type CodexCommandExecutedEvent = CodexEventBase & {
  type: "codex.command.executed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  command: string;
  cwd?: string | undefined;
  commandActions?: v2.CommandAction[] | undefined;
  processId?: string | undefined;
  exitCode?: number | undefined;
  aggregatedOutputTail?: string | undefined;
  durationMs?: number | undefined;
};

/** Emitted when Codex streams command output deltas. */
export type CodexCommandOutputDeltaEvent = CodexEventBase & {
  type: "codex.command.output.delta";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId?: string | undefined;
  delta: string;
};

/** Emitted when Codex streams file-change tool output deltas. */
export type CodexFileChangeOutputDeltaEvent = CodexEventBase & {
  type: "codex.fileChange.output.delta";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId?: string | undefined;
  delta: string;
};

/** Emitted when Codex streams reasoning summary deltas. */
export type CodexReasoningSummaryDeltaEvent = CodexEventBase & {
  type: "codex.reasoning.summary.delta";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId?: string | undefined;
  delta: string;
  summaryIndex?: number | undefined;
};

/** Emitted when Codex streams raw reasoning content deltas. */
export type CodexReasoningTextDeltaEvent = CodexEventBase & {
  type: "codex.reasoning.text.delta";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId?: string | undefined;
  delta: string;
  contentIndex?: number | undefined;
};

/** Emitted when Codex updates the turn-level diff. */
export type CodexDiffUpdatedEvent = CodexEventBase & {
  type: "codex.turn.diff.updated";
  threadId?: string | undefined;
  turnId?: string | undefined;
  diff: string;
};

/** Emitted when Codex updates the agent plan. */
export type CodexPlanUpdatedEvent = CodexEventBase & {
  type: "codex.turn.plan.updated";
  threadId?: string | undefined;
  turnId?: string | undefined;
  explanation?: string | undefined;
  plan: v2.TurnPlanStep[];
};

/** Emitted when Codex updates token usage for a thread. */
export type CodexTokenUsageUpdatedEvent = CodexEventBase & {
  type: "codex.thread.tokenUsage.updated";
  threadId?: string | undefined;
  turnId?: string | undefined;
  usage: v2.ThreadTokenUsage;
};

/** Emitted when a thread context compaction occurs. */
export type CodexThreadCompactedEvent = CodexEventBase & {
  type: "codex.thread.compacted";
  threadId: string;
  turnId: string;
};

/** Emitted when Codex starts an item. */
export type CodexItemStartedEvent = CodexEventBase & {
  type: "codex.item.started";
  threadId?: string | undefined;
  turnId?: string | undefined;
  item: v2.ThreadItem;
};

/** Emitted when Codex completes an item. */
export type CodexItemCompletedEvent = CodexEventBase & {
  type: "codex.item.completed";
  threadId?: string | undefined;
  turnId?: string | undefined;
  item: v2.ThreadItem;
};

/** Emitted when Codex exposes raw response items (used for end_turn detection). */
export type CodexRawResponseItemCompletedEvent = CodexEventBase & {
  type: "codex.raw.response.item.completed";
  threadId: string;
  turnId: string;
  item: ResponseItem;
};

/** Emitted when Codex requests approval for a command or file change. */
export type CodexApprovalRequestedEvent = CodexEventBase & {
  type: "codex.approval.requested";
  requestId: RequestId;
  kind: "command" | "fileChange" | "applyPatch" | "execCommand";
  params:
    | v2.CommandExecutionRequestApprovalParams
    | v2.FileChangeRequestApprovalParams
    | ApplyPatchApprovalParams
    | ExecCommandApprovalParams;
};

/** Emitted when Codex requests user input for a tool call. */
export type CodexUserInputRequestedEvent = CodexEventBase & {
  type: "codex.user_input.requested";
  requestId: RequestId;
  params: v2.ToolRequestUserInputParams;
};

/** Emitted when a collaboration tool call updates status. */
export type CodexCollabToolCallEvent = CodexEventBase & {
  type: "codex.collab.toolcall.updated";
  threadId?: string | undefined;
  turnId?: string | undefined;
  itemId: string;
  tool: v2.CollabAgentTool;
  status: v2.CollabAgentToolCallStatus;
  senderThreadId: string;
  receiverThreadIds: string[];
  prompt?: string | null | undefined;
  agentsStates?: Record<string, v2.CollabAgentState | undefined> | undefined;
};

/** Emitted when the Codex account auth mode changes. */
export type CodexAccountUpdatedEvent = CodexEventBase & {
  type: "codex.account.updated";
  authMode: AuthMode | null;
};

/** Emitted when Codex account rate limits update. */
export type CodexAccountRateLimitsUpdatedEvent = CodexEventBase & {
  type: "codex.account.rateLimits.updated";
  rateLimits: v2.RateLimitSnapshot;
};

/** Emitted when a login flow completes. */
export type CodexAccountLoginCompletedEvent = CodexEventBase & {
  type: "codex.account.login.completed";
  loginId: string | null;
  success: boolean;
  error: string | null;
};

/** Emitted when MCP OAuth login completes. */
export type CodexMcpOauthLoginCompletedEvent = CodexEventBase & {
  type: "codex.mcp.oauth.completed";
  name: string;
  success: boolean;
  error?: string | undefined;
};

/** Emitted when the server warns about config issues. */
export type CodexConfigWarningEvent = CodexEventBase & {
  type: "codex.config.warning";
  summary: string;
  details?: string | null | undefined;
};

/** Emitted when the server sends a deprecation notice. */
export type CodexDeprecationNoticeEvent = CodexEventBase & {
  type: "codex.deprecation.notice";
  summary: string;
  details?: string | null | undefined;
};

/** Emitted for Windows world-writable directory warnings. */
export type CodexWindowsWorldWritableWarningEvent = CodexEventBase & {
  type: "codex.windows.worldWritableWarning";
  samplePaths: string[];
  extraCount: number;
  failedScan: boolean;
};

/** Emitted when a terminal interaction requires stdin. */
export type CodexCommandStdinEvent = CodexEventBase & {
  type: "codex.command.stdin";
  threadId: string;
  turnId: string;
  itemId: string;
  processId: string;
  stdin: string;
};

/** Emitted for app-server notifications we do not map explicitly. */
export type CodexNotificationEvent = CodexEventBase & {
  type: "codex.notification";
  method: string;
  params: JsonObject;
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
  details?: JsonObject | undefined;
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
  | CodexMcpToolCallProgressEvent
  | CodexFileChangedEvent
  | CodexCommandExecutedEvent
  | CodexCommandOutputDeltaEvent
  | CodexFileChangeOutputDeltaEvent
  | CodexReasoningSummaryDeltaEvent
  | CodexReasoningTextDeltaEvent
  | CodexDiffUpdatedEvent
  | CodexPlanUpdatedEvent
  | CodexTokenUsageUpdatedEvent
  | CodexThreadCompactedEvent
  | CodexItemStartedEvent
  | CodexItemCompletedEvent
  | CodexRawResponseItemCompletedEvent
  | CodexApprovalRequestedEvent
  | CodexUserInputRequestedEvent
  | CodexCollabToolCallEvent
  | CodexAccountUpdatedEvent
  | CodexAccountRateLimitsUpdatedEvent
  | CodexAccountLoginCompletedEvent
  | CodexMcpOauthLoginCompletedEvent
  | CodexConfigWarningEvent
  | CodexDeprecationNoticeEvent
  | CodexWindowsWorldWritableWarningEvent
  | CodexCommandStdinEvent
  | CodexNotificationEvent
  | CodexExecStdoutEvent
  | CodexExecStderrEvent
  | CodexErrorEvent;
