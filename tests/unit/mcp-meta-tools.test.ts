import { describe, expect, it } from "vitest";
import { z } from "zod";
import { McpClientManager } from "../../packages/mcp/src/client/mcp-client-manager.js";
import { createMcpMetaTools } from "../../packages/mcp/src/meta-tools.js";
import { type McpToolSet, makeClient } from "../helpers/mcp-mocks.js";

describe("createMcpMetaTools", () => {
  const tools = {
    echo: {
      description: "echo",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }: { text: string }) => ({ text }),
    },
  } as McpToolSet;

  const makeManager = () =>
    new McpClientManager({
      servers: {
        repo: {
          id: "repo",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/repo" },
        },
      },
      factory: async () => makeClient(tools),
    });

  it("returns a safe error when callTool input is invalid", async () => {
    const manager = makeManager();

    const meta = createMcpMetaTools({
      clientManager: manager,
      policyByServer: { repo: { allowTools: ["echo"] } },
    });

    const callTool = meta["mcp.callTool"] as {
      execute: (input: unknown, options: unknown) => Promise<unknown>;
    };

    const result = await callTool.execute({ serverId: "repo" }, {});
    expect(result).toEqual({
      ok: false,
      error: "Invalid input for mcp.callTool.",
    });
  });

  it("executes allowed tools successfully", async () => {
    const manager = makeManager();
    const meta = createMcpMetaTools({
      clientManager: manager,
      policyByServer: { repo: { allowTools: ["echo"] } },
    });

    const callTool = meta["mcp.callTool"] as {
      execute: (input: unknown, options: unknown) => Promise<unknown>;
    };

    const result = (await callTool.execute(
      { serverId: "repo", toolName: "echo", args: { text: "hi" } },
      {},
    )) as { ok: boolean; result?: { text: string } };

    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ text: "hi" });
  });

  it("lists allowed tools", async () => {
    const manager = makeManager();
    const meta = createMcpMetaTools({
      clientManager: manager,
      policyByServer: { repo: { allowTools: ["echo"] } },
    });

    const listTools = meta["mcp.listTools"] as {
      execute: (input: unknown) => Promise<unknown>;
    };

    const result = (await listTools.execute({ serverId: "repo" })) as Array<{
      name: string;
      description: string;
    }>;

    expect(result).toEqual([{ name: "echo", description: "echo" }]);
  });

  it("returns not-allowed error when policy excludes tool", async () => {
    const manager = makeManager();
    const meta = createMcpMetaTools({
      clientManager: manager,
      policyByServer: { repo: { allowTools: ["other"] } },
    });

    const callTool = meta["mcp.callTool"] as {
      execute: (input: unknown, options: unknown) => Promise<unknown>;
    };

    const result = (await callTool.execute(
      { serverId: "repo", toolName: "echo", args: { text: "hi" } },
      {},
    )) as { ok: boolean; error?: string };

    expect(result).toEqual({
      ok: false,
      error: "Tool 'echo' is not allowed or does not exist on server 'repo'.",
    });
  });
});
