import type { OAuthClientProvider } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";

import type { McpServerConfig } from "../types.js";

import {
  type CreateMcpClientHooks,
  createAiSdkMcpClient,
  type McpClient,
} from "./create-ai-sdk-mcp-client.js";

/**
 * Factory for creating MCP clients with optional auth providers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpClientFactory = (
  server: McpServerConfig,
  hooks: CreateMcpClientHooks,
  authProvider?: OAuthClientProvider,
) => Promise<McpClient>;

/** Cached MCP tool set with expiration. */
type ToolCacheEntry = {
  /** The cached tool set. */
  tools: ToolSet;
  /** Expiration timestamp in milliseconds. */
  expiresAt: number;
};

/** MCP client entry with optional tool cache. */
type ClientEntry = {
  /** Promise resolving to the MCP client. */
  clientPromise: Promise<McpClient>;
  /** Optional cached tool set with expiration. */
  toolsCache?: ToolCacheEntry;
};

/**
 * Options for configuring MCP client caching and hooks.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpClientManagerOptions = {
  servers: Record<string, McpServerConfig>;
  toolsTtlMs?: number;
  hooks?: CreateMcpClientHooks;
  factory?: McpClientFactory;
  authProvidersById?: Readonly<Record<string, OAuthClientProvider>>;
};

/**
 * Manages MCP client lifecycle and tool caching.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export class McpClientManager {
  readonly #servers: Record<string, McpServerConfig>;
  readonly #clients = new Map<string, ClientEntry>();
  readonly #toolsTtlMs: number;
  readonly #hooks: CreateMcpClientHooks;
  readonly #factory: McpClientFactory;
  readonly #authProvidersById: Readonly<Record<string, OAuthClientProvider>>;

  /**
   * Create a new MCP client manager.
   *
   * @param options - Options for configuring the MCP client manager.
   */
  constructor(options: McpClientManagerOptions) {
    this.#servers = options.servers;
    this.#toolsTtlMs = options.toolsTtlMs ?? 60_000;
    this.#hooks = options.hooks ?? {};
    this.#factory = options.factory ?? createAiSdkMcpClient;
    this.#authProvidersById = options.authProvidersById ?? {};
  }

  /**
   * Get the MCP server configuration by ID.
   *
   * @param serverId - ID of the MCP server.
   * @returns The MCP server configuration.
   * @throws When the server ID is unknown.
   */
  getServerConfig(serverId: string): McpServerConfig {
    const server = this.#servers[serverId];
    if (!server) {
      throw new Error(`Unknown MCP serverId: ${serverId}`);
    }
    return server;
  }

  /**
   * List all managed MCP server IDs.
   *
   * @returns Array of MCP server IDs.
   */
  listServerIds(): string[] {
    return Object.keys(this.#servers);
  }

  /**
   * Resolve the auth provider for a given MCP server.
   *
   * @param server - MCP server configuration.
   * @returns The resolved OAuth client provider or undefined.
   * @throws When the specified auth provider ID is missing.
   */
  #resolveAuthProvider(
    server: McpServerConfig,
  ): OAuthClientProvider | undefined {
    const transport = server.transport;
    if (transport.type !== "http" && transport.type !== "sse") {
      return undefined;
    }

    const providerId = transport.authProviderId;
    if (!providerId) {
      return undefined;
    }

    const provider = this.#authProvidersById[providerId];
    if (!provider) {
      throw new Error(
        `Missing auth provider '${providerId}' for MCP server '${server.id}'.`,
      );
    }

    return provider;
  }

  /**
   * Get or create an MCP client for a given server ID.
   *
   * @param serverId - ID of the MCP server.
   * @returns Promise resolving to the MCP client.
   */
  getClient(serverId: string): Promise<McpClient> {
    const existing = this.#clients.get(serverId);
    if (existing) {
      return existing.clientPromise;
    }

    const server = this.getServerConfig(serverId);
    const authProvider = this.#resolveAuthProvider(server);
    const clientPromise = this.#factory(server, this.#hooks, authProvider);

    this.#clients.set(serverId, { clientPromise });
    return clientPromise;
  }

  /**
   * Get the tool set from the MCP server, using caching.
   *
   * @param serverId - ID of the MCP server.
   * @param options - Optional parameters for fetching tools.
   * @returns Promise resolving to the tool set.
   */
  async getTools(
    serverId: string,
    options?: Parameters<McpClient["tools"]>[0],
  ): Promise<ToolSet> {
    const entry = this.#clients.get(serverId) ?? {
      clientPromise: this.getClient(serverId),
    };
    this.#clients.set(serverId, entry);

    const now = Date.now();
    const cached = entry.toolsCache;
    if (cached && cached.expiresAt > now) {
      return cached.tools;
    }

    const client = await entry.clientPromise;
    const tools = await client.tools(options);

    entry.toolsCache = {
      tools,
      expiresAt: now + this.#toolsTtlMs,
    };

    return tools;
  }

  /**
   * Close and remove the MCP client for a given server ID.
   *
   * @param serverId - ID of the MCP server.
   */
  async close(serverId: string): Promise<void> {
    const entry = this.#clients.get(serverId);
    if (!entry) {
      return;
    }

    const client = await entry.clientPromise;
    await client.close();
    this.#clients.delete(serverId);
  }

  /**
   * Close and remove all MCP clients.
   */
  async closeAll(): Promise<void> {
    const ids = [...this.#clients.keys()];
    await Promise.all(ids.map((id) => this.close(id)));
  }
}
