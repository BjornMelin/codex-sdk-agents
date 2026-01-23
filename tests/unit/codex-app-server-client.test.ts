import { beforeEach, describe, expect, it, vi } from "vitest";

type RecordedRequest = { method: string; params: unknown };
type RecordedResponse = { id: number | string; result: unknown };

const requests: RecordedRequest[] = [];
const responses: RecordedResponse[] = [];

vi.mock("../../packages/codex/src/app-server/process.js", () => {
  class FakeCodexAppServerProcess {
    public async ensureStarted(): Promise<void> {}
    public async close(): Promise<void> {}

    public onNotification(): () => void {
      return () => {};
    }

    public onServerRequest(): () => void {
      return () => {};
    }

    public async request<TResponse>(
      method: string,
      params: unknown,
    ): Promise<TResponse> {
      requests.push({ method, params });
      return {} as TResponse;
    }

    public async sendResponse(
      id: number | string,
      result: unknown,
    ): Promise<void> {
      responses.push({ id, result });
    }

    public async sendError(): Promise<void> {}
    public async notify(): Promise<void> {}
  }

  return { CodexAppServerProcess: FakeCodexAppServerProcess };
});

describe("CodexAppServerClient", () => {
  beforeEach(() => {
    requests.length = 0;
    responses.length = 0;
  });

  it("issues thread/read with includeTurns", async () => {
    const { CodexAppServerClient } = await import(
      "../../packages/codex/src/app-server/client.js"
    );
    const client = new CodexAppServerClient();

    await client.threadRead({ threadId: "thr_1", includeTurns: true });
    expect(requests.at(-1)).toEqual({
      method: "thread/read",
      params: { threadId: "thr_1", includeTurns: true },
    });
  });

  it("passes archived filter into thread/list", async () => {
    const { CodexAppServerClient } = await import(
      "../../packages/codex/src/app-server/client.js"
    );
    const client = new CodexAppServerClient();

    await client.threadList({
      cursor: null,
      limit: 10,
      sortKey: null,
      modelProviders: null,
      archived: true,
    });

    expect(requests.at(-1)).toEqual({
      method: "thread/list",
      params: {
        cursor: null,
        limit: 10,
        sortKey: null,
        modelProviders: null,
        archived: true,
      },
    });
  });

  it("supports config/read with cwd", async () => {
    const { CodexAppServerClient } = await import(
      "../../packages/codex/src/app-server/client.js"
    );
    const client = new CodexAppServerClient();

    await client.configRead({ includeLayers: true, cwd: "/repo/subdir" });
    expect(requests.at(-1)).toEqual({
      method: "config/read",
      params: { includeLayers: true, cwd: "/repo/subdir" },
    });
  });

  it("issues account and feedback requests", async () => {
    const { CodexAppServerClient } = await import(
      "../../packages/codex/src/app-server/client.js"
    );
    const client = new CodexAppServerClient();

    await client.accountRead({ refreshToken: false });
    await client.accountRateLimitsRead();
    await client.accountLoginStart({ type: "chatgpt" });
    await client.accountLoginCancel({ loginId: "login_1" });
    await client.accountLogout();
    await client.feedbackUpload({
      classification: "bug",
      reason: "broken",
      threadId: null,
      includeLogs: false,
    });
    await client.modelList({ cursor: null, limit: null });

    expect(requests).toEqual([
      { method: "account/read", params: { refreshToken: false } },
      { method: "account/rateLimits/read", params: undefined },
      { method: "account/login/start", params: { type: "chatgpt" } },
      { method: "account/login/cancel", params: { loginId: "login_1" } },
      { method: "account/logout", params: undefined },
      {
        method: "feedback/upload",
        params: {
          classification: "bug",
          reason: "broken",
          threadId: null,
          includeLogs: false,
        },
      },
      { method: "model/list", params: { cursor: null, limit: null } },
    ]);
  });

  it("sends approval responses with decision payloads", async () => {
    const { CodexAppServerClient } = await import(
      "../../packages/codex/src/app-server/client.js"
    );
    const client = new CodexAppServerClient();

    await client.respondToCommandExecutionApproval(1, "accept");
    await client.respondToFileChangeApproval(2, "decline");
    await client.respondToToolRequestUserInput(3, {
      answer: { answers: ["ok"] },
    });
    await client.respondToApplyPatchApproval(4, "denied");
    await client.respondToExecCommandApproval(5, "denied");

    expect(responses).toEqual([
      { id: 1, result: { decision: "accept" } },
      { id: 2, result: { decision: "decline" } },
      { id: 3, result: { answers: { answer: { answers: ["ok"] } } } },
      { id: 4, result: { decision: "denied" } },
      { id: 5, result: { decision: "denied" } },
    ]);
  });
});
