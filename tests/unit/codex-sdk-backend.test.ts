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
    startThread.mockImplementationOnce((_options: unknown) => {
      return {
        runStreamed: vi.fn(async () => ({
          events: makeSingleAgentMessageEventStream({
            threadId: "t-1",
            turnId: "u-1",
            text: "hello",
          }),
        })),
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
    });
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
});
