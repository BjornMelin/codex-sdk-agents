import {
  createMCPClient,
  ElicitationRequestSchema,
  type MCPTransport,
  type OAuthClientProvider,
} from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

import type { McpServerConfig, McpTransportConfig } from "../types.js";

/**
 * AI SDK MCP client instance type.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type McpClient = Awaited<ReturnType<typeof createMCPClient>>;

/**
 * Hook callbacks for MCP client lifecycle events.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export type CreateMcpClientHooks = {
  onUncaughtError?: (error: unknown) => void;
  onElicitationRequest?: Parameters<McpClient["onElicitationRequest"]>[1];
};

type McpTransportInput = NonNullable<
  Parameters<typeof createMCPClient>[0]["transport"]
>;

function createMcpTransportConfig(
  config: McpTransportConfig,
  authProvider?: OAuthClientProvider,
): McpTransportInput | MCPTransport {
  if (config.type === "stdio") {
    return new Experimental_StdioMCPTransport({
      command: config.command,
      ...(config.args !== undefined ? { args: config.args } : {}),
      ...(config.cwd !== undefined ? { cwd: config.cwd } : {}),
      ...(config.env !== undefined ? { env: config.env } : {}),
      ...(config.stderr !== undefined ? { stderr: config.stderr } : {}),
    });
  }

  if (config.type === "sse") {
    return {
      type: "sse",
      url: config.url,
      ...(config.headers !== undefined ? { headers: config.headers } : {}),
      ...(authProvider !== undefined ? { authProvider } : {}),
    };
  }

  return {
    type: "http",
    url: config.url,
    ...(config.headers !== undefined ? { headers: config.headers } : {}),
    ...(authProvider !== undefined ? { authProvider } : {}),
  };
}

/**
 * Create an AI SDK MCP client from a validated server config.
 *
 * @see docs/specs/010-mcp-platform.md
 */
export async function createAiSdkMcpClient(
  server: McpServerConfig,
  hooks: CreateMcpClientHooks,
  authProvider?: OAuthClientProvider,
): Promise<McpClient> {
  const transport = createMcpTransportConfig(server.transport, authProvider);

  const client = await createMCPClient({
    name: server.id,
    transport,
    ...(hooks.onUncaughtError !== undefined
      ? { onUncaughtError: hooks.onUncaughtError }
      : {}),
    ...(hooks.onElicitationRequest
      ? { capabilities: { elicitation: {} } }
      : {}),
  });

  if (hooks.onElicitationRequest) {
    client.onElicitationRequest(
      ElicitationRequestSchema,
      hooks.onElicitationRequest,
    );
  }

  return client;
}
