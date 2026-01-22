import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { ZodError, z } from "zod";

import {
  type McpConfig,
  type McpServerConfig,
  type McpToolBundle,
  mcpTransportSchema,
  mcpTrustLevelSchema,
} from "./types.js";

/**
 * Env var pointing to an MCP config file path.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export const MCP_CONFIG_ENV_PATH = "CODEX_TOOLLOOP_MCP_CONFIG_PATH";
/**
 * Env var containing inline MCP config JSON.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export const MCP_CONFIG_ENV_JSON = "CODEX_TOOLLOOP_MCP_CONFIG_JSON";

/**
 * Partial MCP config shape accepted by loaders and overrides.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpConfigFileInput = {
  servers?: Record<string, Omit<McpServerConfig, "id">>;
  bundles?: Record<string, Omit<McpToolBundle, "id">>;
};

/**
 * Source metadata for each MCP config fragment that was loaded.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpConfigSourceInfo =
  | { kind: "file"; path: string }
  | { kind: "env"; variable: typeof MCP_CONFIG_ENV_JSON }
  | { kind: "overrides" };

/**
 * Loaded MCP config along with its source provenance.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpConfigLoadResult = {
  config: McpConfig;
  sources: McpConfigSourceInfo[];
};

/**
 * Configuration inputs for MCP config discovery and loading.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type LoadMcpConfigOptions = {
  /**
   * Base directory for config discovery and resolving relative paths.
   * Defaults to process.cwd().
   */
  cwd?: string;
  /**
   * Optional explicit file path.
   * If provided, discovery is skipped. Relative paths are resolved against `cwd`.
   */
  configPath?: string;
  /**
   * Environment variables source.
   *
   * Defaults to process.env.
   */
  env?: Record<string, string | undefined>;
  /**
   * Runtime overrides that merge on top of file/env config.
   * Use this for per-run configuration (e.g., disable a server, switch bundles).
   */
  overrides?: McpConfigFileInput;
};

const rawServerSchema = z.strictObject({
  label: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  trust: mcpTrustLevelSchema,
  transport: mcpTransportSchema,
  enabled: z.boolean().optional(),
});

const rawBundleSchema = z.strictObject({
  label: z.string().min(1).optional(),
  serverId: z.string().min(1),
  mode: z.enum(["direct", "meta"]).default("direct"),
  allowTools: z.array(z.string().min(1)).optional(),
  denyTools: z.array(z.string().min(1)).optional(),
  description: z.string().min(1).optional(),
});

const rawConfigPartSchema = z.strictObject({
  servers: z.record(z.string(), rawServerSchema).default({}),
  bundles: z.record(z.string(), rawBundleSchema).default({}),
});

const rawConfigSchema = rawConfigPartSchema.superRefine((value, ctx) => {
  for (const [bundleId, bundle] of Object.entries(value.bundles)) {
    if (!(bundle.serverId in value.servers)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bundles", bundleId, "serverId"],
        message: `Unknown serverId '${bundle.serverId}' referenced by bundle '${bundleId}'.`,
      });
    }
  }
});

type RawConfigPart = z.infer<typeof rawConfigPartSchema>;
type RawServer = RawConfigPart["servers"][string];
type RawBundle = RawConfigPart["bundles"][string];

/**
 * Normalize raw server configurations into MCP config format.
 *
 * @param servers - Raw server configurations.
 * @returns Normalized MCP server configurations.
 */
function normalizeServers(
  servers: Record<string, RawServer>,
): McpConfig["servers"] {
  const out: McpConfig["servers"] = {};
  for (const [id, server] of Object.entries(servers)) {
    out[id] = {
      id,
      trust: server.trust,
      transport: server.transport,
      ...(server.label !== undefined ? { label: server.label } : {}),
      ...(server.enabled !== undefined ? { enabled: server.enabled } : {}),
    };
  }
  return out;
}

/**
 * Normalize raw bundle configurations into MCP config format.
 *
 * @param bundles - Raw bundle configurations.
 * @returns Normalized MCP tool bundle configurations.
 */
function normalizeBundles(
  bundles: Record<string, RawBundle>,
): McpConfig["bundles"] {
  const out: McpConfig["bundles"] = {};
  for (const [id, bundle] of Object.entries(bundles)) {
    out[id] = {
      id,
      serverId: bundle.serverId,
      mode: bundle.mode,
      ...(bundle.label !== undefined ? { label: bundle.label } : {}),
      ...(bundle.allowTools !== undefined
        ? { allowTools: bundle.allowTools }
        : {}),
      ...(bundle.denyTools !== undefined
        ? { denyTools: bundle.denyTools }
        : {}),
    };
  }
  return out;
}

/** Format a ZodError into a human-readable string.
 *
 * @param error - The ZodError to format.
 * @returns Formatted error string.
 */
function formatZodError(error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "<root>" : issue.path.join(".");
    return `- ${path}: ${issue.message}`;
  });
  return lines.join("\n");
}

