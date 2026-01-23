import type {
  ServerRequest,
  v2,
} from "@codex-toolloop/codex-app-server-protocol";
import { CodexAppServerClient } from "./app-server/client.js";
import { createCodexAppServerEventMapper } from "./app-server/event-mapper.js";
import type {
  CodexBackend,
  CodexEventHandler,
  CodexRunOptions,
  CodexRunResult,
} from "./backend.js";
import { CodexBackendError } from "./backend.js";
import { DEFAULT_CODEX_MODEL } from "./constants.js";
import type { JsonValue } from "./types.js";

function sanitizeEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function mergeSignals(
  a: AbortSignal | undefined,
  b: AbortSignal | undefined,
): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      a.removeEventListener("abort", onAbort);
      b.removeEventListener("abort", onAbort);
    },
    { once: true },
  );
  if (a.aborted || b.aborted) controller.abort();
  return controller.signal;
}

function createTimeoutSignal(
  timeoutMs: number | undefined,
): AbortSignal | null {
  if (!timeoutMs || timeoutMs <= 0) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  return controller.signal;
}

function buildThreadStartConfig(
  options: CodexRunOptions,
): Record<string, JsonValue> | null {
  const configOverrides: Record<string, JsonValue> = {
    ...(options.configOverrides ?? {}),
  };

  if (options.reasoningEffort) {
    configOverrides.model_reasoning_effort = options.reasoningEffort;
  }
  if (options.skipGitRepoCheck) {
    configOverrides.skip_git_repo_check = true;
  }

  if (options.mcpServers) {
    for (const [serverId, cfg] of Object.entries(options.mcpServers)) {
      if (cfg.command && cfg.url) {
        throw new CodexBackendError(
          `MCP server "${serverId}" must not set both command and url.`,
        );
      }
      const prefix = `mcp_servers.${serverId}.`;
      if (cfg.command) configOverrides[`${prefix}command`] = cfg.command;
      if (cfg.args) configOverrides[`${prefix}args`] = [...cfg.args];
      if (cfg.cwd) configOverrides[`${prefix}cwd`] = cfg.cwd;
      if (cfg.env) configOverrides[`${prefix}env`] = cfg.env;
      if (cfg.url) configOverrides[`${prefix}url`] = cfg.url;
      if (cfg.httpHeaders) {
        configOverrides[`${prefix}http_headers`] = cfg.httpHeaders;
      }
    }
  }

  return Object.keys(configOverrides).length > 0 ? configOverrides : null;
}

/**
 * Configuration options for the app-server backend.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type AppServerBackendConfig = {
  /** Default Codex binary path for app-server mode. */
  codexPath?: string;

  /** Default model to use if none is provided at run time. */
  defaultModel?: string;
};

/**
 * App-server backend that communicates with `codex app-server` over JSONL stdio.
 *
 * @see docs/specs/020-codex-backends.md
 * @see https://developers.openai.com/codex/app-server/
 */
export class AppServerBackend implements CodexBackend {
  public readonly kind = "app-server" as const;

  private readonly config: AppServerBackendConfig;
  private client: CodexAppServerClient | null = null;
  private clientSettingsKey: string | null = null;

  private threadId: string | undefined;
  private activeTurnId: string | undefined;

  public constructor(config: AppServerBackendConfig = {}) {
    this.config = config;
  }

