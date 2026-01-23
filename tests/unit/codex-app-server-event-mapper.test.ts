import { describe, expect, it } from "vitest";
import { createCodexAppServerEventMapper } from "../../packages/codex/src/app-server/event-mapper.js";
import type { CodexEvent } from "../../packages/codex/src/events.js";

describe("createCodexAppServerEventMapper", () => {
  it("finalizes messages when end_turn is observed", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    mapper.setThreadId("thr_1");

    await mapper.handleNotification({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        itemId: "item_1",
        delta: "Hello ",
      },
    });

    await mapper.handleNotification({
      method: "rawResponseItem/completed",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        item: {
          type: "message",
          role: "assistant",
          content: [],
          end_turn: true,
        },
      },
    });

    const completed = events.find(
      (event) => event.type === "codex.message.completed",
    );
    expect(completed).toBeDefined();
    expect(completed?.text).toBe("Hello ");
    expect(completed?.itemId).toBe("item_1");
  });

  it("emits collab toolcall updates for collaboration items", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    mapper.setThreadId("thr_parent");

    await mapper.handleNotification({
      method: "item/started",
      params: {
        threadId: "thr_parent",
        turnId: "turn_1",
        item: {
          type: "collabAgentToolCall",
          id: "collab_1",
          tool: "spawnAgent",
          status: "inProgress",
          senderThreadId: "thr_parent",
          receiverThreadIds: ["thr_child"],
          prompt: "Investigate task",
          agentsStates: {},
        },
      },
    });

    const collab = events.find(
      (event) => event.type === "codex.collab.toolcall.updated",
    );
    expect(collab).toBeDefined();
    expect(collab?.tool).toBe("spawnAgent");
    expect(collab?.status).toBe("inProgress");
    expect(collab?.receiverThreadIds).toEqual(["thr_child"]);
  });

  it("includes command metadata in command executed events", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    mapper.setThreadId("thr_1");

    await mapper.handleNotification({
      method: "item/completed",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        item: {
          type: "commandExecution",
          id: "cmd_1",
          command: "cat foo.txt",
          cwd: "/repo",
          processId: "pty_1",
          status: "completed",
          commandActions: [
            {
              type: "read",
              command: "cat foo.txt",
              name: "cat",
              path: "foo.txt",
            },
          ],
          aggregatedOutput: "hello",
          exitCode: 0,
          durationMs: 5,
        },
      },
    });

    const command = events.find(
      (event) => event.type === "codex.command.executed",
    );
    expect(command).toBeDefined();
    expect(command?.cwd).toBe("/repo");
    expect(command?.commandActions).toEqual([
      {
        type: "read",
        command: "cat foo.txt",
        name: "cat",
        path: "foo.txt",
      },
    ]);
  });

  it("emits account and warning notifications as normalized events", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    await mapper.handleNotification({
      method: "account/updated",
      params: { authMode: "apikey" },
    });
    await mapper.handleNotification({
      method: "account/rateLimits/updated",
      params: {
        rateLimits: {
          primary: {
            usedPercent: 0.1,
            windowDurationMins: 60,
            resetsAt: null,
          },
          secondary: null,
          credits: { hasCredits: true, unlimited: false, balance: "10.0" },
          planType: null,
        },
      },
    });
    await mapper.handleNotification({
      method: "configWarning",
      params: { summary: "Bad config", details: null },
    });
    await mapper.handleNotification({
      method: "deprecationNotice",
      params: { summary: "Deprecated", details: "Use skills" },
    });
    await mapper.handleNotification({
      method: "windows/worldWritableWarning",
      params: { samplePaths: ["/tmp"], extraCount: 0, failedScan: false },
    });
    await mapper.handleNotification({
      method: "account/login/completed",
      params: { loginId: "login_1", success: true, error: null },
    });
    await mapper.handleNotification({
      method: "mcpServer/oauthLogin/completed",
      params: { name: "github", success: true },
    });

    expect(events.some((event) => event.type === "codex.account.updated")).toBe(
      true,
    );
    expect(
      events.some((event) => event.type === "codex.account.rateLimits.updated"),
    ).toBe(true);
    expect(events.some((event) => event.type === "codex.config.warning")).toBe(
      true,
    );
    expect(
      events.some((event) => event.type === "codex.deprecation.notice"),
    ).toBe(true);
    expect(
      events.some(
        (event) => event.type === "codex.windows.worldWritableWarning",
      ),
    ).toBe(true);
    expect(
      events.some((event) => event.type === "codex.account.login.completed"),
    ).toBe(true);
    expect(
      events.some((event) => event.type === "codex.mcp.oauth.completed"),
    ).toBe(true);
  });

  it("emits approval and user input server request events", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    mapper.setThreadId("thr_1");

    await mapper.handleServerRequest({
      id: 100,
      method: "item/tool/requestUserInput",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        itemId: "item_1",
        questions: [
          {
            id: "q1",
            header: "Confirm",
            question: "Proceed?",
            options: null,
          },
        ],
      },
    });

    await mapper.handleServerRequest({
      id: 101,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        itemId: "item_2",
        reason: null,
        command: "ls",
        cwd: "/repo",
        commandActions: [],
        proposedExecpolicyAmendment: null,
      },
    });

    const userInput = events.find(
      (event) => event.type === "codex.user_input.requested",
    );
    expect(userInput).toBeDefined();
    expect(userInput?.requestId).toBe(100);
    expect(userInput?.params.itemId).toBe("item_1");

    const approval = events.find(
      (event) => event.type === "codex.approval.requested",
    );
    expect(approval).toBeDefined();
    expect(approval?.kind).toBe("command");
    expect(approval?.requestId).toBe(101);
  });

  it("emits stdin notifications for terminal interactions", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    mapper.setThreadId("thr_1");

    await mapper.handleNotification({
      method: "item/commandExecution/terminalInteraction",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        itemId: "cmd_1",
        processId: "pty_1",
        stdin: "input",
      },
    });

    const stdin = events.find((event) => event.type === "codex.command.stdin");
    expect(stdin).toBeDefined();
    expect(stdin?.processId).toBe("pty_1");
    expect(stdin?.stdin).toBe("input");
  });

  it("emits MCP tool call progress notifications", async () => {
    const events: CodexEvent[] = [];
    const mapper = createCodexAppServerEventMapper({
      backend: "app-server",
      onEvent: (event) => {
        events.push(event);
      },
    });

    mapper.setThreadId("thr_1");

    await mapper.handleNotification({
      method: "item/mcpToolCall/progress",
      params: {
        threadId: "thr_1",
        turnId: "turn_1",
        itemId: "item_1",
        message: "working",
      },
    });

    const progress = events.find(
      (event) => event.type === "codex.mcp.toolcall.progress",
    );
    expect(progress).toBeDefined();
    expect(progress?.message).toBe("working");
  });
});
