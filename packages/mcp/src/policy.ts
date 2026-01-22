import type { ToolSet } from "ai";

/**
 * Allow/deny lists applied when selecting MCP tools.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type ToolAccessPolicy = {
  allowTools?: string[];
  denyTools?: string[];
};

/** Convert an array of strings to a set, treating undefined as empty.
 *
 * @param values - Array of strings or undefined.
 * @returns Readonly set of strings.
 */
function toSet(values: string[] | undefined): ReadonlySet<string> {
  return new Set(values ?? []);
}

/**
 * Filter tool names using an allow/deny policy.
 *
 * @param names - Tool names to filter.
 * @param policy - Allow/deny policy to apply.
 * @returns Filtered tool names.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function filterToolNames(
  names: readonly string[],
  policy: ToolAccessPolicy,
): string[] {
  const allow = toSet(policy.allowTools);
  const deny = toSet(policy.denyTools);

  const filtered = names.filter((name) => {
    const allowed = allow.size === 0 ? true : allow.has(name);
    return allowed && !deny.has(name);
  });

  return filtered;
}

/**
 * Filter an AI SDK tool set using an allow/deny policy.
 *
 * @param tools - Tool set to filter.
 * @param policy - Allow/deny policy to apply.
 * @returns Filtered tool set.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function filterToolSet(
  tools: ToolSet,
  policy: ToolAccessPolicy,
): ToolSet {
  const names = filterToolNames(Object.keys(tools), policy);
  const out: Record<string, unknown> = {};

  for (const name of names) {
    out[name] = tools[name];
  }

  return out as ToolSet;
}

/**
 * Prefix a tool name with a namespace.
 *
 * @param namespace - Namespace prefix.
 * @param toolName - Tool name to namespace.
 * @returns Namespaced tool name.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function namespaceToolName(namespace: string, toolName: string): string {
  return `${namespace}.${toolName}`;
}

/**
 * Namespace every tool in a tool set.
 *
 * @param tools - Tool set to namespace.
 * @param namespace - Namespace prefix.
 * @returns Namespaced tool set.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function namespaceToolSet(tools: ToolSet, namespace: string): ToolSet {
  const out: Record<string, unknown> = {};

  for (const [name, tool] of Object.entries(tools)) {
    out[namespaceToolName(namespace, name)] = tool;
  }

  return out as ToolSet;
}
