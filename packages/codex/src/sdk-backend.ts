import { Codex } from "@openai/codex-sdk";
import type {
  CodexBackend,
  CodexEventHandler,
  CodexRunOptions,
  CodexRunResult,
} from "./backend.js";
import { CodexBackendError } from "./backend.js";
import { DEFAULT_CODEX_MODEL } from "./constants.js";
import type { CodexEvent } from "./events.js";
import {
  createThreadEventMapper,
  parseThreadEventLike,
} from "./exec-events.js";

type CodexClientConfig = ConstructorParameters<typeof Codex>[0];

/**
 * Configuration for the Codex SDK backend.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type SdkBackendConfig = CodexClientConfig & {
  defaultModel?: string;
};

/**
 * SDK-backed Codex runner using @openai/codex-sdk threads.
 *
 * @see docs/specs/020-codex-backends.md
 * @see docs/specs/021-sdk-backend-option-fidelity.md
 */
export class SdkBackend implements CodexBackend {
  public readonly kind = "sdk" as const;

  private readonly codex: Codex;
  private readonly defaultModel: string;

  private thread: ReturnType<Codex["startThread"]> | null = null;
  private threadConfigKey: string | null = null;

  public constructor(config: SdkBackendConfig = {}) {
    const { defaultModel, ...clientConfig } = config;
    this.defaultModel = defaultModel ?? DEFAULT_CODEX_MODEL;
    this.codex = new Codex(clientConfig);
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

    const sandboxMode = options.sandboxMode ?? "read-only";
    const approvalPolicy = options.approvalMode ?? "never";

    const threadConfigKey = JSON.stringify({
      cwd,
      model: effectiveModel,
      modelReasoningEffort,
      sandboxMode,
      approvalPolicy,
      skipGitRepoCheck: options.skipGitRepoCheck,
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
      });
    }

    const mapper = createThreadEventMapper(this.kind);

    const emit = async (event: CodexEvent) => {
      if (!onEvent) {
        return;
      }
      await onEvent(event);
    };

    let lastText = "";
    let threadId: string | undefined;
    let turnId: string | undefined;

    const { events } = await this.thread.runStreamed(prompt);

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
