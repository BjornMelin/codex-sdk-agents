import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  ClientInfo,
  InitializeParams,
  InitializeResponse,
  RequestId,
  ServerNotification,
  ServerRequest,
} from "@codex-toolloop/codex-app-server-protocol";

import { CodexBackendError } from "../backend.js";
import { getCodexAppServerSchemaValidators } from "./schema.js";

export type CodexAppServerLogger = {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
};

export type CodexAppServerProcessOptions = {
  codexPath?: string | undefined;
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
  logger?: CodexAppServerLogger | false | undefined;
  requestTimeoutMs?: number | undefined;
  clientInfo?: ClientInfo | undefined;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type JsonRpcRequest = { id: RequestId; method: string; params?: unknown };
type JsonRpcNotification = { method: string; params?: unknown };
type JsonRpcResponse = { id: RequestId; result: unknown };
type JsonRpcError = {
  id: RequestId;
  error: { code: number; message: string; data?: unknown };
};

type NotificationListener = (notification: ServerNotification) => void;
type ServerRequestListener = (request: ServerRequest) => void;

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

function defaultLogger(): CodexAppServerLogger {
  return {
    debug: () => {},
    info: () => {},
    warn: (message, data) => console.warn(message, data),
    error: (message, data) => console.error(message, data),
  };
}

function isJsonRpcError(value: unknown): value is JsonRpcError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "id" in value
  );
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "result" in value
  );
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "method" in value
  );
}

function isJsonRpcNotification(value: unknown): value is JsonRpcNotification {
  return (
    typeof value === "object" &&
    value !== null &&
    !("id" in value) &&
    "method" in value
  );
}

/**
 * JSONL-over-stdio Codex app-server v2 process manager (single process).
 *
 * @see docs/research/codex-0.89.0-delta.md
 */
export class CodexAppServerProcess {
  private readonly options: CodexAppServerProcessOptions;
  private readonly logger: CodexAppServerLogger;
  private readonly validators = getCodexAppServerSchemaValidators();

  private child: ChildProcessWithoutNullStreams | null = null;
  private started: Promise<void> | null = null;
  private nextRequestId = 1;

  private pendingRequests = new Map<RequestId, PendingRequest>();
  private notificationListeners = new Set<NotificationListener>();
  private serverRequestListeners = new Set<ServerRequestListener>();

  public constructor(options: CodexAppServerProcessOptions = {}) {
    this.options = options;
    this.logger =
      options.logger === false
        ? defaultLogger()
        : (options.logger ?? defaultLogger());
  }

  public onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  public onServerRequest(listener: ServerRequestListener): () => void {
    this.serverRequestListeners.add(listener);
    return () => this.serverRequestListeners.delete(listener);
  }

  public async ensureStarted(): Promise<void> {
    if (this.started) {
      await this.started;
      return;
    }
    this.started = this.start();
    await this.started;
  }

  public async close(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.started = null;

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Codex app-server connection closed"));
      this.pendingRequests.delete(id);
    }

    if (!child) {
      return;
    }

