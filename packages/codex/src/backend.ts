import type { CodexEvent } from "./events.js";
import type { JsonObject, JsonValue } from "./types.js";

/** Supported Codex backend identifiers. */
export type CodexBackendKind = "app-server" | "exec" | "sdk";

/** Approval policies enforced by Codex before executing commands. */
export type CodexApprovalMode =
  | "untrusted"
  | "on-failure"
  | "on-request"
  | "never";
/** Sandbox modes for file system and network access. */
export type CodexSandboxMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

/**
 * Reasoning effort values are model-dependent.
 *
 * Notes:
 * - Codex CLI (and app-server mode) document "none | low | medium | high" as provider-level values.
 * - Codex CLI config also supports additional values like "minimal" and "xhigh" for certain models.
 *
 * This interface uses a superset; each backend may reject unsupported values.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type CodexReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

/** Thread persistence mode for app-server runs. */
export type CodexThreadMode = "persistent" | "stateless";

/** MCP server configuration forwarded to Codex backends. */
export type CodexMcpServerConfig = {
  command?: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  httpHeaders?: Record<string, string>;
};

/** Run-time options shared across Codex backends. */
export type CodexRunOptions = {
  /** Working directory used by Codex. Defaults to process.cwd(). */
  cwd?: string;

  /** Model ID (e.g., "gpt-5.2-codex"). Backends fall back to Codex defaults if omitted. */
  model?: string;

  approvalMode?: CodexApprovalMode;
  sandboxMode?: CodexSandboxMode;

  /**
   * Requested reasoning effort.
   * Backends may reject values not supported by their underlying transport/provider.
   */
  reasoningEffort?: CodexReasoningEffort;

  /**
   * App-server thread mode.
   * - "persistent" (default) keeps context across calls for the same backend instance.
   * - "stateless" creates a fresh thread per call.
   */
  threadMode?: CodexThreadMode;

  /** Extra environment variables for the underlying Codex process. */
  env?: Record<string, string>;

  /**
   * MCP server definitions to be forwarded to Codex.
   * - App-server backend forwards to the provider settings.
   * - Exec backend converts to `-c mcp_servers.<id>.*` overrides.
   */
  mcpServers?: Record<string, CodexMcpServerConfig>;

  /**
   * Additional Codex config overrides. Passed as `-c key=value` where values are JSON-encoded.
   */
  configOverrides?: Record<string, JsonValue>;

  /** Abort the run. */
  signal?: AbortSignal;

  /** Kill the run after this duration. */
  timeoutMs?: number;

  /** Exec-only: JSON Schema to pass to `codex exec --output-schema`. */
  outputSchemaJson?: JsonValue;

  /** Exec-only: path for `--output-last-message`. If omitted, a temp file is used. */
  outputPath?: string;

  /** Exec/app-server: override path to codex binary. */
  codexPath?: string;

  /**
   * Exec-only: extra args to prepend before `exec` (for test harnesses).
   * Example: ["/path/to/mock-codex.js"] when codexPath is "node".
   */
  codexArgsPrefix?: readonly string[];

  /** Exec/SDK: skip git repo checks if supported by the underlying backend. */
  skipGitRepoCheck?: boolean;
};

/** Normalized result returned by Codex backends. */
export type CodexRunResult = {
  backend: CodexBackendKind;
  model: string;
  threadId?: string;
  turnId?: string;
  text: string;
  structured?: JsonValue;
  exitCode?: number;
};

/** Event handler for normalized Codex events. */
export type CodexEventHandler = (event: CodexEvent) => void | Promise<void>;

/** Optional diagnostic details attached to Codex backend errors. */
export type CodexBackendErrorDetails = {
  exitCode?: number;
  stderrTail?: string;
  stdoutTail?: string;
  raw?: JsonObject;
};

/**
 * Error wrapper for backend-specific failures.
 *
 * @see docs/specs/020-codex-backends.md
 */
export class CodexBackendError extends Error {
  public readonly details: CodexBackendErrorDetails;

  public constructor(message: string, details: CodexBackendErrorDetails = {}) {
    super(message);
    this.name = "CodexBackendError";
    this.details = details;
  }
}

/**
 * Backend contract implemented by app-server, exec, and SDK backends.
 *
 * @see docs/specs/020-codex-backends.md
 */
export interface CodexBackend {
  readonly kind: CodexBackendKind;

  run(
    prompt: string,
    options: CodexRunOptions,
    onEvent?: CodexEventHandler,
  ): Promise<CodexRunResult>;

  /**
   * Optional cleanup hook for backends that own processes or other resources.
   */
  close?(): Promise<void>;

  /**
   * Optional mid-execution injection.
   * Only supported by app-server backend.
   */
  inject?(content: string): Promise<void>;

  /**
   * Optional interruption of an active turn.
   * Only supported by app-server backend.
   */
  interrupt?(): Promise<void>;
}
