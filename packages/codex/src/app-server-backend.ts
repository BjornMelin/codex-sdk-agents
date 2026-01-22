import { streamText } from "ai";
import {
  createCodexAppServer,
  type McpServerConfigOrSdk,
  type McpServerHttp,
  type McpServerStdio,
} from "ai-sdk-provider-codex-app-server";
import type {
  CodexBackend,
  CodexEventHandler,
  CodexMcpServerConfig,
  CodexReasoningEffort,
  CodexRunOptions,
  CodexRunResult,
} from "./backend.js";
import { CodexBackendError } from "./backend.js";
import { DEFAULT_CODEX_MODEL } from "./constants.js";
import type { CodexEvent } from "./events.js";

type Provider = ReturnType<typeof createCodexAppServer>;
type ProviderInit = NonNullable<Parameters<typeof createCodexAppServer>[0]>;
type DefaultSettings = NonNullable<ProviderInit["defaultSettings"]>;
type OnSessionCreated = NonNullable<DefaultSettings["onSessionCreated"]>;
type Session = Parameters<OnSessionCreated>[0];

type ProviderReasoningEffort = NonNullable<DefaultSettings["reasoningEffort"]>;
type ProviderThreadMode = NonNullable<DefaultSettings["threadMode"]>;

function nowMs(): number {
  return Date.now();
}

function isProviderReasoningEffort(
  value: CodexReasoningEffort,
): value is ProviderReasoningEffort {
  return (
    value === "none" ||
    value === "low" ||
    value === "medium" ||
    value === "high"
  );
}

function isProviderThreadMode(value: string): value is ProviderThreadMode {
  return value === "persistent" || value === "stateless";
}

function sanitizeEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function resolveMcpServers(
  servers: Record<string, CodexMcpServerConfig> | undefined,
): Record<string, McpServerConfigOrSdk> | undefined {
  if (!servers) {
    return undefined;
  }

  const out: Record<string, McpServerConfigOrSdk> = {};

  for (const [id, cfg] of Object.entries(servers)) {
    const hasStdio = cfg.command !== undefined;
    const hasHttp = cfg.url !== undefined;

    if (hasStdio && hasHttp) {
      throw new CodexBackendError(
        `MCP server '${id}' must not set both command and url.`,
      );
    }

    if (!hasStdio && !hasHttp) {
      throw new CodexBackendError(
        `MCP server '${id}' must set command (stdio) or url (http).`,
      );
    }

    if (hasStdio) {
      const stdio: McpServerStdio = {
        transport: "stdio",
        command: cfg.command ?? "",
        ...(cfg.args !== undefined ? { args: [...cfg.args] } : {}),
        ...(cfg.cwd !== undefined ? { cwd: cfg.cwd } : {}),
        ...(cfg.env !== undefined ? { env: cfg.env } : {}),
      };
      out[id] = stdio;
      continue;
    }

    const http: McpServerHttp = {
      transport: "http",
      url: cfg.url ?? "",
      ...(cfg.httpHeaders !== undefined
        ? { httpHeaders: cfg.httpHeaders }
        : {}),
    };
    out[id] = http;
  }

  return out;
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
 * App-server backend using the AI SDK Codex provider.
 *
 * @see docs/specs/020-codex-backends.md
 */
export class AppServerBackend implements CodexBackend {
  public readonly kind = "app-server" as const;

  private readonly config: AppServerBackendConfig;
  private provider: Provider | null = null;
  private providerSettingsKey: string | null = null;

  private session: Session | null = null;
  private lastThreadId: string | undefined;

  public constructor(config: AppServerBackendConfig = {}) {
    this.config = config;
  }

  public async run(
    prompt: string,
    options: CodexRunOptions,
    onEvent?: CodexEventHandler,
  ): Promise<CodexRunResult> {
    const cwd = options.cwd ?? process.cwd();
    const env = sanitizeEnv({ ...process.env, ...(options.env ?? {}) });
    const resolvedMcpServers = resolveMcpServers(options.mcpServers);

    const modelId =
      options.model ?? this.config.defaultModel ?? DEFAULT_CODEX_MODEL;
    const rawThreadMode = options.threadMode ?? "persistent";
    const threadMode: ProviderThreadMode = isProviderThreadMode(rawThreadMode)
      ? rawThreadMode
      : "persistent";

    const reasoningEffort: ProviderReasoningEffort | undefined =
      options.reasoningEffort !== undefined &&
      isProviderReasoningEffort(options.reasoningEffort)
        ? options.reasoningEffort
        : undefined;

    if (
      options.reasoningEffort !== undefined &&
      reasoningEffort === undefined
    ) {
      throw new CodexBackendError(
        `app-server backend does not support reasoningEffort=${options.reasoningEffort}. ` +
          "Use one of: none | low | medium | high, or use the exec backend for minimal/xhigh.",
      );
    }

    const settingsKey = JSON.stringify({
      cwd,
      codexPath: options.codexPath ?? this.config.codexPath ?? null,
      approvalMode: options.approvalMode ?? null,
      sandboxMode: options.sandboxMode ?? null,
      mcpServers: resolvedMcpServers ?? null,
      // We only include env overrides to avoid baking the entire parent environment into the key.
      envOverrides: options.env ?? null,
    });

    const emit = async (event: CodexEvent) => {
      if (!onEvent) {
        return;
      }
      await onEvent(event);
    };

    let threadStartedEmitted = false;
    const emitThreadStarted = async () => {
      if (threadStartedEmitted || !this.lastThreadId) {
        return;
      }
      threadStartedEmitted = true;
      await emit({
        type: "codex.thread.started",
        backend: this.kind,
        timestampMs: nowMs(),
        threadId: this.lastThreadId,
      });
    };

    if (this.provider === null || this.providerSettingsKey !== settingsKey) {
      this.providerSettingsKey = settingsKey;
      this.session = null;
      this.lastThreadId = undefined;

      this.provider = createCodexAppServer({
        defaultSettings: {
          ...(options.codexPath !== undefined ||
          this.config.codexPath !== undefined
            ? { codexPath: options.codexPath ?? this.config.codexPath }
            : {}),
          cwd,
          ...(options.approvalMode !== undefined
            ? { approvalMode: options.approvalMode }
            : {}),
          ...(options.sandboxMode !== undefined
            ? { sandboxMode: options.sandboxMode }
            : {}),
          ...(resolvedMcpServers !== undefined
            ? { mcpServers: resolvedMcpServers }
            : {}),
          env,
          onSessionCreated: (s) => {
            this.session = s;
            this.lastThreadId = s.threadId;
            emitThreadStarted().catch((err) => {
              console.error("Failed to emit thread.started event:", err);
            });
          },
        },
      });
    }

    const provider = this.provider;
    const model = provider(modelId);

    const result = await streamText({
      model,
      prompt,
      ...(options.signal ? { abortSignal: options.signal } : {}),
      ...(options.timeoutMs !== undefined
        ? { timeout: options.timeoutMs }
        : {}),
      providerOptions: {
        "codex-app-server": {
          reasoningEffort,
          threadMode,
        },
      },
    });

    try {
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          await emitThreadStarted();

          const textDelta = part.text;
          await emit({
            type: "codex.message.delta",
            backend: this.kind,
            timestampMs: nowMs(),
            ...(this.lastThreadId !== undefined
              ? { threadId: this.lastThreadId }
              : {}),
            textDelta,
          });
        }
      }

      const fullText = await result.text;

      await emit({
        type: "codex.message.completed",
        backend: this.kind,
        timestampMs: nowMs(),
        ...(this.lastThreadId !== undefined
          ? { threadId: this.lastThreadId }
          : {}),
        text: fullText,
      });

      return {
        backend: this.kind,
        model: modelId,
        text: fullText,
        ...(this.lastThreadId !== undefined
          ? { threadId: this.lastThreadId }
          : {}),
      };
    } catch (err) {
      await emit({
        type: "codex.error",
        backend: this.kind,
        timestampMs: nowMs(),
        message: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  public async inject(content: string): Promise<void> {
    if (!this.session) {
      throw new CodexBackendError(
        "No active app-server session. Start a run before calling inject().",
      );
    }
    await this.session.injectMessage(content);
  }

  public async interrupt(): Promise<void> {
    if (!this.session) {
      throw new CodexBackendError(
        "No active app-server session. Start a run before calling interrupt().",
      );
    }
    await this.session.interrupt();
  }
}
