import { dynamicTool, type ToolSet, tool } from "ai";
import { z } from "zod";

import type { McpClientManager } from "./client/mcp-client-manager.js";
import { filterToolNames, type ToolAccessPolicy } from "./policy.js";

/**
 * Per-server allow/deny policy for MCP meta tools.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type McpMetaToolPolicy = {
  /**
   * Tool allowlist for a specific MCP server.
   *
   * - `undefined`: allow all tools from the server
   * - `[]`: allow no tools from the server
   */
  allowTools?: string[];
  /** Tool denylist for a specific MCP server. */
  denyTools?: string[];
};

/**
 * Size and timeout limits applied to MCP meta-tool responses.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type McpMetaToolLimits = {
  /**
   * Maximum number of tools returned by `mcp.listTools` per server.
   * This is a safety bound for prompt-size and model usability.
   */
  maxToolsPerServer?: number;
  /** Maximum JSON size for schemas returned by `mcp.getToolSchema`. */
  maxSchemaJsonChars?: number;
  /** Maximum JSON size for results returned by `mcp.callTool`. */
  maxResultJsonChars?: number;
  /** Maximum tool description length returned by `mcp.listTools` / `mcp.getToolSchema`. */
  maxDescriptionChars?: number;
  /**
   * Default tool execution timeout in milliseconds for `mcp.callTool`.
   * This uses AbortSignal if the underlying tool honors it.
   */
  callTimeoutMs?: number;
};

/**
 * Options for building the MCP meta-tool surface.
 *
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export type CreateMcpMetaToolsOptions = {
  clientManager: McpClientManager;
  /**
   * Per-server policy map.
   * The meta-tools will reject access to any serverId not present in this map.
   */
  policyByServer: Record<string, McpMetaToolPolicy>;
  limits?: McpMetaToolLimits;
};

/** Standard response format for MCP meta-tool operations. */
type MetaToolResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

/** Default values for MCP meta-tool limits. */
const DEFAULT_LIMITS: Required<McpMetaToolLimits> = {
  maxToolsPerServer: 200,
  maxSchemaJsonChars: 64_000,
  maxResultJsonChars: 64_000,
  maxDescriptionChars: 400,
  callTimeoutMs: 30_000,
};

/** Input schema for the `mcp.callTool` operation. */
const callToolInputSchema = z.object({
  serverId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.unknown(),
});

/**
 * Type guard for record-like objects.
 *
 * @param value - Value to check.
 * @returns True if value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Truncate string to maximum length with ellipsis.
 *
 * @param value - Original string.
 * @param maxChars - Maximum allowed characters.
 * @returns Truncated string.
 */