    child.removeAllListeners();
    child.stdin.end();
    child.kill("SIGTERM");
  }

  public async request<TResponse>(
    method: string,
    params: unknown,
  ): Promise<TResponse> {
    await this.ensureStarted();

    const requestId = this.nextRequestId++;
    const request: JsonRpcRequest = {
      id: requestId,
      method,
      params: params as Record<string, unknown>,
    };

    if (!this.validators.isJsonRpcRequest(request)) {
      throw new CodexBackendError("Invalid outbound JSON-RPC request.", {
        raw: { method, requestId },
      });
    }

    return await new Promise<TResponse>((resolve, reject) => {
      const timeoutMs =
        this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.sendLine(request);
    });
  }

  public async notify(method: string, params?: unknown): Promise<void> {
    await this.ensureStarted();
    const notification: JsonRpcNotification =
      params === undefined
        ? { method }
        : { method, params: params as Record<string, unknown> };

    if (!this.validators.isJsonRpcNotification(notification)) {
      throw new CodexBackendError("Invalid outbound JSON-RPC notification.", {
        raw: { method },
      });
    }

    this.sendLine(notification);
  }

  public async sendResponse(
    requestId: RequestId,
    result: unknown,
  ): Promise<void> {
    await this.ensureStarted();
    const response: JsonRpcResponse = { id: requestId, result };

    if (!this.validators.isJsonRpcResponse(response)) {
      throw new CodexBackendError("Invalid outbound JSON-RPC response.", {
        raw: { requestId },
      });
    }

    this.sendLine(response);
  }

  public async sendError(
    requestId: RequestId,
    error: JsonRpcError["error"],
  ): Promise<void> {
    await this.ensureStarted();
    const msg: JsonRpcError = { id: requestId, error };

    if (!this.validators.isJsonRpcError(msg)) {
      throw new CodexBackendError("Invalid outbound JSON-RPC error.", {
        raw: { requestId },
      });
    }

    this.sendLine(msg);
  }

  private async start(): Promise<void> {
    const codexPath = this.options.codexPath ?? "codex";
    this.logger.info("Starting codex app-server.", { codexPath });

    const child = spawn(codexPath, ["app-server"], {
      stdio: "pipe",
      cwd: this.options.cwd,
      env: { ...process.env, ...(this.options.env ?? {}) },
    });
    this.child = child;

    child.on("exit", (code, signal) => {
      this.logger.warn("codex app-server exited.", { code, signal });
      void this.close();
    });
    child.on("error", (err) => {
      this.logger.error("codex app-server process error.", {
        message: err.message,
      });
      void this.close();
    });

    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => this.handleStdoutLine(line));

    const stderrRl = createInterface({ input: child.stderr });
    stderrRl.on("line", (line) =>
      this.logger.debug("[codex stderr]", { line }),
    );

    const initParams: InitializeParams = {
      clientInfo: this.options.clientInfo ?? {
        name: "codex-toolloop",
        title: "Codex ToolLoop",
        version: "0.1.0",
      },
    };

    const init = await this.request<InitializeResponse>(
      "initialize",
      initParams,
    );
    this.logger.debug("codex app-server initialize response.", init);

    await this.notify("initialized");
  }

  private sendLine(
    message:
      | JsonRpcRequest
      | JsonRpcNotification
      | JsonRpcResponse
      | JsonRpcError,
  ): void {
    const child = this.child;
    if (!child) {
      throw new Error("codex app-server process not started");
    }
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleStdoutLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      this.logger.warn("Failed to parse codex app-server JSONL line.", {
        line,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (!this.validators.isJsonRpcMessage(parsed)) {
      this.logger.warn(
        "Received invalid JSON-RPC message from codex app-server.",
        {
          line,
        },
      );
      return;
    }

    if (isJsonRpcResponse(parsed)) {
      this.handleResponse(parsed);
      return;
    }

    if (isJsonRpcError(parsed)) {
      this.handleErrorResponse(parsed);
      return;
    }

    if (isJsonRpcRequest(parsed)) {
      if (!this.validators.isServerRequest(parsed)) {
        this.logger.warn("Received invalid server request.", { line });
        return;
      }
      for (const listener of this.serverRequestListeners) listener(parsed);
      return;
    }

    if (isJsonRpcNotification(parsed)) {
      if (!this.validators.isServerNotification(parsed)) {
        this.logger.warn("Received invalid server notification.", { line });
        return;
      }
      for (const listener of this.notificationListeners) listener(parsed);
      return;
    }

    this.logger.warn("Received unknown JSON-RPC message shape.", { line });
  }

  private handleResponse(message: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.logger.debug("Ignoring unmatched JSON-RPC response.", {
        id: message.id,
      });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);
    pending.resolve(message.result);
  }

  private handleErrorResponse(message: JsonRpcError): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.logger.debug("Ignoring unmatched JSON-RPC error.", {
        id: message.id,
        error: message.error,
      });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);
    pending.reject(
      new CodexBackendError(message.error.message, {
        raw: { code: message.error.code, message: message.error.message },
      }),
    );
  }
}
