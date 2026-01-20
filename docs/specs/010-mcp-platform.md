# SPEC 010: MCP platform (first-party MCP servers + client manager + dynamic tool registry)

You are implementing the MCP tool substrate for Codex ToolLoop.

## Objectives

1. Implement a first-party MCP server suite in `packages/mcp` using streamable HTTP transport by default.
2. Implement an MCP client manager capable of:
   - connecting to configured servers
   - listing tools
   - calling tools directly (Codex ToolLoop-side)
3. Implement a tool registry abstraction that can:
   - merge tools from multiple servers
   - enforce allowlist/denylist
   - produce a “Codex mcpServers config” object for backends

## Hard requirements

- Transport default: HTTP server at `http://127.0.0.1:<port>/mcp`.
- Must support multiple servers simultaneously.
- Tool schemas are defined using Zod v4.3.5.
- JSON Schema generation uses `z.toJSONSchema()` (Zod v4 native).
- No `any`.

## First-party MCP servers to implement (MVP)

Implement at least these tools:

### Tool: repo.ripgrep

- Input:
  - `query: string`
  - `globs?: string[]`
  - `maxMatches?: number` (default 50)
- Output:
  - list of matches:
    - filePath
    - lineNumber
    - lineText
- Implementation:
  - spawn `rg` if available, otherwise fallback to a simple recursive scan (document fallback)
  - protect performance with max matches

### Tool: repo.readFile

- Input:
  - `path: string`
  - `maxBytes?: number` default 200_000
- Output:
  - `path`
  - `content` (truncated if needed)
  - `truncated: boolean`

### Tool: repo.listDir

- Input:
  - `path: string`
  - `maxEntries?: number` default 2000
- Output:
  - entries with:
    - name
    - type (file|dir)
    - sizeBytes? (for files only, best effort)

### Tool: docs.fetch

- Input:
  - `url: string`
  - `maxBytes?: number`
- Output:
  - `url`
  - `status`
  - `contentType`
  - `text` (best-effort text extraction, minimal)
  - `truncated`

Security constraints:

- `docs.fetch` must enforce allowlisted domains configured in Codex ToolLoop config.
- If not allowlisted, return an error that explains the block.

## Configuration

Define a config file format in `packages/codex-toolloop` (actual parsing implemented later) that contains:

- MCP servers:
  - name
  - url
  - enabled
  - enabled_tools / disabled_tools
  - auth tokens (by env var reference only)
- Allowlisted doc domains

For this spec:

- implement config types and a sample config file under `apps/cli` or root `codex-toolloop.config.json` (choose one and be consistent).

## API design

In `packages/mcp/src` implement:

1. `ToolDefinition`

- name
- description
- inputSchema (Zod)
- outputSchema (Zod)
- handler(ctx, input) -> output

1. `McpServer`

- ability to register tools
- serve tools over HTTP MCP

1. `McpClientManager`

- connect to servers from config
- list tools per server
- call tool
- enforce timeouts

1. `ToolRegistry`

- merges tools
- enforces allowlist/denylist
- provides:
  - `getTool(name)`
  - `listTools()`
  - `toCodexMcpServersConfig()` for Codex backends

## Testing

Add integration tests that:

- start the first-party MCP server on a random port
- connect with the client manager
- list tools
- call `repo.listDir` and `repo.readFile` against a temporary fixture directory

Use `packages/testkit` to create temp directories and fixtures.

## Acceptance criteria

1. `codex-toolloop mcp start` (to be added in CLI later) can start the server and it responds.
2. Client manager can list tools and call them.
3. Tool registry enforces allowlist/denylist.
4. Tests pass.

## Deliverables

- New code under `packages/mcp/src/*`
- Tests under `tests/` or package-level tests, but keep consistent
