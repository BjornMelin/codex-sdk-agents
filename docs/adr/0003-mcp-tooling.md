# ADR 0003: MCP as the single tool substrate for both Codex and Codex ToolLoop

Status: **Accepted**

## Context

Codex ToolLoop needs a single, consistent way to:

- expose tools to models (Codex, other LLMs)
- route tool calls to implementations
- support both **first-party tools** (repo reading, shell, editing) and **third-party integrations** (GitHub, Jira, etc.)
- avoid runaway context bloat as the tool catalog grows

The **Model Context Protocol (MCP)** provides a standardized tool server model and transport options. In particular, the Vercel AI SDK v6 provides a first-class MCP client API and utilities to map MCP tools into AI SDK tool sets.

## Decision

1. **Use MCP as the only tool substrate**. All tools are surfaced through MCP servers, even if a server is local-only and embedded.
2. **Support both MCP transports:**
   - **HTTP/SSE** transport for deployable, networked MCP servers.
   - **STDIO** transport for local-only MCP servers (spawns a process and speaks MCP over stdin/stdout) via `Experimental_StdioMCPTransport`.
3. **Default transport policy:**
   - Prefer **HTTP (Streamable HTTP)** for production.
   - Use **SSE** only for compatibility with servers that do not support Streamable HTTP.
   - Use **STDIO** for local development and power-user workflows where spawning local processes is acceptable.
4. Pair this with **dynamic tool loading** (ADR 0009) to avoid injecting huge tool catalogs into every model context.
5. **Support OAuth 2.1 protected MCP servers** by wiring `authProviderId` → `OAuthClientProvider` at runtime and passing `authProvider` into AI SDK `createMCPClient`.

## Consequences

- `packages/mcp` owns:
  - config parsing (`parseMcpConfig`)
  - client lifecycle (`McpClientManager`)
  - dynamic tool resolution (`DynamicToolRegistry`)
  - meta-tool surface (`mcp.listTools`, `mcp.getToolSchema`, `mcp.callTool`)
- The runtime is Node.js (ADR 0001), which enables STDIO MCP.
- Tool outputs from untrusted servers must be treated as hostile input (see trust level in MCP config).

## References

AI SDK MCP client + tools:

- MCP tools guide: <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- AI SDK tools + tool calling guide: <https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling>
- `createMCPClient` reference: <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client>
- MCP stdio transport reference (`Experimental_StdioMCPTransport`): <https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-stdio-transport>
- Dynamic tool helper (`dynamicTool`): <https://ai-sdk.dev/docs/reference/ai-sdk-core/dynamic-tool#dynamictool>

MCP / AI SDK background:

- Vercel blog: “Simpler AI tool usage with MCP and the AI SDK”: <https://vercel.com/blog/simpler-ai-tool-usage-with-mcp-and-the-ai-sdk>
- Vercel blog: “AI SDK 6”: <https://vercel.com/blog/ai-sdk-6>
- AI SDK GitHub repo: <https://github.com/vercel/ai>
- `mcp-to-ai-sdk` GitHub repo: <https://github.com/vercel-labs/mcp-to-ai-sdk>
- Model Context Protocol specification (2025-11-25): <https://modelcontextprotocol.io/specification/2025-11-25/>
- MCP transports: <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- MCP authorization: <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>
- MCP security best practices: <https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices>

Codex integration context:

- Codex CLI docs: <https://developers.openai.com/codex/cli/>

## Amendments

- 2026-01-21: Clarified that networked transport support targets Streamable HTTP (with SSE compatibility) to align with the MCP transports spec and AI SDK transport configuration.
