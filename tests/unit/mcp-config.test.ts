import { describe, expect, it } from "vitest";

import { parseMcpConfig } from "../../packages/mcp/src/config.js";

describe("parseMcpConfig", () => {
  it("normalizes ids from record keys", () => {
    const config = parseMcpConfig({
      servers: {
        repo: {
          trust: "trusted",
          transport: { type: "http", url: "http://localhost:4010/mcp" },
        },
      },
      bundles: {
        repoRead: {
          serverId: "repo",
          mode: "direct",
          allowTools: ["readFile"],
          denyTools: ["writeFile"],
        },
      },
    });

    expect(config.servers.repo?.id).toBe("repo");
    expect(config.bundles.repoRead?.id).toBe("repoRead");
    expect(config.bundles.repoRead?.serverId).toBe("repo");
  });

  it("rejects bundles that reference an unknown server", () => {
    expect(() => {
      parseMcpConfig({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost:4010/mcp" },
          },
        },
        bundles: {
          bad: { serverId: "missing" },
        },
      });
    }).toThrowError(/unknown serverId/i);
  });

  it("accepts stdio servers with explicit stderr routing", () => {
    const config = parseMcpConfig({
      servers: {
        local: {
          trust: "trusted",
          transport: {
            type: "stdio",
            command: "node",
            args: ["--version"],
            stderr: "inherit",
          },
        },
      },
      bundles: {},
    });

    const server = config.servers.local;
    expect(server?.transport.type).toBe("stdio");
    if (server?.transport.type === "stdio") {
      expect(server.transport.stderr).toBe("inherit");
    }
  });
});
