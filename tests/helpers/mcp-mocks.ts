import type { McpClient } from "../../packages/mcp/src/client/create-ai-sdk-mcp-client.js";

export type { McpClient };

export type McpToolSet = Record<string, unknown>;

export function makeClient(tools: McpToolSet): McpClient {
  return {
    tools: async () => tools,
    listResources: async () => ({ resources: [] }),
    readResource: async () => ({ contents: [] }),
    listResourceTemplates: async () => ({ resourceTemplates: [] }),
    experimental_listPrompts: async () => ({ prompts: [] }),
    experimental_getPrompt: async () => ({ messages: [] }),
    onElicitationRequest: () => {},
    close: async () => {},
  } as McpClient;
}
