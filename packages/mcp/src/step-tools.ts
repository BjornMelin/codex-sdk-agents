import type { ToolSet } from "ai";
import type { DynamicToolRegistry } from "./registry/dynamic-tool-registry.js";
import type { McpServerConfig } from "./types.js";

/**
 * Identifies a workflow step for tool resolution.
 *
 * Note: this uses plain strings instead of branded workflow IDs to avoid
 * coupling the MCP package to workflow-specific types.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type StepAddress = {
  workflowId: string;
  roleId: string;
  stepId: string;
};

/**
 * Resolves tool bundle IDs for a workflow step.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type ResolveBundleIds = (address: StepAddress) => readonly string[];

/**
 * Resolved tool sets and server info for a workflow step.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type ResolveToolsForStepResult = {
  address: StepAddress;
  bundleIds: readonly string[];
  tools: ToolSet;
  servers: Record<string, McpServerConfig>;
};

/**
 * Resolves MCP tool sets for workflow steps via a dynamic registry.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export class McpStepTools {
  readonly #registry: DynamicToolRegistry;
  readonly #resolveBundleIds: ResolveBundleIds;
  readonly #ownsRegistry: boolean;

  /**
   * Create a new MCP step tool resolver.
   *
   * @param options - Resolver configuration.
   */
  constructor(options: {
    registry: DynamicToolRegistry;
    resolveBundleIds: ResolveBundleIds;
    ownsRegistry?: boolean;
  }) {
    this.#registry = options.registry;
    this.#resolveBundleIds = options.resolveBundleIds;
    this.#ownsRegistry = options.ownsRegistry ?? true;
  }

  resolveBundles(address: StepAddress): readonly string[] {
    return this.#resolveBundleIds(address);
  }

  async resolveToolsForStep(
    address: StepAddress,
  ): Promise<ResolveToolsForStepResult> {
    const bundleIds = this.resolveBundles(address);
    const tools = await this.#registry.resolveTools(bundleIds);
    const servers = this.#registry.getServersForBundles(bundleIds);

    return { address, bundleIds, tools, servers };
  }

  async close(): Promise<void> {
    if (this.#ownsRegistry) {
      await this.#registry.close();
    }
  }
}
