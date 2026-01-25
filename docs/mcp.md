# MCP in Codex ToolLoop

Codex ToolLoop uses the **Model Context Protocol (MCP)** as the single tool substrate (ADR 0003).

Goals:

- unify first-party and third-party tools behind one protocol
- support both deployable MCP servers (HTTP/SSE) and local MCP servers (STDIO)
- minimize model context bloat via dynamic tool loading (ADR 0009 / SPEC 011)

## Key AI SDK primitives

- `createMCPClient()` – connect to MCP servers and produce AI SDK tools
  - <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client>
- `dynamicTool()` – define tools whose schemas are only known at runtime
  - <https://ai-sdk.dev/docs/reference/ai-sdk-core/dynamic-tool#dynamictool>
- `Experimental_StdioMCPTransport` – spawn a local STDIO MCP server process
  - <https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-stdio-transport>

## Transports

This repo targets the MCP 2025-11-25 specification. For remote servers, prefer the Streamable HTTP transport (AI SDK transport `type: "http"`), with `type: "sse"` supported for legacy HTTP+SSE servers.

- Spec: <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>

### HTTP / SSE (recommended for production)

Use HTTP or SSE for MCP servers that run as deployable services.

- MCP tools guide: <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- AI SDK tools + tool calling guide: <https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling>
- Node cookbook: <https://ai-sdk.dev/cookbook/node/mcp-tools>
- Next.js cookbook: <https://ai-sdk.dev/cookbook/next/mcp-tools>

### STDIO (local-only)

STDIO runs an MCP server as a child process and communicates over stdin/stdout. This is useful for:

- local dev tooling
- native tooling (filesystem, shell) that should never be exposed over the network

The AI SDK reference documents `Experimental_StdioMCPTransport` for this mode.

## Context bloat control

This repo supports two ways to expose a tool bundle:

- **direct mode**: inject a small allowlisted tool set directly into the model context
- **meta mode (preferred)**: inject only the MCP meta-tools:
  - `mcp.listTools`
  - `mcp.getToolSchema`
  - `mcp.callTool`

In meta mode, the model fetches tool schemas only when needed, dramatically reducing the amount of tool definition text in the prompt.

See:

- ADR 0009: <./adr/0009-dynamic-tool-loading.md>
- SPEC 011: <./specs/011-dynamic-tool-loading.md>

## Related projects

- Vercel `mcp-to-ai-sdk` (tool mapping examples): <https://github.com/vercel-labs/mcp-to-ai-sdk>
- Vercel blog (MCP + AI SDK): <https://vercel.com/blog/simpler-ai-tool-usage-with-mcp-and-the-ai-sdk>
- MCP spec and SDKs: <https://modelcontextprotocol.io/>
- MCP TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>
