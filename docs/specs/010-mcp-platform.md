# SPEC 010: MCP platform (client lifecycle + config + transport support)

Status: **Completed** ✅

This SPEC defines the **MCP substrate** used by Codex ToolLoop:

- a validated, multi-source MCP configuration format (file + env + runtime overrides)
- MCP client lifecycle management (lazy connect, caching, deterministic cleanup)
- transport support for:
  - **STDIO** (experimental, local development only, Node-only) via AI SDK `Experimental_StdioMCPTransport` — **not production-ready**
  - **HTTP** (production-ready, Streamable HTTP servers) via AI SDK `createMCPClient`
  - **SSE** (production-ready, legacy compatibility) via AI SDK transport config for legacy MCP servers

> First-party MCP server implementations (repo tools, shell, editor, etc.) are explicitly **out of scope** for SPEC 010.
> SPEC 010 is only the platform substrate that can connect to those servers.

## Goals

1. Provide a stable, strict configuration and validation boundary for MCP servers and tool bundles.
2. Provide production-grade MCP client lifecycle handling:
   - lazy connect
   - tool catalog caching with TTL
   - deterministic cleanup (`closeAll`)
3. Support required MCP transports:
   - STDIO
   - Streamable HTTP
   - SSE compatibility

## Non-goals

- Implementing first-party MCP servers.
- Implementing workflow orchestration (routing is defined in SPEC 011 + workflows package).

## References

- AI SDK MCP tools overview: <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- `createMCPClient`: <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client>
- `Experimental_StdioMCPTransport`: <https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-stdio-transport>
- MCP specification (2025-11-25): <https://modelcontextprotocol.io/specification/2025-11-25>
- MCP lifecycle: <https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle>
- MCP transports specification: <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- MCP authorization: <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>
- MCP security best practices: <https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices>
- MCP tools: <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
- MCP changelog (2025-11-25): <https://modelcontextprotocol.io/specification/2025-11-25/changelog>

## Configuration

### Supported sources and precedence

Configuration sources (highest precedence wins):

1. **Runtime overrides** passed by the caller (`loadMcpConfig({ overrides })`)
2. **Environment**: `CODEX_TOOLLOOP_MCP_CONFIG_JSON` (inline JSON)
3. **File-based config** with the following precedence order:
   - explicit path argument (e.g., `loadMcpConfig({ path: "./custom.json" })`)
   - environment variable (`CODEX_TOOLLOOP_MCP_CONFIG_PATH`)
   - discovered config (auto-discovery of `codex-toolloop.mcp.json` or `.codex-toolloop/mcp.json` walking up from cwd)

### Environment variables

- `CODEX_TOOLLOOP_MCP_CONFIG_PATH` — explicit JSON file path
- `CODEX_TOOLLOOP_MCP_CONFIG_JSON` — JSON string containing a partial or full config

### File discovery

Discovery walks upward from `cwd` looking for the first existing file:

1. `codex-toolloop.mcp.json`
2. `.codex-toolloop/mcp.json`

### File format

JSON only (v1). The file schema is identical to the `CODEX_TOOLLOOP_MCP_CONFIG_JSON` schema.

### Schema

Top-level object:

```json
{
  "servers": {
    "repo": {
      "trust": "trusted",
      "transport": { "type": "http", "url": "http://localhost:4010/mcp" }
    }
  },
  "bundles": {
    "repoRead": {
      "serverId": "repo",
      "mode": "direct",
      "allowTools": ["readFile", "search"]
    }
  }
}
```

Server config:

- `trust`: `"trusted" | "untrusted"`
- `transport`:
  - `{ type: "http", url: string, headers?: Record<string,string>, authProviderId?: string }`
  - `{ type: "sse", url: string, headers?: Record<string,string>, authProviderId?: string }`
  - `{ type: "stdio", command: string, args?: string[], cwd?: string, env?: Record<string,string> }`

Bundle config:

- `serverId`: must refer to an entry in `servers`
- `mode`: `"direct" | "meta"`
  - `direct`: inject namespaced tool definitions into the model
  - `meta`: expose the MCP meta-tool surface (SPEC 011)
- `allowTools` / `denyTools`:
  - tool names are server-local (pre-namespacing)
  - `allowTools` is optional for **trusted** servers
  - `allowTools` is **required** for **untrusted** servers (enforced by SPEC 011)
  - `allowTools` cannot be an empty array:
    - omit `allowTools` to allow all tools (trusted servers only)
    - when intersecting multiple allowlists (SPEC 011), an empty intersection means allow no tools
  - **Precedence rule**: When both `allowTools` and `denyTools` are present, apply `allowTools` first to produce an initial allowed set, then remove any entries matched by `denyTools`. In other words, **deny overrides allow**. Example: if `allowTools = ["read", "write", "delete"]` and `denyTools = ["delete"]`, the final allowed set is `["read", "write"]`.

### Public API

Owned by `packages/mcp`:

- `parseMcpConfig(input: unknown): McpConfig`
- `loadMcpConfig(options?: LoadMcpConfigOptions): Promise<McpConfigLoadResult>`
- `discoverMcpConfigPath(...)`

## Client lifecycle

Owned by `packages/mcp`.

### `McpClientManager`

Responsibilities:

- lazy connect: create MCP clients only when a server is actually used
- tool catalog caching with TTL (`toolsTtlMs`)
- deterministic cleanup:
  - `close(serverId)`
  - `closeAll()` (must always be called by the orchestrator / run boundary)

### Authorization (OAuth 2.1)

For remote MCP servers that require OAuth 2.1, configure `authProviderId` on the server transport and supply an `authProvidersById` map to `McpClientManager` at runtime. The manager resolves the provider and passes it to AI SDK `createMCPClient({ authProvider })`.

This keeps interactive flows and secrets out of static config files while remaining MCP 2025-11-25 compliant.

### Safety posture

- MCP server configuration is an explicit allowlist (no discovery of external servers at runtime).
- STDIO servers are local-only and must be configured explicitly.
- Networked servers must be configured with explicit URLs and optional headers.
- Tool definitions and tool outputs from **untrusted** servers must be treated as hostile input (enforced via SPEC 011).

### Known limitations

**Media serialization in MCP tool results:**

MCP tool results carrying non-text media (images, audio, binary files) may be serialized as JSON/plain text (e.g., large base64 blobs) rather than converted into AI SDK multimodal message types. This can significantly inflate token/context usage and degrade model performance.

**Mitigation:**

- Implementers should explicitly convert non-text media to AI SDK multimodal content types (`image-data`, `file-data`, etc.) or use lightweight references (URLs, artifact paths).
- Reference tool outputs and untrusted input handling in SPEC 011.
- Media conversion is recommended at the tool boundary (e.g., in `dynamicTool()` wrappers) to normalize results before consumption.

## Implementation

Key modules:

- `packages/mcp/src/config.ts`
  - config discovery + loading + Zod validation
- `packages/mcp/src/client/create-ai-sdk-mcp-client.ts`
  - transport adapter for `createMCPClient` + `Experimental_StdioMCPTransport`
- `packages/mcp/src/client/mcp-client-manager.ts`
  - client lifecycle (lazy connect, caching, cleanup)

## Testing

Vitest coverage (v1):

- config parsing + validation
- config loading precedence (file vs env vs overrides)
- client manager caching and deterministic cleanup

Tests live in `tests/unit/*`.

## Verification

Run in repo root:

1. `pnpm install`
2. `pnpm -s check`
3. `pnpm -s build`
