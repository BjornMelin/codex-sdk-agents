import { describe, expect, it } from "vitest";
import type { McpClient } from "../../packages/mcp/src/client/create-ai-sdk-mcp-client.js";
import { McpClientManager } from "../../packages/mcp/src/client/mcp-client-manager.js";
import { DynamicToolRegistry } from "../../packages/mcp/src/registry/dynamic-tool-registry.js";

type McpToolSet = Record<string, unknown>;

function makeClient(): McpClient {
  const tools: McpToolSet = {};
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

describe("MCP trust enforcement", () => {
  it("rejects direct bundles for untrusted servers", async () => {
    const manager = new McpClientManager({
      servers: {
        thirdParty: {
          id: "thirdParty",
          trust: "untrusted",
          transport: { type: "http", url: "http://localhost/tp" },
        },
      },
      toolsTtlMs: 60_000,
      factory: async () => {
        throw new Error("factory should not be called");
      },
    });

    const registry = new DynamicToolRegistry({
      config: {
        servers: {
          thirdParty: {
            id: "thirdParty",
            trust: "untrusted",
            transport: { type: "http", url: "http://localhost/tp" },
          },
        },
        bundles: {
          tpDirect: {
            id: "tpDirect",
            serverId: "thirdParty",
            mode: "direct",
            allowTools: ["safeTool"],
          },
        },
      },
      clientManager: manager,
    });

    await expect(registry.resolveTools(["tpDirect"])).rejects.toThrow(
      /Untrusted servers must be configured as meta bundles/i,
    );
  });

  it("requires allowTools for untrusted meta bundles", async () => {
    const manager = new McpClientManager({
      servers: {
        thirdParty: {
          id: "thirdParty",
          trust: "untrusted",
          transport: { type: "http", url: "http://localhost/tp" },
        },
      },
      toolsTtlMs: 60_000,
      factory: async () => {
        throw new Error("factory should not be called");
      },
    });

    const registry = new DynamicToolRegistry({
      config: {
        servers: {
          thirdParty: {
            id: "thirdParty",
            trust: "untrusted",
            transport: { type: "http", url: "http://localhost/tp" },
          },
        },
        bundles: {
          tpMeta: { id: "tpMeta", serverId: "thirdParty", mode: "meta" },
        },
      },
      clientManager: manager,
    });

    await expect(registry.resolveTools(["tpMeta"])).rejects.toThrow(
      /require an explicit tool allowlist/i,
    );
  });

  it("allows trusted servers in direct mode without allowTools", async () => {
    const manager = new McpClientManager({
      servers: {
        repo: {
          id: "repo",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/repo" },
        },
      },
      toolsTtlMs: 60_000,
      factory: async () => makeClient(),
    });

    const registry = new DynamicToolRegistry({
      config: {
        servers: {
          repo: {
            id: "repo",
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo" },
          },
        },
        bundles: {
          repoDirect: { id: "repoDirect", serverId: "repo", mode: "direct" },
        },
      },
      clientManager: manager,
    });

    const tools = await registry.resolveTools(["repoDirect"]);
    expect(Object.keys(tools)).toEqual([]);
  });
});
