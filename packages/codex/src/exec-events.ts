import { z } from "zod";
import type { CodexBackendKind } from "./backend.js";
import type {
  CodexCommandExecutedEvent,
  CodexErrorEvent,
  CodexEvent,
  CodexFileChangedEvent,
  CodexMessageCompletedEvent,
  CodexMessageDeltaEvent,
  CodexThreadStartedEvent,
  CodexToolCompletedEvent,
  CodexToolStartedEvent,
  CodexTurnCompletedEvent,
  CodexTurnFailedEvent,
  CodexTurnStartedEvent,
  CodexUsage,
} from "./events.js";
import type { JsonObject } from "./types.js";
import { isJsonObject } from "./types.js";

/** Schema for token usage reported by backends. */
const UsageSchema = z.looseObject({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cached_input_tokens: z.number().optional(),
});

/** Schema for individual timeline items in thread events. */
const ItemSchema = z.looseObject({
  id: z.string().optional(),
  type: z.string().optional(),
  text: z.string().optional(),
  command: z.string().optional(),
  aggregated_output: z.string().optional(),
  exit_code: z.number().optional(),
  status: z.string().optional(),
  changes: z
    .array(
      z.looseObject({
        path: z.string().optional(),
        kind: z.string().optional(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
});

/** Schema for raw thread events from exec or SDK streams. */
const ThreadEventSchema = z.looseObject({
  type: z.string(),
  thread_id: z.string().optional(),
  turn_id: z.string().optional(),
  usage: UsageSchema.optional(),
  item: ItemSchema.optional(),
  error: z.unknown().optional(),
  message: z.string().optional(),
});

/**
 * Parsed thread event shape used by exec and SDK backends.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type ThreadEventLike = z.infer<typeof ThreadEventSchema>;

/**
 * Validate raw event payloads from exec or SDK streams.
 *
 * @param value - Raw event payload.
 * @returns Parsed event or null when invalid.
 * @see docs/specs/020-codex-backends.md
 */
export function parseThreadEventLike(value: unknown): ThreadEventLike | null {
  const parsed = ThreadEventSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

/** Current timestamp in milliseconds. */
function nowMs(): number {
  return Date.now();
}

/**
 * Map thread event usage to normalized Codex usage.
 *
 * @param usage - Raw usage from thread event.
 * @returns Normalized usage or undefined.
 */
function toUsage(usage: ThreadEventLike["usage"]): CodexUsage | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.cached_input_tokens,
  };
}

/**
 * Cast value to JsonObject if applicable.
 *
 * @param value - Candidate value.
 * @returns JsonObject or undefined.
 */
function toJsonObject(value: unknown): JsonObject | undefined {
  if (isJsonObject(value)) {
    return value;
  }
  return undefined;
}

/**
 * Extract error message from unknown error value.
 *
 * @param value - Error value.
 * @returns Error message string or undefined.
 */
function toErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (isJsonObject(value)) {
    const message = value.message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

/** Normalized file change types. */
type FileChangeKind = CodexFileChangedEvent["kind"];

/**
 * Normalize file change kind strings from Codex.
 *
 * @param kind - Raw change kind.
 * @returns Normalized file change kind.
 */
function normalizeFileChangeKind(kind: string | undefined): FileChangeKind {
  switch (kind) {
    case "add":
    case "added":
      return "added";
    case "update":
    case "modified":
      return "modified";
    case "delete":
    case "deleted":
      return "deleted";
    case "renamed":
      return kind;
    default:
      return "unknown";
  }
}

/**
 * Mapper signature for translating thread events into normalized Codex events.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type ThreadEventMapper = (
  event: ThreadEventLike,
) => readonly CodexEvent[];

/**
 * Create a mapper that normalizes exec or SDK thread events.
 *
 * @param backend - Backend identifier used for event metadata.
 * @returns Mapper function for normalized events.
 * @see docs/specs/020-codex-backends.md
 */
export function createThreadEventMapper(
  backend: CodexBackendKind,
): ThreadEventMapper {
  const itemTextById = new Map<string, string>();
  let lastAgentText = "";
  let threadId: string | undefined;

  const toolStartTsByItemId = new Map<string, number>();

  return (event: ThreadEventLike): readonly CodexEvent[] => {
    const ts = nowMs();
    const events: CodexEvent[] = [];

    if (event.thread_id) {
      threadId = event.thread_id;
    }

    const sharedIds = {
      threadId: threadId ?? event.thread_id,
      turnId: event.turn_id,
    };

    switch (event.type) {
      case "thread.started": {
        if (!event.thread_id) {
          break;
        }
        const e: CodexThreadStartedEvent = {
          type: "codex.thread.started",
          backend,
          timestampMs: ts,
          threadId: event.thread_id,
        };
        events.push(e);
        break;
      }

      case "turn.started": {
        const e: CodexTurnStartedEvent = {
          type: "codex.turn.started",
          backend,
          timestampMs: ts,
          ...(sharedIds.threadId !== undefined
            ? { threadId: sharedIds.threadId }
            : {}),
          ...(sharedIds.turnId !== undefined
            ? { turnId: sharedIds.turnId }
            : {}),
        };
        events.push(e);
        break;
      }

      case "turn.completed": {
        const usage = toUsage(event.usage);
        const e: CodexTurnCompletedEvent = {
          type: "codex.turn.completed",
          backend,
          timestampMs: ts,
          ...(sharedIds.threadId !== undefined
            ? { threadId: sharedIds.threadId }
            : {}),
          ...(sharedIds.turnId !== undefined
            ? { turnId: sharedIds.turnId }
            : {}),
          ...(usage !== undefined ? { usage } : {}),
        };
        events.push(e);
        break;
      }

      case "turn.failed": {
        const errObj = toJsonObject(event.error) ?? toJsonObject(event);
        const msg =
          toErrorMessage(event.error) ?? event.message ?? "Turn failed";
        const e: CodexTurnFailedEvent = {
          type: "codex.turn.failed",
          backend,
          timestampMs: ts,
          ...(sharedIds.threadId !== undefined
            ? { threadId: sharedIds.threadId }
            : {}),
          ...(sharedIds.turnId !== undefined
            ? { turnId: sharedIds.turnId }
            : {}),
          message: msg,
          ...(errObj ? { details: errObj } : {}),
        };
        events.push(e);
        break;
      }

      case "error": {
        const details = toJsonObject(event);
        const e: CodexErrorEvent = {
          type: "codex.error",
          backend,
          timestampMs: ts,
          message: event.message ?? "Codex error",
          ...(details ? { details } : {}),
        };
        events.push(e);
        break;
      }

      case "item.started": {
        const item = event.item;
        if (!item) {
          break;
        }
        const itemId = item.id;
        if (itemId && item.type === "mcp_tool_call") {
          toolStartTsByItemId.set(itemId, ts);
        }

        const tool: CodexToolStartedEvent = {
          type: "codex.tool.started",
          backend,
          timestampMs: ts,
          ...(sharedIds.threadId !== undefined
            ? { threadId: sharedIds.threadId }
            : {}),
          ...(sharedIds.turnId !== undefined
            ? { turnId: sharedIds.turnId }
            : {}),
          toolType: item.type ?? "unknown",
          ...(toJsonObject(item) ? { payload: toJsonObject(item) } : {}),
        };
        // Emit tool.started for all non-message items.
        if (
          item.type &&
          item.type !== "agent_message" &&
          item.type !== "assistant_message"
        ) {
          events.push(tool);
        }
        break;
      }

      case "item.updated": {
        const item = event.item;
        if (!item || item.text == null) {
          break;
        }

        // Codex has used both "assistant_message" and "agent_message" item types in the wild.
        const isAgentMessage =
          item.type === "agent_message" || item.type === "assistant_message";
        if (!isAgentMessage) {
          break;
        }

        const itemId = item.id ?? "__agent__";
        const prev = itemTextById.get(itemId) ?? "";
        const next = item.text;

        // Compute delta optimistically when next is an extension of prev; otherwise fall back to whole string.
        const delta = next.startsWith(prev) ? next.slice(prev.length) : next;

        itemTextById.set(itemId, next);
        lastAgentText = next;

        if (delta.length > 0) {
          const e: CodexMessageDeltaEvent = {
            type: "codex.message.delta",
            backend,
            timestampMs: ts,
            ...(sharedIds.threadId !== undefined
              ? { threadId: sharedIds.threadId }
              : {}),
            ...(sharedIds.turnId !== undefined
              ? { turnId: sharedIds.turnId }
              : {}),
            textDelta: delta,
          };
          events.push(e);
        }
        break;
      }

      case "item.completed": {
        const item = event.item;
        if (!item) {
          break;
        }

        const isAgentMessage =
          item.type === "agent_message" || item.type === "assistant_message";
        if (isAgentMessage) {
          const itemId = item.id ?? "__agent__";
          const cachedText = itemTextById.get(itemId);
          const text = cachedText ?? item.text ?? lastAgentText;

          // Only update lastAgentText if we have fresh text (not falling back from lastAgentText).
          if (cachedText || item.text) {
            lastAgentText = text;
          }

          const e: CodexMessageCompletedEvent = {
            type: "codex.message.completed",
            backend,
            timestampMs: ts,
            ...(sharedIds.threadId !== undefined
              ? { threadId: sharedIds.threadId }
              : {}),
            ...(sharedIds.turnId !== undefined
              ? { turnId: sharedIds.turnId }
              : {}),
            text,
          };
          events.push(e);
          itemTextById.delete(itemId);
          break;
        }

        if (item.type === "file_change" && item.changes) {
          for (const change of item.changes) {
            if (!change.path) {
              continue;
            }
            const fileEvent: CodexFileChangedEvent = {
              type: "codex.file.changed",
              backend,
              timestampMs: ts,
              ...(sharedIds.threadId !== undefined
                ? { threadId: sharedIds.threadId }
                : {}),
              ...(sharedIds.turnId !== undefined
                ? { turnId: sharedIds.turnId }
                : {}),
              path: change.path,
              kind: normalizeFileChangeKind(change.kind),
              ...(change.summary !== undefined
                ? { summary: change.summary }
                : {}),
            };
            events.push(fileEvent);
          }
          break;
        }

        if (item.type === "command_execution") {
          const cmdEvent: CodexCommandExecutedEvent = {
            type: "codex.command.executed",
            backend,
            timestampMs: ts,
            ...(sharedIds.threadId !== undefined
              ? { threadId: sharedIds.threadId }
              : {}),
            ...(sharedIds.turnId !== undefined
              ? { turnId: sharedIds.turnId }
              : {}),
            command: item.command ?? "",
            ...(item.exit_code !== undefined
              ? { exitCode: item.exit_code }
              : {}),
            ...(item.aggregated_output !== undefined
              ? { aggregatedOutputTail: item.aggregated_output }
              : {}),
          };
          events.push(cmdEvent);
          break;
        }

        // Tool completion for everything else.
        const itemId = item.id;
        const startedAt = itemId ? toolStartTsByItemId.get(itemId) : undefined;

        const result = toJsonObject(item);
        const toolDone: CodexToolCompletedEvent = {
          type: "codex.tool.completed",
          backend,
          timestampMs: ts,
          ...(sharedIds.threadId !== undefined
            ? { threadId: sharedIds.threadId }
            : {}),
          ...(sharedIds.turnId !== undefined
            ? { turnId: sharedIds.turnId }
            : {}),
          toolType: item.type ?? "unknown",
          ...(startedAt !== undefined
            ? { durationMs: Math.max(0, ts - startedAt) }
            : {}),
          ...(result !== undefined ? { result } : {}),
        };
        events.push(toolDone);
        if (itemId) {
          toolStartTsByItemId.delete(itemId);
          itemTextById.delete(itemId);
        }
        break;
      }

      default: {
        // Ignore unknown event types. Callers can still observe raw stdout/stderr if desired.
        break;
      }
    }

    return events;
  };
}
