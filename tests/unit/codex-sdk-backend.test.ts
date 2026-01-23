import { beforeEach, describe, expect, it, vi } from "vitest";

const startThread = vi.fn();

function makeSingleAgentMessageEventStream(params: {
  threadId: string;
  turnId: string;
  text: string;
}): AsyncIterable<unknown> {
  return (async function* () {
    yield {
      type: "item.completed",
      thread_id: params.threadId,
      turn_id: params.turnId,
      item: { id: "i-1", type: "agent_message", text: params.text },
    };
  })();
}

describe("SdkBackend", () => {
  beforeEach(() => {
    startThread.mockReset();
  });

  it("forwards model and reasoningEffort as thread defaults", async () => {
    const runStreamed = vi.fn(async () => ({
      events: makeSingleAgentMessageEventStream({
        threadId: "t-1",
        turnId: "u-1",
        text: "hello",
      }),
    }));

    startThread.mockImplementationOnce((_options: unknown) => {
      return {
        runStreamed,
      };
    });

    const { SdkBackend } = await import("../../packages/codex/src/index.js");
    const backend = new SdkBackend({
      defaultModel: "default-model",
      codexClient: { startThread },
    });

    const result = await backend.run("prompt", {
      cwd: "/tmp",
      model: "requested-model",
      reasoningEffort: "high",
      sandboxMode: "read-only",
      approvalMode: "never",
      skipGitRepoCheck: true,
      networkAccessEnabled: true,
      webSearchMode: "cached",
      webSearchEnabled: true,
      additionalDirectories: ["/mnt/data"],
    });

    expect(result.backend).toBe("sdk");
    expect(result.model).toBe("requested-model");
    expect(result.threadId).toBe("t-1");
    expect(result.turnId).toBe("u-1");
    expect(result.text).toBe("hello");

    expect(startThread).toHaveBeenCalledTimes(1);
    const threadOptions = startThread.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;

    expect(threadOptions).toMatchObject({
      workingDirectory: "/tmp",
      sandboxMode: "read-only",
      approvalPolicy: "never",
      model: "requested-model",
      modelReasoningEffort: "high",
      skipGitRepoCheck: true,
      networkAccessEnabled: true,
      webSearchMode: "cached",
      webSearchEnabled: true,
      additionalDirectories: ["/mnt/data"],
    });
    expect(runStreamed).toHaveBeenCalledWith("prompt", {});
  });

  it("passes outputSchema, signal, and structured inputs to the SDK turn", async () => {
    const runStreamed = vi.fn(async () => ({
      events: makeSingleAgentMessageEventStream({
        threadId: "t-2",
        turnId: "u-2",
        text: "ok",
      }),
    }));

    startThread.mockImplementationOnce((_options: unknown) => {
      return { runStreamed };
    });

    const { SdkBackend } = await import("../../packages/codex/src/index.js");
    const backend = new SdkBackend({
      defaultModel: "default-model",
      codexClient: { startThread },
    });

    const controller = new AbortController();

    await backend.run("ignored prompt", {
      cwd: "/tmp",
      outputSchema: { type: "object" },
      signal: controller.signal,
      input: [
        { type: "text", text: "hello", text_elements: [] },
        { type: "localImage", path: "/tmp/image.png" },
      ],
    });

    expect(runStreamed).toHaveBeenCalledWith(
      [
        { type: "text", text: "hello" },
        { type: "local_image", path: "/tmp/image.png" },
      ],
      { outputSchema: { type: "object" }, signal: controller.signal },
    );
  });

  it("recreates the SDK thread when thread defaults change", async () => {
    let threadCount = 0;
    startThread.mockImplementation((_options: unknown) => {
      threadCount += 1;
      const thisThreadId = `t-${threadCount}`;
      return {
        runStreamed: vi.fn(async () => ({
          events: makeSingleAgentMessageEventStream({
            threadId: thisThreadId,
            turnId: `u-${thisThreadId}`,
            text: `ok-${thisThreadId}`,
          }),
        })),
      };
    });

    const { SdkBackend } = await import("../../packages/codex/src/index.js");
    const backend = new SdkBackend({
      defaultModel: "default-model",
      codexClient: { startThread },
    });

    await backend.run("prompt", { cwd: "/tmp", model: "m1" });
    await backend.run("prompt", { cwd: "/tmp", model: "m1" });
    expect(startThread).toHaveBeenCalledTimes(1);

    await backend.run("prompt", { cwd: "/tmp", model: "m2" });
    expect(startThread).toHaveBeenCalledTimes(2);

    await backend.run("prompt", {
      cwd: "/tmp",
      model: "m2",
      reasoningEffort: "xhigh",
    });
    expect(startThread).toHaveBeenCalledTimes(3);
  });

  it("rejects unsupported reasoningEffort values", async () => {
    const { SdkBackend } = await import("../../packages/codex/src/index.js");
    const backend = new SdkBackend({
      defaultModel: "default-model",
      codexClient: { startThread },
    });

    await expect(
      backend.run("prompt", { cwd: "/tmp", reasoningEffort: "none" }),
    ).rejects.toThrow(/does not support reasoningEffort: "none"/);
  });

  it("rejects unsupported SDK options and input types", async () => {
    startThread.mockImplementationOnce((_options: unknown) => {
      return {
        runStreamed: vi.fn(async () => ({
          events: makeSingleAgentMessageEventStream({
            threadId: "t-3",
            turnId: "u-3",
            text: "noop",
          }),
        })),
      };
    });

    const { SdkBackend } = await import("../../packages/codex/src/index.js");
    const backend = new SdkBackend({
      defaultModel: "default-model",
      codexClient: { startThread },
    });

    await expect(
      backend.run("prompt", { cwd: "/tmp", timeoutMs: 1000 }),
    ).rejects.toThrow(/does not support options: timeoutMs/);

    await expect(
      backend.run("prompt", {
        cwd: "/tmp",
        input: [{ type: "image", url: "https://example.com/img.png" }],
      }),
    ).rejects.toThrow(/does not support input item type: "image"/);
  });
});