/**
 * Parse and validate a Codex ToolLoop MCP configuration object.
 *
 * @param input - Raw config input to validate.
 * @returns Normalized MCP config.
 * @see docs/specs/010-mcp-platform.md
 */
export function parseMcpConfig(input: unknown): McpConfig {
  try {
    const raw = rawConfigSchema.parse(input);
    return {
      servers: normalizeServers(raw.servers),
      bundles: normalizeBundles(raw.bundles),
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Invalid MCP config:\n${formatZodError(error)}`);
    }
    throw error;
  }
}

/**
 * Default filenames used for MCP config discovery.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export const DEFAULT_MCP_CONFIG_FILENAMES = [
  "codex-toolloop.mcp.json",
  join(".codex-toolloop", "mcp.json"),
] as const;

/** Check whether a file path exists.
 *
 * @param filePath - Path to check.
 * @returns True when the file exists.
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a file path against a base cwd.
 *
 * @param cwd - Base directory.
 * @param filePath - Path to resolve.
 * @returns Absolute resolved path.
 */
function resolveAgainstCwd(cwd: string, filePath: string): string {
  if (isAbsolute(filePath)) {
    return filePath;
  }
  return resolve(cwd, filePath);
}

/**
 * Discover the MCP config path using explicit config, env, or filesystem search.
 *
 * @param options - Options for discovering the MCP config path.
 * @returns The discovered MCP config path or null if not found.
 * @see docs/specs/010-mcp-platform.md
 */
export async function discoverMcpConfigPath(options: {
  cwd: string;
  env: Record<string, string | undefined>;
  configPath?: string;
  fileNames?: readonly string[];
}): Promise<string | null> {
  const maxSearchDepth = 100;
  if (options.configPath) {
    const explicit = resolveAgainstCwd(options.cwd, options.configPath);
    if (!(await pathExists(explicit))) {
      throw new Error(
        `MCP config file not found at explicit path: ${explicit}`,
      );
    }
    return explicit;
  }

  const envPath = options.env[MCP_CONFIG_ENV_PATH];
  if (envPath) {
    const explicit = resolveAgainstCwd(options.cwd, envPath);
    if (!(await pathExists(explicit))) {
      throw new Error(
        `MCP config file not found at ${MCP_CONFIG_ENV_PATH}: ${explicit}`,
      );
    }
    return explicit;
  }

  const names = options.fileNames ?? DEFAULT_MCP_CONFIG_FILENAMES;

  let dir = options.cwd;
  let depth = 0;
  while (true) {
    if (depth++ > maxSearchDepth) {
      return null;
    }
    for (const name of names) {
      const candidate = join(dir, name);
      if (await pathExists(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/** Merge multiple raw MCP config parts into one.
 *
 * @param parts - Raw config parts to merge.
 * @returns Merged raw config part.
 */
function mergeConfigParts(parts: readonly RawConfigPart[]): RawConfigPart {
  const merged: RawConfigPart = { servers: {}, bundles: {} };

  for (const part of parts) {
    merged.servers = { ...merged.servers, ...part.servers };
    merged.bundles = { ...merged.bundles, ...part.bundles };
  }

  return merged;
}

/**
 * Load MCP config from supported sources (file discovery, env JSON, runtime overrides).
 *
 * Precedence (last wins):
 * 1) file config (discovered or explicit)
 * 2) env JSON (`CODEX_TOOLLOOP_MCP_CONFIG_JSON`)
 * 3) runtime overrides
 *
 * @param options - Options for loading the MCP config.
 * @returns Loaded MCP config along with its source provenance.
 * @see docs/specs/010-mcp-platform.md
 */
export async function loadMcpConfig(
  options: LoadMcpConfigOptions = {},
): Promise<McpConfigLoadResult> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const sources: McpConfigSourceInfo[] = [];
  const parts: RawConfigPart[] = [];

  const discoveredPath = await discoverMcpConfigPath({
    cwd,
    env,
    ...(options.configPath !== undefined
      ? { configPath: options.configPath }
      : {}),
  });
  if (discoveredPath) {
    const rawText = await readFile(discoveredPath, "utf-8");
    let json: unknown;
    try {
      json = JSON.parse(rawText) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse MCP config JSON (${discoveredPath}): ${message}`,
      );
    }

    const parsed = rawConfigPartSchema.parse(json);
    parts.push(parsed);
    sources.push({ kind: "file", path: discoveredPath });
  }

  const envJson = env[MCP_CONFIG_ENV_JSON];
  if (envJson && envJson.trim().length > 0) {
    let json: unknown;
    try {
      json = JSON.parse(envJson) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse ${MCP_CONFIG_ENV_JSON} as JSON: ${message}`,
      );
    }
    parts.push(rawConfigPartSchema.parse(json));
    sources.push({ kind: "env", variable: MCP_CONFIG_ENV_JSON });
  }

  if (options.overrides) {
    parts.push(rawConfigPartSchema.parse(options.overrides));
    sources.push({ kind: "overrides" });
  }

  const merged = mergeConfigParts(parts);
  const config = parseMcpConfig(merged);

  return { config, sources };
}
