import { describe, expect, it, vi } from "vitest";
import type { McpClient } from "../../packages/mcp/src/client/create-ai-sdk-mcp-client.js";
import {
  type McpClientFactory,
  McpClientManager,
  type McpClientManagerOptions,
} from "../../packages/mcp/src/client/mcp-client-manager.js";
import type { McpServerConfig } from "../../packages/mcp/src/types.js";

type McpToolSet = Record<string, unknown>;
type OAuthClientProvider = NonNullable<
  McpClientManagerOptions["authProvidersById"]
>[string];

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

describe("McpClientManager", () => {
  it("lazily creates clients and caches tool sets", async () => {
    const tools: McpToolSet = {};

    const factoryCalls: string[] = [];
    let toolsCalls = 0;

    const manager = new McpClientManager({
      servers: {
        repo: {
          id: "repo",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/repo" },
        },
      },
      toolsTtlMs: 60_000,
      factory: async (server) => {
        factoryCalls.push(server.id);
        const client = makeClient(tools);
        return {
          ...client,
          tools: async () => {
            toolsCalls += 1;
            return tools;
          },
        } as McpClient;
      },
    });

    const a = await manager.getTools("repo");
    const b = await manager.getTools("repo");

    expect(a).toBe(tools);
    expect(b).toBe(tools);
    expect(factoryCalls).toEqual(["repo"]);
    expect(toolsCalls).toBe(1);
  });

  it("refreshes cached tools after TTL", async () => {
    const tools1: McpToolSet = {};
    const tools2: McpToolSet = {};

    let call = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      return call === 0 ? 0 : 60_001;
    });

    const manager = new McpClientManager({
      servers: {
        repo: {
          id: "repo",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/repo" },
        },
      },
      toolsTtlMs: 60_000,
      factory: async () => {
        const client = makeClient({});
        return {
          ...client,
          tools: async () => {
            call += 1;
            return call === 1 ? tools1 : tools2;
          },
        } as McpClient;
      },
    });

    const first = await manager.getTools("repo");
    const second = await manager.getTools("repo");

    expect(first).toBe(tools1);
    expect(second).toBe(tools2);

    vi.restoreAllMocks();
  });

  it("closes all clients deterministically", async () => {
    const closed: string[] = [];

    const manager = new McpClientManager({
      servers: {
        a: {
          id: "a",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/a" },
        },
        b: {
          id: "b",
          trust: "trusted",
          transport: { type: "http", url: "http://localhost/b" },
        },
      },
      toolsTtlMs: 60_000,
      factory: async (server) =>
        ({
          ...makeClient({}),
          close: async () => {
            closed.push(server.id);
          },
        }) satisfies McpClient,
    });

    await manager.getClient("a");
    await manager.getClient("b");

    await manager.closeAll();

    expect(closed.sort()).toEqual(["a", "b"]);
  });
});

it("throws when authProviderId is set but no auth provider is configured", () => {
  const server: McpServerConfig = {
    id: "s",
    trust: "trusted",
    transport: {
      type: "http",
      url: "http://localhost:4010/mcp",
      authProviderId: "missing",
    },
  };

  const manager = new McpClientManager({
    servers: { s: server },
  });

  expect(() => manager.getClient("s")).toThrow(/Missing auth provider/);
});

it("passes resolved auth provider into the client factory", async () => {
  const provider = {} as unknown as OAuthClientProvider;
  const factory = vi.fn<McpClientFactory>(async () => makeClient({}));

  const server: McpServerConfig = {
    id: "s",
    trust: "trusted",
    transport: {
      type: "http",
      url: "http://localhost:4010/mcp",
      authProviderId: "oauth",
    },
  };

  const manager = new McpClientManager({
    servers: { s: server },
    authProvidersById: { oauth: provider },
    factory,
  });

  await manager.getClient("s");

  expect(factory).toHaveBeenCalledTimes(1);
  expect(factory.mock.calls[0]?.[2]).toBe(provider);
});
