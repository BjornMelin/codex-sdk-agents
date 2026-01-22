import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MCP_CONFIG_FILENAMES,
  discoverMcpConfigPath,
  loadMcpConfig,
  MCP_CONFIG_ENV_JSON,
  MCP_CONFIG_ENV_PATH,
} from "../../packages/mcp/src/config.js";

describe("MCP config loading", () => {
  it("discovers config by walking up from cwd", async () => {
    const base = await mkdtemp(join(tmpdir(), "codex-toolloop-mcp-"));
    const rootConfigPath = join(base, DEFAULT_MCP_CONFIG_FILENAMES[0]);

    await writeFile(
      rootConfigPath,
      JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost:4010/mcp" },
          },
        },
        bundles: {
          repoRead: { serverId: "repo", mode: "direct" },
        },
      }),
      "utf-8",
    );

    const nested = join(base, "a", "b", "c");
    await mkdir(nested, { recursive: true });

    const discovered = await discoverMcpConfigPath({
      cwd: nested,
      env: {},
    });

    expect(discovered).toBe(rootConfigPath);
  });

  it("loads config from an explicit file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-toolloop-mcp-"));
    const configPath = join(dir, "mcp.json");

    await writeFile(
      configPath,
      JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo" },
          },
        },
        bundles: { repoRead: { serverId: "repo", mode: "direct" } },
      }),
      "utf-8",
    );

    const { config, sources } = await loadMcpConfig({
      cwd: dir,
      configPath,
      env: {},
    });

    expect(Object.keys(config.servers)).toEqual(["repo"]);
    expect(Object.keys(config.bundles)).toEqual(["repoRead"]);
    expect(sources.some((s) => s.kind === "file")).toBe(true);
  });

  it("env JSON overrides file config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-toolloop-mcp-"));
    const configPath = join(dir, "mcp.json");

    await writeFile(
      configPath,
      JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo" },
          },
        },
        bundles: { repoRead: { serverId: "repo", mode: "direct" } },
      }),
      "utf-8",
    );

    const env: Record<string, string> = {
      [MCP_CONFIG_ENV_JSON]: JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo2" },
          },
        },
      }),
    };

    const { config } = await loadMcpConfig({ cwd: dir, configPath, env });

    const server = config.servers.repo;
    expect(server?.transport.type).toBe("http");
    if (server?.transport.type === "http") {
      expect(server.transport.url).toBe("http://localhost/repo2");
    }
  });

  it("runtime overrides override env and file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-toolloop-mcp-"));
    const configPath = join(dir, "mcp.json");

    await writeFile(
      configPath,
      JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo" },
          },
        },
        bundles: { repoRead: { serverId: "repo", mode: "direct" } },
      }),
      "utf-8",
    );

    const env: Record<string, string> = {
      [MCP_CONFIG_ENV_JSON]: JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo2" },
          },
        },
      }),
    };

    const { config } = await loadMcpConfig({
      cwd: dir,
      configPath,
      env,
      overrides: {
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo3" },
          },
        },
      },
    });

    const server = config.servers.repo;
    expect(server?.transport.type).toBe("http");
    if (server?.transport.type === "http") {
      expect(server.transport.url).toBe("http://localhost/repo3");
    }
  });

  it("supports env var path override", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-toolloop-mcp-"));
    const configPath = join(dir, "mcp.json");

    await writeFile(
      configPath,
      JSON.stringify({
        servers: {
          repo: {
            trust: "trusted",
            transport: { type: "http", url: "http://localhost/repo" },
          },
        },
        bundles: { repoRead: { serverId: "repo", mode: "direct" } },
      }),
      "utf-8",
    );

    const env: Record<string, string> = {
      [MCP_CONFIG_ENV_PATH]: configPath,
    };

    const discovered = await discoverMcpConfigPath({
      cwd: join(dir, "subdir"),
      env,
    });
    expect(discovered).toBe(configPath);
  });
});
