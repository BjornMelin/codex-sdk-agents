import { randomUUID } from "node:crypto";
import type {
  CollaborationMode,
  ReasoningEffort,
  ReasoningSummary,
  ServerRequest,
  v2,
} from "@codex-toolloop/codex-app-server-protocol";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import type { CodexEventHandler } from "../backend.js";
import type { CodexEvent } from "../events.js";
import type { JsonValue } from "../types.js";
import {
  CodexAppServerClient,
  type CodexAppServerClientOptions,
} from "./client.js";
import { createCodexAppServerEventMapper } from "./event-mapper.js";

/**
 * UI data parts emitted for Codex app-server streams.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type CodexUIDataTypes = {
  "codex-event": CodexEvent;
};

/**
 * UI message type for Codex app-server streams.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type CodexUIMessage = UIMessage<unknown, CodexUIDataTypes>;

/**
 * Options for creating a Codex app-server UI message stream.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type CodexAppServerUIStreamOptions = {
  /** User prompt to send when starting the turn (ignored if input is provided). */
  prompt: string;

  /** Optional pre-built user input items (use for vision / structured input). */
  input?: v2.UserInput[] | undefined;

  /** Optional thread id to resume before starting the turn. */
  threadId?: string | undefined;

  /** Working directory for thread + turn context. */
  cwd?: string | undefined;

  /** Model override for the thread or turn. */
  model?: string | undefined;

  /** Approval policy override for the thread or turn. */
  approvalPolicy?: v2.AskForApproval | null | undefined;

  /** Sandbox mode for thread start. */
  sandboxMode?: v2.SandboxMode | null | undefined;

  /** Sandbox policy override for the turn. */
  sandboxPolicy?: v2.SandboxPolicy | null | undefined;

  /** Collaboration mode override for the turn. */
  collaborationMode?: CollaborationMode | null | undefined;

  /** Reasoning effort override for the turn. */
  reasoningEffort?: ReasoningEffort | null | undefined;

  /** Reasoning summary override for the turn. */
  reasoningSummary?: ReasoningSummary | null | undefined;

  /** Optional JSON Schema constraint for the turn output. */
  outputSchema?: JsonValue | null | undefined;

  /** Optional config overrides applied when starting/resuming the thread. */
  configOverrides?: Record<string, JsonValue> | null | undefined;

  /** Custom base instructions for the thread. */
  baseInstructions?: string | null | undefined;

  /** Custom developer instructions for the thread. */
  developerInstructions?: string | null | undefined;

  /** Emit data parts as transient (default true). */
  transientEvents?: boolean | undefined;

  /** How to respond to server approval requests if no handler is provided. */
  autoRespond?: "none" | "decline" | undefined;

  /** Optional event hook for each normalized Codex event. */
  onEvent?: CodexEventHandler | undefined;

  /** Optional handler for server-initiated requests (approvals, user input). */
  onServerRequest?:
    | ((
        request: ServerRequest,
        client: CodexAppServerClient,
      ) => void | Promise<void>)
    | undefined;

  /** Use an existing client instead of creating a new process. */
  client?: CodexAppServerClient | undefined;

  /** Options for creating a new Codex app-server client. */
  clientOptions?: CodexAppServerClientOptions | undefined;
};

type TextStreamState = {
  id: string | null;
  hasDelta: boolean;
};

function defaultTextState(): TextStreamState {
  return { id: null, hasDelta: false };
}

type ReasoningStreamState = {
  id: string;
};

async function autoRespondToServerRequest(
  request: ServerRequest,
  client: CodexAppServerClient,
): Promise<void> {
  switch (request.method) {
    case "item/commandExecution/requestApproval":
      await client.respondToCommandExecutionApproval(request.id, "decline");
      return;
    case "item/fileChange/requestApproval":
      await client.respondToFileChangeApproval(request.id, "decline");
      return;
    case "item/tool/requestUserInput":
      await client.respondToToolRequestUserInput(request.id, {});
      return;
    case "applyPatchApproval":
      await client.respondToApplyPatchApproval(request.id, "denied");
      return;
    case "execCommandApproval":
      await client.respondToExecCommandApproval(request.id, "denied");
      return;
    default: {
      const exhaustive: never = request;
      throw new Error(`Unhandled server request: ${String(exhaustive)}`);
    }
  }
}

/**
 * Create a UI message stream response that mirrors Codex app-server events.
 *
 * @remarks SPEC-023 defines the Codex app-server stream contract.
 */
