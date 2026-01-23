import { Codex } from "@openai/codex-sdk";
import type {
  CodexBackend,
  CodexEventHandler,
  CodexRunOptions,
  CodexRunResult,
} from "./backend.js";
import { CodexBackendError } from "./backend.js";
import {
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_CODEX_MODEL,
  DEFAULT_SANDBOX_MODE,
} from "./constants.js";
import type { CodexEvent } from "./events.js";
import {
  createThreadEventMapper,
  parseThreadEventLike,
} from "./exec-events.js";

type CodexClientConfig = ConstructorParameters<typeof Codex>[0];
type CodexClient = Pick<Codex, "startThread">;

/**
 * Configuration for the Codex SDK backend.
 *
 * Provide `codexClient` to inject a preconfigured client (useful for tests).
 *
 * @see docs/specs/020-codex-backends.md
 */
export type SdkBackendConfig = CodexClientConfig & {
  defaultModel?: string;
  codexClient?: CodexClient;
};

/**
 * SDK-backed Codex runner using the OpenAI Codex SDK threads.
 *
 * @see docs/specs/020-codex-backends.md
 * @see docs/specs/021-sdk-backend-option-fidelity.md
 */
export class SdkBackend implements CodexBackend {
  public readonly kind = "sdk" as const;

  private readonly codex: CodexClient;
  private readonly defaultModel: string;

  private thread: ReturnType<Codex["startThread"]> | null = null;
  private threadConfigKey: string | null = null;

  public constructor(config: SdkBackendConfig = {}) {
    const { defaultModel, codexClient, ...clientConfig } = config;
    this.defaultModel = defaultModel ?? DEFAULT_CODEX_MODEL;
    this.codex = codexClient ?? new Codex(clientConfig);
  }

