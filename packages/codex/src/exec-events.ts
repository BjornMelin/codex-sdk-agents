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

const UsageSchema = z.looseObject({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cached_input_tokens: z.number().optional(),
});

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

const ThreadEventSchema = z.looseObject({
  type: z.string(),
  thread_id: z.string().optional(),
  turn_id: z.string().optional(),
  usage: UsageSchema.optional(),
  item: ItemSchema.optional(),
  error: z.unknown().optional(),
  message: z.string().optional(),
});

export type ThreadEventLike = z.infer<typeof ThreadEventSchema>;

export function parseThreadEventLike(value: unknown): ThreadEventLike | null {
  const parsed = ThreadEventSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function nowMs(): number {
  return Date.now();
}

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

function toJsonObject(value: unknown): JsonObject | undefined {
  if (isJsonObject(value)) {
    return value;
  }
  return undefined;
}

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

type FileChangeKind = CodexFileChangedEvent["kind"];

function normalizeFileChangeKind(kind: string | undefined): FileChangeKind {
  switch (kind) {
    case "add":
      return "added";
    case "added":
    case "update":
      return "modified";
    case "modified":
    case "delete":
      return "deleted";
    case "deleted":
    case "renamed":
      return kind;
    default:
      return "unknown";
  }
}

export type ThreadEventMapper = (
  event: ThreadEventLike,
) => readonly CodexEvent[];

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
        if (!item || !item.text) {
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
          const text = item.text ?? lastAgentText;
          lastAgentText = text;

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
