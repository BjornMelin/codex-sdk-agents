import type {
  ResponseItem,
  ServerNotification,
  ServerRequest,
  v2,
} from "@codex-toolloop/codex-app-server-protocol";

import type { CodexBackendKind, CodexEventHandler } from "../backend.js";
import type { CodexEvent, CodexUsage } from "../events.js";
import { isJsonObject, type JsonObject } from "../types.js";

type TurnCompletion = {
  threadId: string;
  turnId: string;
  status: v2.TurnStatus;
  error: v2.TurnError | null;
};

type MapperOptions = {
  backend: CodexBackendKind;
  onEvent?: CodexEventHandler | undefined;
  onTurnCompleted?: ((info: TurnCompletion) => void) | undefined;
};

type MapperState = {
  threadId?: string | undefined;
  activeTurnId?: string | undefined;
  completionError: Error | null;
  lastTokenUsage: v2.ThreadTokenUsage | null;
  messageBuffers: Map<string, string[]>;
  completedMessageIds: Set<string>;
  messageSegments: string[];
  lastMessageItemId: string | null;
};

function isMessageResponseItem(
  item: ResponseItem,
): item is Extract<ResponseItem, { type: "message" }> {
  return item.type === "message";
}

function toUsage(
  tokenUsage: v2.ThreadTokenUsage | null,
): CodexUsage | undefined {
  if (!tokenUsage) return undefined;
  return {
    inputTokens: tokenUsage.last.inputTokens,
    outputTokens: tokenUsage.last.outputTokens,
    cachedInputTokens: tokenUsage.last.cachedInputTokens,
  };
}

function normalizePatchChangeKind(kind: v2.PatchChangeKind): {
  kind: "added" | "modified" | "deleted" | "renamed" | "unknown";
  movePath?: string | null;
} {
  if (kind.type === "add") {
    return { kind: "added" };
  }
  if (kind.type === "delete") {
    return { kind: "deleted" };
  }
  if (kind.type === "update") {
    if (kind.move_path) {
      return { kind: "renamed", movePath: kind.move_path };
    }
    return { kind: "modified" };
  }
  return { kind: "unknown" };
}

async function emitEvent(
  handler: CodexEventHandler | undefined,
  event: CodexEvent,
): Promise<void> {
  if (!handler) return;
  await handler(event);
}

function ensureBuffer(state: MapperState, itemId: string): string[] {
  const existing = state.messageBuffers.get(itemId);
  if (existing) return existing;
  const next: string[] = [];
  state.messageBuffers.set(itemId, next);
  return next;
}

async function completeMessage(
  options: MapperOptions,
  state: MapperState,
  itemId: string,
  text: string,
  threadId?: string,
  turnId?: string,
): Promise<void> {
  if (state.completedMessageIds.has(itemId)) return;
  state.completedMessageIds.add(itemId);
  if (text.length === 0) return;
  state.messageSegments.push(text);
  await emitEvent(options.onEvent, {
    type: "codex.message.completed",
    backend: options.backend,
    timestampMs: Date.now(),
    ...(threadId !== undefined ? { threadId } : {}),
    ...(turnId !== undefined ? { turnId } : {}),
    itemId,
    text,
  });
}

/**
 * Event mapper for Codex app-server notifications and requests.
 *
 * @remarks SPEC-023 applies to app-server event mapping.
 */
export type CodexAppServerEventMapper = {
  setThreadId: (threadId: string) => void;
  getActiveTurnId: () => string | undefined;
  getCompletionError: () => Error | null;
  getUsage: () => CodexUsage | undefined;
  flushMessages: () => Promise<void>;
  getFullText: () => string;
  handleNotification: (notification: ServerNotification) => Promise<void>;
  handleServerRequest: (request: ServerRequest) => Promise<void>;
};