  public async run(
    prompt: string,
    options: CodexRunOptions,
    onEvent?: CodexEventHandler,
  ): Promise<CodexRunResult> {
    const cwd = options.cwd ?? process.cwd();

    type ThreadOptions = NonNullable<Parameters<Codex["startThread"]>[0]>;
    type ModelReasoningEffort = NonNullable<
      ThreadOptions["modelReasoningEffort"]
    >;

    const effectiveModel = options.model ?? this.defaultModel;

    const supportedReasoningEfforts = [
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ] as const;

    let modelReasoningEffort: ModelReasoningEffort | undefined;
    switch (options.reasoningEffort) {
      case undefined:
        break;
      case "minimal":
      case "low":
      case "medium":
      case "high":
      case "xhigh":
        modelReasoningEffort = options.reasoningEffort;
        break;
      case "none":
        throw new CodexBackendError(
          `SDK backend does not support reasoningEffort: "none". Supported values: ${supportedReasoningEfforts.join(
            ", ",
          )}.`,
        );
      default:
        throw new CodexBackendError(
          `SDK backend does not support reasoningEffort: ${JSON.stringify(
            options.reasoningEffort,
          )}. Supported values: ${supportedReasoningEfforts.join(", ")}.`,
        );
    }

    const unsupported: string[] = [];
    if (options.timeoutMs !== undefined) {
      unsupported.push("timeoutMs");
    }
    if (options.mcpServers !== undefined) {
      unsupported.push("mcpServers");
    }
    if (options.configOverrides !== undefined) {
      unsupported.push("configOverrides");
    }
    if (options.threadMode !== undefined) {
      unsupported.push("threadMode");
    }
    if (options.codexPath !== undefined) {
      unsupported.push("codexPath");
    }
    if (options.codexArgsPrefix !== undefined) {
      unsupported.push("codexArgsPrefix");
    }
    if (options.sandboxPolicy !== undefined) {
      unsupported.push("sandboxPolicy");
    }
    if (options.baseInstructions !== undefined) {
      unsupported.push("baseInstructions");
    }
    if (options.developerInstructions !== undefined) {
      unsupported.push("developerInstructions");
    }
    if (options.reasoningSummary !== undefined) {
      unsupported.push("reasoningSummary");
    }
    if (options.collaborationMode !== undefined) {
      unsupported.push("collaborationMode");
    }
    if (options.outputSchemaJson !== undefined) {
      unsupported.push("outputSchemaJson");
    }
    if (unsupported.length > 0) {
      throw new CodexBackendError(
        `SDK backend does not support options: ${unsupported.join(", ")}.`,
      );
    }

    const sandboxMode = options.sandboxMode ?? DEFAULT_SANDBOX_MODE;
    const approvalPolicy = options.approvalMode ?? DEFAULT_APPROVAL_POLICY;

    const threadConfigKey = JSON.stringify({
      cwd,
      model: effectiveModel,
      modelReasoningEffort,
      sandboxMode,
      approvalPolicy,
      skipGitRepoCheck: options.skipGitRepoCheck,
      networkAccessEnabled: options.networkAccessEnabled ?? null,
      webSearchMode: options.webSearchMode ?? null,
      webSearchEnabled: options.webSearchEnabled ?? null,
      additionalDirectories: options.additionalDirectories ?? null,
    });

    if (this.thread === null || this.threadConfigKey !== threadConfigKey) {
      this.threadConfigKey = threadConfigKey;
      this.thread = this.codex.startThread({
        workingDirectory: cwd,
        sandboxMode,
        approvalPolicy,
        model: effectiveModel,
        ...(modelReasoningEffort !== undefined ? { modelReasoningEffort } : {}),
        ...(options.skipGitRepoCheck !== undefined
          ? { skipGitRepoCheck: options.skipGitRepoCheck }
          : {}),
        ...(options.networkAccessEnabled !== undefined
          ? { networkAccessEnabled: options.networkAccessEnabled }
          : {}),
        ...(options.webSearchMode !== undefined
          ? { webSearchMode: options.webSearchMode }
          : {}),
        ...(options.webSearchEnabled !== undefined
          ? { webSearchEnabled: options.webSearchEnabled }
          : {}),
        ...(options.additionalDirectories !== undefined
          ? { additionalDirectories: options.additionalDirectories }
          : {}),
      });
    }

    const thread = this.thread;
    if (!thread) {
      throw new CodexBackendError("Codex SDK thread is not initialized.");
    }

    const mapper = createThreadEventMapper(this.kind);

    const emit = async (event: CodexEvent) => {
      if (!onEvent) {
        return;
      }
      try {
        await onEvent(event);
      } catch (error) {
        const details = {
          threadId,
          turnId,
          eventType: event.type,
        };
        console.error(
          "Codex SDK event handler failed; continuing stream.",
          details,
          error,
        );
      }
    };

    let lastText = "";
    let threadId: string | undefined;
    let turnId: string | undefined;

    type SdkUserInput =
      | { type: "text"; text: string }
      | { type: "local_image"; path: string };

    const toSdkInput = (): string | SdkUserInput[] => {
      if (!options.input) {
        return prompt;
      }
      const items: SdkUserInput[] = [];
      for (const item of options.input) {
        if (item.type === "text") {
          items.push({ type: "text", text: item.text });
          continue;
        }
        if (item.type === "localImage") {
          items.push({ type: "local_image", path: item.path });
          continue;
        }
        throw new CodexBackendError(
          `SDK backend does not support input item type: "${item.type}".`,
        );
      }
      return items;
    };

    const turnOptions = {
      ...(options.outputSchema !== undefined
        ? { outputSchema: options.outputSchema }
        : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    };

    const { events } = await thread.runStreamed(toSdkInput(), turnOptions);

    for await (const raw of events) {
      const parsed = parseThreadEventLike(raw);
      if (!parsed) {
        continue;
      }
      if (parsed.thread_id) {
        threadId = parsed.thread_id;
      }
      if (parsed.turn_id) {
        turnId = parsed.turn_id;
      }

      const mapped = mapper(parsed);
      for (const e of mapped) {
        if (e.type === "codex.message.delta") {
          lastText += e.textDelta;
        }
        if (e.type === "codex.message.completed") {
          lastText = e.text;
        }
        await emit(e);
      }
    }

    return {
      backend: this.kind,
      model: effectiveModel,
      text: lastText,
      ...(threadId !== undefined ? { threadId } : {}),
      ...(turnId !== undefined ? { turnId } : {}),
    };
  }
}