  public async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.clientSettingsKey = null;
    this.threadId = undefined;
    this.activeTurnId = undefined;
  }

  public async run(
    prompt: string,
    options: CodexRunOptions,
    onEvent?: CodexEventHandler,
  ): Promise<CodexRunResult> {
    const cwd = options.cwd ?? process.cwd();
    const env = sanitizeEnv({ ...process.env, ...(options.env ?? {}) });
    const modelId =
      options.model ?? this.config.defaultModel ?? DEFAULT_CODEX_MODEL;
    const threadMode = options.threadMode ?? "persistent";

    const threadStartConfig = buildThreadStartConfig(options);

    const clientSettingsKey = JSON.stringify({
      cwd,
      codexPath: options.codexPath ?? this.config.codexPath ?? null,
      envOverrides: options.env ?? null,
    });

    const recreateClient =
      this.client === null || this.clientSettingsKey !== clientSettingsKey;

    if (recreateClient) {
      await this.close();
      this.clientSettingsKey = clientSettingsKey;
      this.client = new CodexAppServerClient({
        ...(options.codexPath !== undefined ||
        this.config.codexPath !== undefined
          ? { codexPath: options.codexPath ?? this.config.codexPath }
          : {}),
        cwd,
        env,
      });
      await this.client.ensureStarted();
    }

    const client = this.client;
    if (!client) {
      throw new Error("App-server client not initialized");
    }

    let resolveDone: (() => void) | null = null;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const markDone = () => {
      if (!resolveDone) return;
      const resolve = resolveDone;
      resolveDone = null;
      resolve();
    };

    const mapper = createCodexAppServerEventMapper({
      backend: this.kind,
      onEvent,
      onTurnCompleted: () => markDone(),
    });

    const offNotification = client.onNotification((notification) => {
      void mapper.handleNotification(notification);
    });

    const offRequest = client.onServerRequest((request) => {
      void mapper.handleServerRequest(request);
      void this.respondToServerRequest(client, request);
    });

    if (threadMode === "stateless") {
      this.threadId = undefined;
    }

    if (!this.threadId) {
      const threadStartParams: v2.ThreadStartParams = {
        model: modelId,
        modelProvider: null,
        cwd,
        approvalPolicy: options.approvalMode ?? null,
        sandbox: options.sandboxMode ?? null,
        config: threadStartConfig,
        baseInstructions: options.baseInstructions ?? null,
        developerInstructions: options.developerInstructions ?? null,
        experimentalRawEvents: true,
      };

      const started = await client.threadStart(threadStartParams);

      this.threadId = started.thread.id;
      mapper.setThreadId(this.threadId);
    } else if (recreateClient) {
      const resumeParams: v2.ThreadResumeParams = {
        threadId: this.threadId,
        history: null,
        path: null,
        model: null,
        modelProvider: null,
        cwd,
        approvalPolicy: options.approvalMode ?? null,
        sandbox: options.sandboxMode ?? null,
        config: threadStartConfig,
        baseInstructions: options.baseInstructions ?? null,
        developerInstructions: options.developerInstructions ?? null,
      };
      const resumed = await client.threadResume(resumeParams);
      this.threadId = resumed.thread.id;
      mapper.setThreadId(this.threadId);
    } else {
      mapper.setThreadId(this.threadId);
    }

    const threadId = this.threadId;
    const textElements: v2.TextElement[] = [];
    const userInput: v2.UserInput = {
      type: "text",
      text: prompt,
      text_elements: textElements,
    };
    const inputItems = options.input ?? [userInput];

    const timeoutSignal = createTimeoutSignal(options.timeoutMs);
    const signal = mergeSignals(options.signal, timeoutSignal ?? undefined);

    const abortListener = () => {
      void this.interrupt();
    };

    if (signal) {
      if (signal.aborted) {
        offNotification();
        offRequest();
        return { backend: this.kind, model: modelId, text: "", threadId };
      }
      signal.addEventListener("abort", abortListener, { once: true });
    }

    try {
      const turnStartParams: v2.TurnStartParams = {
        threadId,
        input: inputItems,
        cwd,
        approvalPolicy: options.approvalMode ?? null,
        sandboxPolicy: options.sandboxPolicy ?? null,
        model: options.model ?? null,
        effort: options.reasoningEffort ?? null,
        summary: options.reasoningSummary ?? null,
        outputSchema: options.outputSchema ?? null,
        collaborationMode: options.collaborationMode ?? null,
      };

      const startedTurn = await client.turnStart(turnStartParams);
      this.activeTurnId = startedTurn.turn.id;

      const aborted =
        signal === undefined
          ? new Promise<void>(() => {})
          : new Promise<void>((resolve) => {
              if (signal.aborted) {
                resolve();
                return;
              }
              signal.addEventListener("abort", () => resolve(), { once: true });
            });

      await Promise.race([done, aborted]);

      if (signal?.aborted) {
        return { backend: this.kind, model: modelId, text: "", threadId };
      }

      await mapper.flushMessages();
      const completionError = mapper.getCompletionError();
      if (completionError) {
        throw completionError;
      }

      const fullText = mapper.getFullText();

      return {
        backend: this.kind,
        model: modelId,
        threadId,
        turnId: this.activeTurnId,
        text: fullText,
      };
    } finally {
      offNotification();
      offRequest();
      if (signal) {
        signal.removeEventListener("abort", abortListener);
      }
      this.activeTurnId = undefined;
    }
  }

  public async interrupt(): Promise<void> {
    if (!this.client || !this.threadId || !this.activeTurnId) {
      throw new CodexBackendError(
        "No active app-server turn. Start a run before calling interrupt().",
      );
    }
    const params: v2.TurnInterruptParams = {
      threadId: this.threadId,
      turnId: this.activeTurnId,
    };
    await this.client.turnInterrupt(params);
  }

  public async inject(): Promise<void> {
    throw new CodexBackendError(
      "inject() is not supported by codex app-server v2; start a new run instead.",
    );
  }

  private async respondToServerRequest(
    client: CodexAppServerClient,
    request: ServerRequest,
  ): Promise<void> {
    // Default behavior is conservative: decline approvals and provide empty
    // user-input answers. Products integrating Codex should surface these to
    // a UI and respond explicitly.
    switch (request.method) {
      case "item/commandExecution/requestApproval":
      case "item/fileChange/requestApproval": {
        if (request.method === "item/commandExecution/requestApproval") {
          await client.respondToCommandExecutionApproval(request.id, "decline");
          return;
        }
        await client.respondToFileChangeApproval(request.id, "decline");
        return;
      }
      case "item/tool/requestUserInput": {
        await client.respondToToolRequestUserInput(request.id, {});
        return;
      }
      case "applyPatchApproval":
      case "execCommandApproval": {
        if (request.method === "applyPatchApproval") {
          await client.respondToApplyPatchApproval(request.id, "denied");
          return;
        }
        await client.respondToExecCommandApproval(request.id, "denied");
        return;
      }
      default: {
        const exhaustive: never = request;
        throw new Error(`Unhandled server request: ${String(exhaustive)}`);
      }
    }
  }
}