/**
 * Create a stateful mapper for app-server v2 events.
 *
 * @param options - Mapper configuration and callbacks.
 * @returns Event mapper utilities for app-server streams.
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export function createCodexAppServerEventMapper(
  options: MapperOptions,
): CodexAppServerEventMapper {
  const state: MapperState = {
    completionError: null,
    lastTokenUsage: null,
    messageBuffers: new Map(),
    completedMessageIds: new Set(),
    messageSegments: [],
    lastMessageItemId: null,
  };

  const setThreadId = (threadId: string) => {
    state.threadId = threadId;
  };

  const matchesThread = (threadId: string | undefined) => {
    if (!state.threadId) return true;
    return threadId === state.threadId;
  };

  const handleNotification = async (
    notification: ServerNotification,
  ): Promise<void> => {
    switch (notification.method) {
      case "error": {
        state.completionError = new Error(notification.params.error.message);
        await emitEvent(options.onEvent, {
          type: "codex.error",
          backend: options.backend,
          timestampMs: Date.now(),
          message: notification.params.error.message,
          details: {
            codexErrorInfo: notification.params.error.codexErrorInfo,
            additionalDetails: notification.params.error.additionalDetails,
          },
        });
        return;
      }
      case "account/updated": {
        await emitEvent(options.onEvent, {
          type: "codex.account.updated",
          backend: options.backend,
          timestampMs: Date.now(),
          authMode: notification.params.authMode,
        });
        return;
      }
      case "account/rateLimits/updated": {
        await emitEvent(options.onEvent, {
          type: "codex.account.rateLimits.updated",
          backend: options.backend,
          timestampMs: Date.now(),
          rateLimits: notification.params.rateLimits,
        });
        return;
      }
      case "account/login/completed": {
        await emitEvent(options.onEvent, {
          type: "codex.account.login.completed",
          backend: options.backend,
          timestampMs: Date.now(),
          loginId: notification.params.loginId,
          success: notification.params.success,
          error: notification.params.error,
        });
        return;
      }
      case "mcpServer/oauthLogin/completed": {
        await emitEvent(options.onEvent, {
          type: "codex.mcp.oauth.completed",
          backend: options.backend,
          timestampMs: Date.now(),
          name: notification.params.name,
          success: notification.params.success,
          ...(notification.params.error
            ? { error: notification.params.error }
            : {}),
        });
        return;
      }
      case "deprecationNotice": {
        await emitEvent(options.onEvent, {
          type: "codex.deprecation.notice",
          backend: options.backend,
          timestampMs: Date.now(),
          summary: notification.params.summary,
          details: notification.params.details,
        });
        return;
      }
      case "configWarning": {
        await emitEvent(options.onEvent, {
          type: "codex.config.warning",
          backend: options.backend,
          timestampMs: Date.now(),
          summary: notification.params.summary,
          details: notification.params.details,
        });
        return;
      }
      case "windows/worldWritableWarning": {
        await emitEvent(options.onEvent, {
          type: "codex.windows.worldWritableWarning",
          backend: options.backend,
          timestampMs: Date.now(),
          samplePaths: notification.params.samplePaths,
          extraCount: notification.params.extraCount,
          failedScan: notification.params.failedScan,
        });
        return;
      }
      case "thread/started": {
        if (!state.threadId) {
          state.threadId = notification.params.thread.id;
        }
        if (!matchesThread(notification.params.thread.id)) return;
        await emitEvent(options.onEvent, {
          type: "codex.thread.started",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.thread.id,
        });
        return;
      }
      case "turn/started": {
        if (!matchesThread(notification.params.threadId)) return;
        state.activeTurnId = notification.params.turn.id;
        await emitEvent(options.onEvent, {
          type: "codex.turn.started",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turn.id,
        });
        return;
      }
      case "turn/completed": {
        if (!matchesThread(notification.params.threadId)) return;
        const { turn } = notification.params;
        state.activeTurnId = turn.id;
        if (turn.status === "failed") {
          state.completionError = new Error(
            turn.error?.message ?? "Codex turn failed",
          );
          await emitEvent(options.onEvent, {
            type: "codex.turn.failed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: turn.id,
            message: turn.error?.message ?? "Codex turn failed",
            ...(turn.error
              ? {
                  details: {
                    codexErrorInfo: turn.error.codexErrorInfo,
                    additionalDetails: turn.error.additionalDetails,
                  },
                }
              : {}),
          });
        } else {
          await emitEvent(options.onEvent, {
            type: "codex.turn.completed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: turn.id,
            ...(toUsage(state.lastTokenUsage)
              ? { usage: toUsage(state.lastTokenUsage) }
              : {}),
          });
        }

        options.onTurnCompleted?.({
          threadId: notification.params.threadId,
          turnId: turn.id,
          status: turn.status,
          error: turn.error,
        });
        return;
      }
      case "turn/diff/updated": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.turn.diff.updated",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          diff: notification.params.diff,
        });
        return;
      }
      case "turn/plan/updated": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.turn.plan.updated",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          ...(notification.params.explanation
            ? { explanation: notification.params.explanation }
            : {}),
          plan: notification.params.plan,
        });
        return;
      }
      case "thread/tokenUsage/updated": {
        if (!matchesThread(notification.params.threadId)) return;
        state.lastTokenUsage = notification.params.tokenUsage;
        await emitEvent(options.onEvent, {
          type: "codex.thread.tokenUsage.updated",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          usage: notification.params.tokenUsage,
        });
        return;
      }
      case "thread/compacted": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.thread.compacted",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
        });
        return;
      }
      case "item/started": {
        if (!matchesThread(notification.params.threadId)) return;
        const { item } = notification.params;
        await emitEvent(options.onEvent, {
          type: "codex.item.started",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          item,
        });

        if (item.type === "agentMessage") {
          state.lastMessageItemId = item.id;
          ensureBuffer(state, item.id);
          return;
        }

        if (item.type === "commandExecution") {
          await emitEvent(options.onEvent, {
            type: "codex.tool.started",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "commandExecution",
            toolName: item.command,
            payload: {
              command: item.command,
              cwd: item.cwd,
              commandActions: item.commandActions,
              processId: item.processId,
            },
          });
          return;
        }

        if (item.type === "fileChange") {
          await emitEvent(options.onEvent, {
            type: "codex.tool.started",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "fileChange",
          });
          return;
        }

        if (item.type === "mcpToolCall") {
          await emitEvent(options.onEvent, {
            type: "codex.tool.started",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "mcpToolCall",
            toolName: `${item.server}.${item.tool}`,
          });
          return;
        }

        if (item.type === "collabAgentToolCall") {
          const normalizedAgentsStates =
            item.agentsStates === null || item.agentsStates === undefined
              ? undefined
              : (Object.fromEntries(
                  Object.entries(item.agentsStates).filter(
                    ([, value]) => value !== undefined,
                  ),
                ) as Record<string, v2.CollabAgentState>);
          const collabPayload: JsonObject = {
            senderThreadId: item.senderThreadId,
            receiverThreadIds: item.receiverThreadIds,
            status: item.status,
          };
          if (item.prompt !== undefined) {
            collabPayload.prompt = item.prompt;
          }
          if (normalizedAgentsStates !== undefined) {
            collabPayload.agentsStates = normalizedAgentsStates as JsonObject;
          }
          await emitEvent(options.onEvent, {
            type: "codex.collab.toolcall.updated",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            itemId: item.id,
            tool: item.tool,
            status: item.status,
            senderThreadId: item.senderThreadId,
            receiverThreadIds: item.receiverThreadIds,
            prompt: item.prompt,
            agentsStates: normalizedAgentsStates,
          });
          await emitEvent(options.onEvent, {
            type: "codex.tool.started",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "collabAgentToolCall",
            toolName: item.tool,
            payload: collabPayload,
          });
          return;
        }
        return;
      }
      case "item/completed": {
        if (!matchesThread(notification.params.threadId)) return;
        const { item } = notification.params;
        await emitEvent(options.onEvent, {
          type: "codex.item.completed",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          item,
        });

        if (item.type === "agentMessage") {
          const buffer = state.messageBuffers.get(item.id);
          const text = item.text ?? buffer?.join("") ?? "";
          await completeMessage(
            options,
            state,
            item.id,
            text,
            notification.params.threadId,
            notification.params.turnId,
          );
          return;
        }

        if (item.type === "fileChange") {
          for (const change of item.changes) {
            const mapped = normalizePatchChangeKind(change.kind);
            await emitEvent(options.onEvent, {
              type: "codex.file.changed",
              backend: options.backend,
              timestampMs: Date.now(),
              threadId: notification.params.threadId,
              turnId: notification.params.turnId,
              path: change.path,
              kind: mapped.kind,
              ...(mapped.movePath ? { movePath: mapped.movePath } : {}),
            });
          }
          await emitEvent(options.onEvent, {
            type: "codex.tool.completed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "fileChange",
          });
          return;
        }

        if (item.type === "commandExecution") {
          await emitEvent(options.onEvent, {
            type: "codex.command.executed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            command: item.command,
            cwd: item.cwd,
            commandActions: item.commandActions,
            processId: item.processId ?? undefined,
            ...(item.exitCode !== null ? { exitCode: item.exitCode } : {}),
            ...(item.aggregatedOutput !== null
              ? { aggregatedOutputTail: item.aggregatedOutput }
              : {}),
            ...(item.durationMs !== null
              ? { durationMs: item.durationMs }
              : {}),
          });
          await emitEvent(options.onEvent, {
            type: "codex.tool.completed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "commandExecution",
            toolName: item.command,
            durationMs: item.durationMs ?? undefined,
          });
          return;
        }

        if (item.type === "mcpToolCall") {
          await emitEvent(options.onEvent, {
            type: "codex.tool.completed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "mcpToolCall",
            toolName: `${item.server}.${item.tool}`,
            durationMs: item.durationMs ?? undefined,
            ...(isJsonObject(item.result)
              ? { result: item.result as JsonObject }
              : {}),
          });
          return;
        }

        if (item.type === "collabAgentToolCall") {
          await emitEvent(options.onEvent, {
            type: "codex.collab.toolcall.updated",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            itemId: item.id,
            tool: item.tool,
            status: item.status,
            senderThreadId: item.senderThreadId,
            receiverThreadIds: item.receiverThreadIds,
            prompt: item.prompt,
            agentsStates: item.agentsStates,
          });
          await emitEvent(options.onEvent, {
            type: "codex.tool.completed",
            backend: options.backend,
            timestampMs: Date.now(),
            threadId: notification.params.threadId,
            turnId: notification.params.turnId,
            toolType: "collabAgentToolCall",
            toolName: item.tool,
          });
          return;
        }

        return;
      }
      case "rawResponseItem/completed": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.raw.response.item.completed",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          item: notification.params.item,
        });
        if (
          isMessageResponseItem(notification.params.item) &&
          notification.params.item.end_turn === true &&
          state.lastMessageItemId
        ) {
          const buffer = state.messageBuffers.get(state.lastMessageItemId);
          const text = buffer?.join("") ?? "";
          await completeMessage(
            options,
            state,
            state.lastMessageItemId,
            text,
            notification.params.threadId,
            notification.params.turnId,
          );
        }
        return;
      }
      case "item/agentMessage/delta": {
        if (!matchesThread(notification.params.threadId)) return;
        if (state.completedMessageIds.has(notification.params.itemId)) {
          return;
        }
        const buffer = ensureBuffer(state, notification.params.itemId);
        buffer.push(notification.params.delta);
        state.lastMessageItemId = notification.params.itemId;
        await emitEvent(options.onEvent, {
          type: "codex.message.delta",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          textDelta: notification.params.delta,
        });
        return;
      }
      case "item/commandExecution/outputDelta": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.command.output.delta",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          delta: notification.params.delta,
        });
        return;
      }
      case "item/commandExecution/terminalInteraction": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.command.stdin",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          processId: notification.params.processId,
          stdin: notification.params.stdin,
        });
        return;
      }
      case "item/fileChange/outputDelta": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.fileChange.output.delta",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          delta: notification.params.delta,
        });
        return;
      }
      case "item/mcpToolCall/progress": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.mcp.toolcall.progress",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          message: notification.params.message,
        });
        return;
      }
      case "item/reasoning/summaryTextDelta": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.reasoning.summary.delta",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          delta: notification.params.delta,
          summaryIndex: notification.params.summaryIndex,
        });
        return;
      }
      case "item/reasoning/summaryPartAdded": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.reasoning.summary.delta",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          delta: "",
          summaryIndex: notification.params.summaryIndex,
        });
        return;
      }
      case "item/reasoning/textDelta": {
        if (!matchesThread(notification.params.threadId)) return;
        await emitEvent(options.onEvent, {
          type: "codex.reasoning.text.delta",
          backend: options.backend,
          timestampMs: Date.now(),
          threadId: notification.params.threadId,
          turnId: notification.params.turnId,
          itemId: notification.params.itemId,
          delta: notification.params.delta,
          contentIndex: notification.params.contentIndex,
        });
        return;
      }
      default: {
        await emitEvent(options.onEvent, {
          type: "codex.notification",
          backend: options.backend,
          timestampMs: Date.now(),
          method: notification.method,
          params: notification.params as JsonObject,
        });
      }
    }
  };

  const handleServerRequest = async (request: ServerRequest) => {
    if (
      request.method === "item/commandExecution/requestApproval" ||
      request.method === "item/fileChange/requestApproval" ||
      request.method === "item/tool/requestUserInput"
    ) {
      if (
        "threadId" in request.params &&
        !matchesThread(request.params.threadId)
      ) {
        return;
      }
    }

    if (request.method === "item/tool/requestUserInput") {
      await emitEvent(options.onEvent, {
        type: "codex.user_input.requested",
        backend: options.backend,
        timestampMs: Date.now(),
        requestId: request.id,
        params: request.params,
      });
      return;
    }

    if (
      request.method === "item/commandExecution/requestApproval" ||
      request.method === "item/fileChange/requestApproval" ||
      request.method === "applyPatchApproval" ||
      request.method === "execCommandApproval"
    ) {
      const kind =
        request.method === "item/commandExecution/requestApproval"
          ? "command"
          : request.method === "item/fileChange/requestApproval"
            ? "fileChange"
            : request.method === "applyPatchApproval"
              ? "applyPatch"
              : "execCommand";

      await emitEvent(options.onEvent, {
        type: "codex.approval.requested",
        backend: options.backend,
        timestampMs: Date.now(),
        requestId: request.id,
        kind,
        params: request.params,
      });
    }
  };

  const flushMessages = async () => {
    for (const [itemId, buffer] of state.messageBuffers) {
      if (state.completedMessageIds.has(itemId)) {
        continue;
      }
      const text = buffer.join("");
      await completeMessage(options, state, itemId, text, state.threadId);
    }
  };

  return {
    setThreadId,
    getActiveTurnId: () => state.activeTurnId,
    getCompletionError: () => state.completionError,
    getUsage: () => toUsage(state.lastTokenUsage),
    flushMessages,
    getFullText: () => state.messageSegments.join(""),
    handleNotification,
    handleServerRequest,
  };
}
