import type { ToolSet } from "ai";

import type { McpClientManager } from "../client/mcp-client-manager.js";
import { createMcpMetaTools, type McpMetaToolPolicy } from "../meta-tools.js";
import { filterToolSet, namespaceToolSet } from "../policy.js";
import type { McpConfig, McpServerConfig, McpToolBundle } from "../types.js";

/**
 * Inputs for constructing a dynamic tool registry.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type DynamicToolRegistryOptions = {
  config: McpConfig;
  clientManager: McpClientManager;
};

type MetaPolicyByServer = Record<string, McpMetaToolPolicy>;

function mergeToolSets(toolSets: ToolSet[]): ToolSet {
  const out: Record<string, unknown> = {};

  for (const toolSet of toolSets) {
    for (const [name, tool] of Object.entries(toolSet)) {
      if (name in out) {
        // Allow duplicate tool names when the underlying tool object is the same (common when multiple
        // bundles from the same server overlap). Otherwise fail fast.
        if (out[name] !== tool) {
          throw new Error(
            `Tool name collision: '${name}'. Use namespacing or adjust bundles.`,
          );
        }
        continue;
      }
      out[name] = tool;
    }
  }

  // Stabilize insertion order for deterministic snapshots/logging.
  const sorted: Record<string, unknown> = {};
  for (const name of Object.keys(out).sort((a, b) => a.localeCompare(b))) {
    sorted[name] = out[name];
  }

  return sorted as ToolSet;
}

/**
 * Normalize an allow list, treating empty as undefined.
 *
 * @param allowTools - Allow list to normalize.
 * @returns Normalized allow list or undefined.
 */
function normalizeAllow(
  allowTools: string[] | undefined,
): string[] | undefined {
  if (!allowTools || allowTools.length === 0) {
    return undefined;
  }
  return allowTools;
}

function intersectAllowLists(
  a: string[] | undefined,
  b: string[] | undefined,
): string[] | undefined {
  const left = normalizeAllow(a);
  const right = normalizeAllow(b);

  if (!left && !right) {
    return undefined;
  }
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  const set = new Set(right);
  const intersection = left.filter((name) => set.has(name));
  return normalizeAllow(intersection);
}

function mergeMetaPolicy(
  existing: MetaPolicyByServer,
  bundle: McpToolBundle,
): MetaPolicyByServer {
  const prev = existing[bundle.serverId];

  const allowTools = intersectAllowLists(prev?.allowTools, bundle.allowTools);
  const denyTools = [
    ...new Set([...(prev?.denyTools ?? []), ...(bundle.denyTools ?? [])]),
  ];

  const policy: McpMetaToolPolicy = {};
  if (allowTools !== undefined) {
    policy.allowTools = allowTools;
  }
  if (denyTools.length > 0) {
    policy.denyTools = denyTools;
  }

  return { ...existing, [bundle.serverId]: policy };
}

function enforceBundleTrust(
  server: McpServerConfig,
  bundle: McpToolBundle,
): void {
  if (server.trust === "trusted") {
    return;
  }

  if (bundle.mode !== "meta") {
    throw new Error(
      `Bundle '${bundle.id}' references untrusted server '${server.id}' but uses mode '${bundle.mode}'. ` +
        "Untrusted servers must be configured as meta bundles to avoid tool-definition prompt injection.",
    );
  }

  if (!bundle.allowTools || bundle.allowTools.length === 0) {
    throw new Error(
      `Bundle '${bundle.id}' references untrusted server '${server.id}' but does not set allowTools. ` +
        "Untrusted servers require an explicit tool allowlist.",
    );
  }
}

/**
 * Lazily loads MCP tools and merges bundles into a single tool set.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export class DynamicToolRegistry {
  readonly #config: McpConfig;
  readonly #clientManager: McpClientManager;

  readonly #toolsCache = new Map<string, Promise<ToolSet>>();

  constructor(options: DynamicToolRegistryOptions) {
    this.#config = options.config;
    this.#clientManager = options.clientManager;
  }

  /**
   * Fetch a bundle config or throw when it is unknown.
   *
   * @param bundleId - Bundle identifier to resolve.
   * @returns Bundle configuration.
   * @throws Error when the bundle does not exist.
   */
  getBundle(bundleId: string): McpToolBundle {
    const bundle = this.#config.bundles[bundleId];
    if (!bundle) {
      throw new Error(`Unknown MCP tool bundle: '${bundleId}'.`);
    }
    return bundle;
  }

  /**
   * Fetch a server config or throw when it is unknown.
   *
   * @param serverId - Server identifier to resolve.
   * @returns Server configuration.
   * @throws Error when the server does not exist.
   */
  getServer(serverId: string): McpServerConfig {
    const server = this.#config.servers[serverId];
    if (!server) {
      throw new Error(`Unknown MCP server: '${serverId}'.`);
    }
    return server;
  }

  /**
   * Collect server configs referenced by the provided bundles.
   *
   * @param bundleIds - Bundle identifiers to resolve.
   * @returns Server configs keyed by server id.
   */
  getServersForBundles(
    bundleIds: readonly string[],
  ): Record<string, McpServerConfig> {
    const out: Record<string, McpServerConfig> = {};
    for (const bundleId of bundleIds) {
      const bundle = this.getBundle(bundleId);
      const server = this.getServer(bundle.serverId);
      out[server.id] = server;
    }
    return out;
  }

  /**
   * Resolve and merge tools for a set of bundle IDs.
   *
   * - direct bundles contribute namespaced tool definitions
   * - meta bundles contribute a shared MCP meta-tool surface
   *
   * @param bundleIds - Bundle identifiers to resolve.
   * @returns Tool set for the bundle selection.
   */
  async resolveTools(bundleIds: readonly string[]): Promise<ToolSet> {
    const key = bundleIds.join("\u0000");
    const cached = this.#toolsCache.get(key);
    if (cached) {
      return cached;
    }

    const promise = this.#resolveToolsUncached(bundleIds);
    this.#toolsCache.set(key, promise);
    return promise;
  }

  async #resolveToolsUncached(bundleIds: readonly string[]): Promise<ToolSet> {
    const directToolSets: ToolSet[] = [];
    let metaPolicy: MetaPolicyByServer = {};

    for (const bundleId of bundleIds) {
      const bundle = this.getBundle(bundleId);
      const server = this.getServer(bundle.serverId);

      enforceBundleTrust(server, bundle);

      if (bundle.mode === "meta") {
        metaPolicy = mergeMetaPolicy(metaPolicy, bundle);
        continue;
      }

      const tools = await this.#clientManager.getTools(bundle.serverId);
      const policy: McpMetaToolPolicy = {};
      if (bundle.allowTools !== undefined) {
        policy.allowTools = bundle.allowTools;
      }
      if (bundle.denyTools !== undefined) {
        policy.denyTools = bundle.denyTools;
      }
      const filtered = filterToolSet(tools, policy);

      // Always namespace server tools to avoid collisions across servers.
      directToolSets.push(namespaceToolSet(filtered, bundle.serverId));
    }

    if (Object.keys(metaPolicy).length > 0) {
      directToolSets.push(
        createMcpMetaTools({
          clientManager: this.#clientManager,
          policyByServer: metaPolicy,
        }),
      );
    }

    return mergeToolSets(directToolSets);
  }

  async close(): Promise<void> {
    this.#toolsCache.clear();
    await this.#clientManager.closeAll();
  }
}
