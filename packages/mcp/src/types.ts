import { z } from "zod";

/**
 * Zod schema for MCP trust levels.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export const mcpTrustLevelSchema = z.enum(["trusted", "untrusted"]);

/**
 * Trust level for an MCP server.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpTrustLevel = z.infer<typeof mcpTrustLevelSchema>;

/**
 * Zod schema for HTTP transport config for MCP servers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
const mcpHttpTransportSchema = z.strictObject({
  type: z.literal("http"),
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
  authProviderId: z.string().min(1).optional(),
});

/**
 * Zod schema for SSE transport config for MCP servers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
const mcpSseTransportSchema = z.strictObject({
  type: z.literal("sse"),
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
  authProviderId: z.string().min(1).optional(),
});

/**
 * Zod schema for STDIO transport config for MCP servers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
const mcpStdioTransportSchema = z.strictObject({
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  stderr: z
    .union([z.enum(["inherit", "pipe", "ignore"]), z.number().int()])
    .optional(),
});

/**
 * Zod schema for supported MCP transport configs.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export const mcpTransportSchema = z.union([
  mcpHttpTransportSchema,
  mcpSseTransportSchema,
  mcpStdioTransportSchema,
]);

/**
 * HTTP transport config for MCP servers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpHttpTransportConfig = z.infer<typeof mcpHttpTransportSchema>;
/**
 * SSE transport config for MCP servers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpSseTransportConfig = z.infer<typeof mcpSseTransportSchema>;
/**
 * STDIO transport config for MCP servers.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpStdioTransportConfig = z.infer<typeof mcpStdioTransportSchema>;
/**
 * Union of supported MCP transport configs.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpTransportConfig = z.infer<typeof mcpTransportSchema>;

/**
 * Validated MCP server configuration.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpServerConfig = {
  /** Unique identifier for the server. */
  id: string;
  /** Human-readable label for the server. */
  label?: string;
  /** Trust level determining allowed capabilities. */
  trust: McpTrustLevel;
  /** Transport configuration for connecting to the server. */
  transport: McpTransportConfig;
  /** Whether the server is currently enabled. */
  enabled?: boolean;
};

/**
 * Mode that controls how a tool bundle is exposed.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpToolBundleMode = "direct" | "meta";

/**
 * Tool bundle definition that targets a single MCP server.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpToolBundle = {
  /** Unique identifier for the bundle. */
  id: string;
  /** Human-readable label for the bundle. */
  label?: string;
  /** ID of the server instance this bundle targets. */
  serverId: string;
  /** Exposure mode for the tools in this bundle. */
  mode: McpToolBundleMode;
  /** Optional allowlist of tool names. */
  allowTools?: string[];
  /** Optional denylist of tool names. */
  denyTools?: string[];
};

/**
 * Fully-resolved MCP config for servers and bundles.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpConfig = {
  /** Map of server configurations by ID. */
  servers: Record<string, McpServerConfig>;
  /** Map of tool bundle definitions by ID. */
  bundles: Record<string, McpToolBundle>;
};

/**
 * Partial MCP config used for overrides.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpConfigInput = Partial<McpConfig>;
