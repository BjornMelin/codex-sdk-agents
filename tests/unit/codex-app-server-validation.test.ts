import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(async () => ({
    fullStream: (async function* () {})(),
    text: Promise.resolve("ok"),
  })),
}));

describe("AppServerBackend", () => {
  it("rejects unsupported reasoningEffort values at runtime", async () => {
    const { AppServerBackend } = await import(
      "../../packages/codex/src/index.js"
    );
    const backend = new AppServerBackend();

    await expect(
      backend.run("hello", {
        cwd: process.cwd(),
        reasoningEffort: "xhigh",
      }),
    ).rejects.toThrow(/does not support reasoningEffort=xhigh/);
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

  it("maps MCP stdio config to provider settings", async () => {
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

    const settingsKey = (
      backend as unknown as { providerSettingsKey: string | null }
    ).providerSettingsKey;
    expect(settingsKey).not.toBeNull();
    const settings = JSON.parse(settingsKey ?? "{}") as {
      mcpServers?: Record<string, unknown>;
    };
    const mcpServers = settings.mcpServers;
    expect(mcpServers).toBeDefined();
    expect(mcpServers?.local).toMatchObject({
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      env: { FOO: "bar" },
      cwd: "/tmp",
    });
  });

  it("maps MCP http config to provider settings", async () => {
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

    const settingsKey = (
      backend as unknown as { providerSettingsKey: string | null }
    ).providerSettingsKey;
    expect(settingsKey).not.toBeNull();
    const settings = JSON.parse(settingsKey ?? "{}") as {
      mcpServers?: Record<string, unknown>;
    };
    const mcpServers = settings.mcpServers;
    expect(mcpServers).toBeDefined();
    expect(mcpServers?.remote).toMatchObject({
      transport: "http",
      url: "http://localhost:4010/mcp",
      httpHeaders: { Authorization: "Bearer token" },
    });
  });
});