function truncateString(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}…`;
}

/**
 * Serialize value to JSON and enforce character limit.
 *
 * @param value - Value to serialize.
 * @param maxChars - Maximum allowed JSON characters.
 * @returns Original value if serializable and within limit, or truncation/error metadata.
 */
function safeJsonWithLimit(value: unknown, maxChars: number): unknown {
  if (value === undefined) {
    return undefined;
  }

  try {
    const json = JSON.stringify(value);
    if (json.length <= maxChars) {
      return value;
    }
    return {
      note: "truncated",
      jsonPreview: truncateString(json, maxChars),
    };
  } catch {
    return { note: "non-serializable" };
  }
}

/**
 * Extract and truncate tool description from tool object.
 *
 * @param toolValue - Raw tool object.
 * @param maxChars - Maximum description length.
 * @returns Truncated description or undefined.
 */
function getToolDescription(
  toolValue: unknown,
  maxChars: number,
): string | undefined {
  if (!isRecord(toolValue)) {
    return undefined;
  }
  const description = toolValue.description;
  if (typeof description !== "string") {
    return undefined;
  }
  return truncateString(description, maxChars);
}

/**
 * Extract input and output schemas from tool object.
 *
 * @param toolValue - Raw tool object.
 * @returns Object containing optional input/output schemas.
 */
function getToolSchemas(toolValue: unknown): {
  inputSchema?: unknown;
  outputSchema?: unknown;
} {
  if (!isRecord(toolValue)) {
    return {};
  }

  return {
    inputSchema: toolValue.inputSchema,
    outputSchema: toolValue.outputSchema,
  };
}

/**
 * Extract the execution function from a tool object.
 *
 * @param toolValue - Raw tool object.
 * @returns Execute function or undefined.
 */
function getToolExecute(
  toolValue: unknown,
):
  | ((input: unknown, options: unknown) => unknown | Promise<unknown>)
  | undefined {
  if (!isRecord(toolValue)) {
    return undefined;
  }

  const exec = toolValue.execute;
  if (typeof exec !== "function") {
    return undefined;
  }

  return (input: unknown, options: unknown) =>
    (exec as (a: unknown, b: unknown) => unknown)(input, options);
}

/**
 * Convert meta-tool policy to standard tool access policy.
 *
 * @param policy - Meta-tool policy.
 * @returns Normalized tool access policy.
 */
function buildToolAccessPolicy(policy: McpMetaToolPolicy): ToolAccessPolicy {
  const out: ToolAccessPolicy = {};
  if (policy.allowTools !== undefined) {
    out.allowTools = policy.allowTools;
  }
  if (policy.denyTools !== undefined) {
    out.denyTools = policy.denyTools;
  }
  return out;
}

/**
 * Validate that a server is enabled for meta-tool access.
 *
 * @param policyByServer - Policy map.
 * @param serverId - Target server ID.
 * @returns Server policy.
 * @throws Error if server is not in policy map.
 */
function enforceServerAccess(
  policyByServer: Record<string, McpMetaToolPolicy>,
  serverId: string,
): McpMetaToolPolicy {
  const policy = policyByServer[serverId];
  if (!policy) {
    throw new Error(
      `MCP serverId '${serverId}' is not enabled for meta-tool access.`,
    );
  }
  return policy;
}

/**
 * Combine existing execution options with a timeout signal.
 *
 * @param existing - Original execution options.
 * @param timeoutMs - Timeout in milliseconds.
 * @returns New execution options with combined abort signal.
 */
function withTimeoutSignal(
  existing: unknown,
  timeoutMs: number,
): { execOptions: unknown; clearTimeout: () => void } {
  if (timeoutMs <= 0) {
    return { execOptions: existing, clearTimeout: () => {} };
  }

  const signal =
    isRecord(existing) && existing.abortSignal instanceof AbortSignal
      ? existing.abortSignal
      : undefined;

  const controller = new AbortController();
  const timerId = setTimeout(
    () => controller.abort(new Error("mcp.callTool timeout")),
    timeoutMs,
  );

  const combined = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  combined.addEventListener(
    "abort",
    () => {
      clearTimeout(timerId);
    },
    { once: true },
  );

  const execOptions = isRecord(existing)
    ? { ...existing, abortSignal: combined }
    : { abortSignal: combined };

  return { execOptions, clearTimeout: () => clearTimeout(timerId) };
}

/**
 * Build the MCP meta-tool surface for listing, inspecting, and calling tools.
 *
 * @param options - Client manager, policies, and limits for meta tools.
 * @returns AI SDK tool set exposing meta operations.
 * @see docs/specs/011-dynamic-tool-loading.md
 */
export function createMcpMetaTools(
  options: CreateMcpMetaToolsOptions,
): ToolSet {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) };

  const listTools = tool({
    description:
      "List tools available from a specific MCP server (filtered by policy).",
    inputSchema: z.object({
      serverId: z.string().min(1),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(128).optional(),
    }),
    execute: async ({ serverId, offset, limit }) => {
      const policy = enforceServerAccess(options.policyByServer, serverId);
      const toolSet = await options.clientManager.getTools(serverId);

      const names = filterToolNames(
        Object.keys(toolSet),
        buildToolAccessPolicy(policy),
      ).sort((a, b) => a.localeCompare(b));

      const start = offset ?? 0;
      const end = limit ? start + limit : undefined;
      const page = names.slice(start, end);
      const capped = page.slice(0, limits.maxToolsPerServer);

      return capped.map((name) => ({
        name,
        description: getToolDescription(
          toolSet[name],
          limits.maxDescriptionChars,
        ),
      }));
    },
  });

  const getToolSchema = tool({
    description:
      "Get the JSON schema (input/output) for a single MCP tool. Use this before calling a tool to avoid invalid arguments.",
    inputSchema: z.object({
      serverId: z.string().min(1),
      toolName: z.string().min(1),
    }),
    execute: async ({ serverId, toolName }) => {
      const policy = enforceServerAccess(options.policyByServer, serverId);
      const toolSet = await options.clientManager.getTools(serverId);

      const allowedNames = new Set(
        filterToolNames(Object.keys(toolSet), buildToolAccessPolicy(policy)),
      );

      if (!allowedNames.has(toolName)) {
        return {
          ok: false,
          error: `Tool '${toolName}' is not allowed or does not exist on server '${serverId}'.`,
        };
      }

      const toolValue = toolSet[toolName];
      const schemas = getToolSchemas(toolValue);

      return {
        ok: true,
        toolName,
        description: getToolDescription(toolValue, limits.maxDescriptionChars),
        inputSchema: safeJsonWithLimit(
          schemas.inputSchema,
          limits.maxSchemaJsonChars,
        ),
        outputSchema: safeJsonWithLimit(
          schemas.outputSchema,
          limits.maxSchemaJsonChars,
        ),
      };
    },
  });

  const callTool = dynamicTool({
    description:
      "Call any allowed MCP tool by name. For best results: call `mcp.getToolSchema` first and follow the returned schema.",
    inputSchema: callToolInputSchema,
    execute: async (input: unknown, execOptions): Promise<MetaToolResponse> => {
      const parsed = callToolInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid input for mcp.callTool.",
        };
      }
      const { serverId, toolName, args } = parsed.data;
      const policy = enforceServerAccess(options.policyByServer, serverId);
      const toolSet = await options.clientManager.getTools(serverId);

      const allowedNames = new Set(
        filterToolNames(Object.keys(toolSet), buildToolAccessPolicy(policy)),
      );

      if (!allowedNames.has(toolName)) {
        return {
          ok: false,
          error: `Tool '${toolName}' is not allowed or does not exist on server '${serverId}'.`,
        };
      }

      const toolValue = toolSet[toolName];
      const exec = getToolExecute(toolValue);

      if (!exec) {
        return {
          ok: false,
          error: `Tool '${toolName}' on server '${serverId}' is missing an execute function.`,
        };
      }

      const { execOptions: execOptionsWithTimeout, clearTimeout: clearTimer } =
        withTimeoutSignal(execOptions, limits.callTimeoutMs);

      try {
        const result = await exec(args, execOptionsWithTimeout);

        return {
          ok: true,
          result: safeJsonWithLimit(result, limits.maxResultJsonChars),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      } finally {
        clearTimer();
      }
    },
  });

  return {
    "mcp.listTools": listTools,
    "mcp.getToolSchema": getToolSchema,
    "mcp.callTool": callTool,
  };
}