export function createCodexAppServerUIStreamResponse(
  options: CodexAppServerUIStreamOptions,
): Response {
  const transientEvents = options.transientEvents ?? true;
  const autoRespond = options.autoRespond ?? "none";

  const stream = createUIMessageStream<CodexUIMessage>({
    async execute({ writer }) {
      const client =
        options.client ?? new CodexAppServerClient(options.clientOptions ?? {});
      const ownsClient = options.client === undefined;

      const textState = defaultTextState();
      const reasoningStreams = new Map<string, ReasoningStreamState>();

      const ensureReasoningStream = (key: string): ReasoningStreamState => {
        const existing = reasoningStreams.get(key);
        if (existing) return existing;
        const state: ReasoningStreamState = {
          id: randomUUID(),
        };
        reasoningStreams.set(key, state);
        writer.write({ type: "reasoning-start", id: state.id });
        return state;
      };

      const finalizeReasoningStreams = () => {
        for (const stream of reasoningStreams.values()) {
          writer.write({ type: "reasoning-end", id: stream.id });
        }
        reasoningStreams.clear();
      };

      const handleEvent: CodexEventHandler = async (event) => {
        writer.write({
          type: "data-codex-event",
          data: event,
          ...(transientEvents ? { transient: true } : {}),
        });

        if (event.type === "codex.message.delta") {
          if (!textState.id) {
            textState.id = randomUUID();
            textState.hasDelta = false;
            writer.write({ type: "text-start", id: textState.id });
          }
          textState.hasDelta = true;
          writer.write({
            type: "text-delta",
            id: textState.id,
            delta: event.textDelta,
          });
        }

        if (event.type === "codex.message.completed") {
          if (!textState.id) {
            textState.id = randomUUID();
            writer.write({ type: "text-start", id: textState.id });
          }
          if (!textState.hasDelta && event.text.length > 0) {
            writer.write({
              type: "text-delta",
              id: textState.id,
              delta: event.text,
            });
          }
          writer.write({ type: "text-end", id: textState.id });
          textState.id = null;
          textState.hasDelta = false;
        }

        if (event.type === "codex.reasoning.summary.delta") {
          if (event.delta.length > 0) {
            const key = `summary:${event.itemId ?? "unknown"}:${event.summaryIndex ?? 0}`;
            const stream = ensureReasoningStream(key);
            writer.write({
              type: "reasoning-delta",
              id: stream.id,
              delta: event.delta,
            });
          }
        }

        if (event.type === "codex.reasoning.text.delta") {
          if (event.delta.length > 0) {
            const key = `raw:${event.itemId ?? "unknown"}:${event.contentIndex ?? 0}`;
            const stream = ensureReasoningStream(key);
            writer.write({
              type: "reasoning-delta",
              id: stream.id,
              delta: event.delta,
            });
          }
        }

        if (options.onEvent) {
          await options.onEvent(event);
        }
      };

      await client.ensureStarted();

      let threadId = options.threadId;
      if (!threadId) {
        const threadStartParams: v2.ThreadStartParams = {
          model: options.model ?? null,
          modelProvider: null,
          cwd: options.cwd ?? null,
          approvalPolicy: options.approvalPolicy ?? null,
          sandbox: options.sandboxMode ?? null,
          config: options.configOverrides ?? null,
          baseInstructions: options.baseInstructions ?? null,
          developerInstructions: options.developerInstructions ?? null,
          experimentalRawEvents: true,
        };
        const started = await client.threadStart(threadStartParams);
        threadId = started.thread.id;
      } else {
        const resumeParams: v2.ThreadResumeParams = {
          threadId,
          history: null,
          path: null,
          model: options.model ?? null,
          modelProvider: null,
          cwd: options.cwd ?? null,
          approvalPolicy: options.approvalPolicy ?? null,
          sandbox: options.sandboxMode ?? null,
          config: options.configOverrides ?? null,
          baseInstructions: options.baseInstructions ?? null,
          developerInstructions: options.developerInstructions ?? null,
        };
        await client.threadResume(resumeParams);
      }

      let resolveDone: (() => void) | null = null;
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve;
      });

      const mapper = createCodexAppServerEventMapper({
        backend: "app-server",
        onEvent: handleEvent,
        onTurnCompleted: () => {
          if (resolveDone) {
            resolveDone();
            resolveDone = null;
          }
        },
      });

      mapper.setThreadId(threadId);

      const offNotification = client.onNotification((notification) => {
        void mapper.handleNotification(notification);
      });

      const offRequest = client.onServerRequest((request) => {
        void mapper.handleServerRequest(request);
        if (options.onServerRequest) {
          void options.onServerRequest(request, client);
          return;
        }
        if (autoRespond === "decline") {
          void autoRespondToServerRequest(request, client);
        }
      });

      const inputItems = options.input?.length ? options.input : undefined;
      const userInput: v2.UserInput =
        inputItems?.[0] ??
        ({
          type: "text",
          text: options.prompt,
          text_elements: [],
        } satisfies v2.UserInput);

      const turnStartParams: v2.TurnStartParams = {
        threadId,
        input: inputItems ?? [userInput],
        cwd: options.cwd ?? null,
        approvalPolicy: options.approvalPolicy ?? null,
        sandboxPolicy: options.sandboxPolicy ?? null,
        model: options.model ?? null,
        effort: options.reasoningEffort ?? null,
        summary: options.reasoningSummary ?? null,
        outputSchema: options.outputSchema ?? null,
        collaborationMode: options.collaborationMode ?? null,
      };

      try {
        await client.turnStart(turnStartParams);
        await done;
        await mapper.flushMessages();
        finalizeReasoningStreams();
        const error = mapper.getCompletionError();
        if (error) {
          throw error;
        }
      } finally {
        offNotification();
        offRequest();
        if (ownsClient) {
          await client.close();
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
