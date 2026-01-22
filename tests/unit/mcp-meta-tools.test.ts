import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { McpClient } from "../../packages/mcp/src/client/create-ai-sdk-mcp-client.js";
import { McpClientManager } from "../../packages/mcp/src/client/mcp-client-manager.js";
import { createMcpMetaTools } from "../../packages/mcp/src/meta-tools.js";

type McpToolSet = Record<string, unknown>;

function makeClient(tools: McpToolSet): McpClient {
  return {
    tools: async () => tools,
    listResources: async () => ({ resources: [] }),
    readResource: async () => ({ contents: [] }),
    listResourceTemplates: async () => ({ resourceTemplates: [] }),
    experimental_listPrompts: async () => ({ prompts: [] }),
    experimental_getPrompt: async () => ({ messages: [] }),
    onElicitationRequest: () => {},
    close: async () => {},
  } as McpClient;
}

describe("createMcpMetaTools", () => {
  it("returns a safe error when callTool input is invalid", async () => {
    const tools = {
      echo: {
        description: "echo",
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }: { text: string }) => ({ text }),
      },
    } as McpToolSet;

    const manager = new McpClientManager({
      servers: {
        repo: {
          id: "repo",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/repo" },
        },
      },
      factory: async () => makeClient(tools),
    });

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
});
