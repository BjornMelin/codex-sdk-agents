/** Identifier for a workflow definition. */
export type WorkflowId = string;
/** Identifier for a workflow role. */
export type RoleId = string;
/** Identifier for a workflow step. */
export type StepId = string;
/** Identifier for an MCP tool bundle. */
export type BundleId = string;

/**
 * Address of a workflow step for tool routing.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type StepAddress = {
  workflowId: WorkflowId;
  roleId: RoleId;
  stepId: StepId;
};

/**
 * Routing table mapping workflow steps to tool bundle IDs.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type ToolRoutingTable = Record<
  WorkflowId,
  Record<RoleId, Record<StepId, readonly BundleId[]>>
>;

/**
 * Partial routing table overrides applied on top of a base table.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type ToolRoutingOverrides = Partial<ToolRoutingTable>;

function mergeRecord<V>(
  base: Record<string, V>,
  override: Partial<Record<string, V>>,
): Record<string, V> {
  return { ...base, ...(override as Record<string, V>) };
}

/**
 * Merge a base routing table with override entries.
 *
 * @param base - Base routing table.
 * @param override - Override entries that replace base keys.
 * @returns Merged routing table.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function mergeToolRoutingTable(
  base: ToolRoutingTable,
  override: ToolRoutingOverrides,
): ToolRoutingTable {
  const merged: ToolRoutingTable = { ...base };

  for (const [workflowId, roleMap] of Object.entries(override)) {
    if (!roleMap) {
      continue;
    }
    const baseRoleMap = merged[workflowId] ?? {};
    const nextRoleMap: Record<string, Record<string, readonly string[]>> = {
      ...baseRoleMap,
    };

    for (const [roleId, stepMap] of Object.entries(roleMap)) {
      if (!stepMap) {
        continue;
      }
      const baseStepMap = baseRoleMap[roleId] ?? {};
      nextRoleMap[roleId] = mergeRecord(
        baseStepMap,
        stepMap as Record<string, readonly string[]>,
      );
    }

    merged[workflowId] = nextRoleMap;
  }

  return merged;
}

/**
 * Resolve an ordered list of MCP tool bundle IDs for a given workflow/role/step.
 *
 * Deny-by-default: if there is no explicit mapping, returns `[]`.
 */
/**
 * Resolve bundle IDs for a workflow step, returning an empty list on misses.
 *
 * @param table - Routing table to query.
 * @param address - Workflow step address.
 * @returns Bundle IDs in routing order.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function resolveToolBundlesForStep(
  table: ToolRoutingTable,
  address: StepAddress,
): readonly BundleId[] {
  return table[address.workflowId]?.[address.roleId]?.[address.stepId] ?? [];
}

/**
 * Cached resolver for tool bundles by workflow step.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export class ToolRouter {
  readonly #table: ToolRoutingTable;
  readonly #cache = new Map<string, readonly BundleId[]>();

  constructor(options: {
    table: ToolRoutingTable;
    overrides?: ToolRoutingOverrides;
  }) {
    this.#table = options.overrides
      ? mergeToolRoutingTable(options.table, options.overrides)
      : options.table;
  }

  resolve(address: StepAddress): readonly BundleId[] {
    const key = `${address.workflowId}\u0000${address.roleId}\u0000${address.stepId}`;
    const cached = this.#cache.get(key);
    if (cached) {
      return cached;
    }

    const bundleIds = resolveToolBundlesForStep(this.#table, address);
    this.#cache.set(key, bundleIds);
    return bundleIds;
  }
}
