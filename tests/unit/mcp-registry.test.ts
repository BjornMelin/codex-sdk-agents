import { tool } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { McpClientManager } from "../../packages/mcp/src/client/mcp-client-manager.js";
import { DynamicToolRegistry } from "../../packages/mcp/src/registry/dynamic-tool-registry.js";
import { type McpToolSet, makeClient } from "../helpers/mcp-mocks.js";

const makeManager = (
  toolsByServer: Record<string, Record<string, unknown>>,
) => {
  return new McpClientManager({
    servers: Object.fromEntries(
      Object.keys(toolsByServer).map((id) => [
        id,
        {
          id,
          trust: "trusted",
          transport: { type: "http", url: `http://localhost/${id}` },
        },
      ]),
    ),
    toolsTtlMs: 60_000,
    factory: async (server, _hooks) => {
      const tools = toolsByServer[server.id] ?? {};
      return makeClient(tools as McpToolSet);
    },
  });
};

describe("DynamicToolRegistry", () => {
  it("merges namespaced toolsets from direct bundles", async () => {
    const manager = makeManager({
      repo: {
        readFile: tool({
          description: "read a file",
          inputSchema: z.object({ path: z.string() }),
          execute: async ({ path }) => ({ path }),
        }),
      },
      gh: {
        searchIssues: tool({
          description: "search issues",
          inputSchema: z.object({ q: z.string() }),
          execute: async ({ q }) => ({ q }),
        }),
      },
    });

    const registry = new DynamicToolRegistry({
      config: {
        servers: {
          repo: {
            id: "repo",
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo" },
          },
          gh: {
            id: "gh",
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/gh" },
          },
        },
        bundles: {
          repoRead: { id: "repoRead", serverId: "repo", mode: "direct" },
          ghSearch: { id: "ghSearch", serverId: "gh", mode: "direct" },
        },
      },
      clientManager: manager,
    });

    const tools = await registry.resolveTools(["repoRead", "ghSearch"]);

    expect(Object.keys(tools).sort()).toEqual(
      ["gh.searchIssues", "repo.readFile"].sort(),
    );
  });

  it("injects meta tools when a meta bundle is present", async () => {
    const manager = makeManager({
      repo: {
        echo: tool({
          description: "echo",
          inputSchema: z.object({ text: z.string() }),
          execute: async ({ text }) => ({ text }),
        }),
      },
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
          repoMeta: {
            id: "repoMeta",
            serverId: "repo",
            mode: "meta",
            allowTools: ["echo"],
          },
        },
      },
      clientManager: manager,
    });

    const tools = await registry.resolveTools(["repoMeta"]);

    expect(tools["mcp.callTool"]).toBeDefined();
    expect(tools["mcp.listTools"]).toBeDefined();

    const callTool = tools["mcp.callTool"] as unknown as {
      execute: (input: unknown, options: unknown) => Promise<unknown>;
    };

    const res = await callTool.execute(
      { serverId: "repo", toolName: "echo", args: { text: "hi" } },
      {},
    );

    expect(res).toEqual({ ok: true, result: { text: "hi" } });
  });
});
