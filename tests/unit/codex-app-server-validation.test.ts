import { beforeEach, describe, expect, it, vi } from "vitest";

type RecordedRequest = { method: string; params: unknown };

const requests: RecordedRequest[] = [];

vi.mock("../../packages/codex/src/app-server/process.js", () => {
  class FakeCodexAppServerProcess {
    public onNotificationListeners = new Set<(n: unknown) => void>();
    public onServerRequestListeners = new Set<(r: unknown) => void>();

    public async ensureStarted(): Promise<void> {}
    public async close(): Promise<void> {}

    public onNotification(
      listener: (notification: unknown) => void,
    ): () => void {
      this.onNotificationListeners.add(listener);
      return () => this.onNotificationListeners.delete(listener);
    }

    public onServerRequest(listener: (request: unknown) => void): () => void {
      this.onServerRequestListeners.add(listener);
      return () => this.onServerRequestListeners.delete(listener);
    }

    public async request<TResponse>(
      method: string,
      params: unknown,
    ): Promise<TResponse> {
      requests.push({ method, params });

      if (method === "thread/start") {
        return { thread: { id: "thr_test" } } as TResponse;
      }

      if (method === "turn/start") {
        queueMicrotask(() => {
          for (const listener of this.onNotificationListeners) {
            listener({
              method: "turn/started",
              params: {
                threadId: "thr_test",
                turn: {
                  id: "turn_test",
                  items: [],
                  status: "inProgress",
                  error: null,
                },
              },
            });
            listener({
              method: "item/agentMessage/delta",
              params: {
                threadId: "thr_test",
                turnId: "turn_test",
                itemId: "item_1",
                delta: "ok",
              },
            });
            listener({
              method: "turn/completed",
              params: {
                threadId: "thr_test",
                turn: {
                  id: "turn_test",
                  items: [],
                  status: "completed",
                  error: null,
                },
              },
            });
          }
        });

        return {
          turn: {
            id: "turn_test",
            items: [],
            status: "inProgress",
            error: null,
          },
        } as TResponse;
      }

      if (method === "turn/interrupt") {
        return {} as TResponse;
      }

      throw new Error(`Unexpected request method: ${method}`);
    }

    public async notify(): Promise<void> {}
    public async sendResponse(): Promise<void> {}
  }

  return { CodexAppServerProcess: FakeCodexAppServerProcess };
});

describe("AppServerBackend", () => {
  beforeEach(() => {
    requests.length = 0;
  });

  it("maps reasoningEffort into thread/start config overrides", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await backend.run("hello", {
      cwd: process.cwd(),
      reasoningEffort: "xhigh",
    });
    const threadStart = requests.find((r) => r.method === "thread/start");
    expect(threadStart).toBeDefined();
    const params = threadStart?.params as {
      config?: Record<string, unknown> | null;
    };
    expect(params.config?.model_reasoning_effort).toBe("xhigh");
  });

  it("rejects MCP servers that set both command and url", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await expect(
      backend.run("hello", {
        cwd: process.cwd(),
        mcpServers: {
          bad: { command: "node", url: "http://localhost" },
        },
      }),
    ).rejects.toThrow(/must not set both command and url/i);
  });

  it("maps MCP stdio config into thread/start config overrides", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await backend.run("hello", {
      cwd: process.cwd(),
      mcpServers: {
        local: {
          command: "node",
          args: ["server.js"],
          env: { FOO: "bar" },
          cwd: "/tmp",
        },
      },
    });

    const threadStart = requests.findLast((r) => r.method === "thread/start");
    expect(threadStart).toBeDefined();
    const params = threadStart?.params as {
      config?: Record<string, unknown> | null;
    };
    expect(params.config?.["mcp_servers.local.command"]).toBe("node");
    expect(params.config?.["mcp_servers.local.args"]).toEqual(["server.js"]);
    expect(params.config?.["mcp_servers.local.env"]).toEqual({ FOO: "bar" });
    expect(params.config?.["mcp_servers.local.cwd"]).toBe("/tmp");
  });

  it("maps MCP http config into thread/start config overrides", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await backend.run("hello", {
      cwd: process.cwd(),
      mcpServers: {
        remote: {
          url: "http://localhost:4010/mcp",
          httpHeaders: { Authorization: "Bearer token" },
        },
      },
    });

    const threadStart = requests.findLast((r) => r.method === "thread/start");
    expect(threadStart).toBeDefined();
    const params = threadStart?.params as {
      config?: Record<string, unknown> | null;
    };
    expect(params.config?.["mcp_servers.remote.url"]).toBe(
      "http://localhost:4010/mcp",
    );
    expect(params.config?.["mcp_servers.remote.http_headers"]).toEqual({
      Authorization: "Bearer token",
    });
  });

  it("passes collaborationMode into turn/start", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await backend.run("hello", {
      cwd: process.cwd(),
      collaborationMode: {
        mode: "plan",
        model: "gpt-5.2-codex",
        reasoning_effort: null,
        developer_instructions: null,
      },
    });

    const turnStart = requests.findLast((r) => r.method === "turn/start");
    expect(turnStart).toBeDefined();
    const params = turnStart?.params as { collaborationMode?: unknown };
    expect(params.collaborationMode).toEqual({
      mode: "plan",
      model: "gpt-5.2-codex",
      reasoning_effort: null,
      developer_instructions: null,
    });
  });

  it("passes sandboxPolicy, outputSchema, and reasoningSummary into turn/start", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await backend.run("hello", {
      cwd: process.cwd(),
      sandboxPolicy: { type: "readOnly" },
      outputSchema: { type: "object" },
      reasoningSummary: "concise",
    });

    const turnStart = requests.findLast((r) => r.method === "turn/start");
    expect(turnStart).toBeDefined();
    const params = turnStart?.params as {
      sandboxPolicy?: unknown;
      outputSchema?: unknown;
      summary?: unknown;
    };
    expect(params.sandboxPolicy).toEqual({ type: "readOnly" });
    expect(params.outputSchema).toEqual({ type: "object" });
    expect(params.summary).toBe("concise");
  });
});
