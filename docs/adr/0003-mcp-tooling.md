# ADR 0003: MCP as the single tool substrate for both Codex and Codex ToolLoop

## Status

Accepted

## Context

Requirements emphasize:

- Tool calling is critical.
- Dynamic tooling and dynamic tool sets.
- Ability to add custom tools and MCP servers.

Important constraint:

- Codex CLI provider does not support passing AI SDK custom tools directly.
Therefore, custom tool calling must be done via Codex-native mechanisms.

Codex supports MCP servers and can call MCP tools directly, and Codex ToolLoop can also connect to MCP servers.

## Decision

- All custom tools will be implemented and exposed via MCP servers.
- Codex ToolLoop will include:
  - a first-party MCP server suite (repo, docs, workflow utilities)
  - an MCP registry and configuration system
  - per-workflow and per-role tool allowlists
- Codex ToolLoop will prefer MCP over HTTP (streamable HTTP) as the default transport.

## Alternatives considered

1. AI SDK tools (Zod tool definitions) as primary

- Pros: easy tool definition for many model providers
- Cons: cannot be used by Codex CLI provider directly; breaks the core constraint

1. Custom RPC layer (non-MCP)

- Pros: total control
- Cons: loses interoperability and tool ecosystem

1. Mix: some tools in MCP, some in AI SDK tools

- Pros: flexibility
- Cons: tool duplication and drift

## Consequences

- Tool definitions must map cleanly to JSON Schema input parameters (MCP).
- Codex ToolLoop’s internal tool calls can reuse the same MCP implementations.
- Tool ecosystem can grow by adding third-party MCP servers.

## Implementation notes

- Define tools with Zod v4 schemas.
- Convert Zod schemas to JSON Schema using `z.toJSONSchema()` for MCP tool parameter schemas.
- Maintain a “tool manifest” that:
  - names tools
  - describes trust level
  - default allowlist membership
  - per-role recommended tools

## Security notes

- Codex ToolLoop must treat MCP servers as trusted only when explicitly configured.
- Provide:
  - a server trust registry
  - allowlist/denylist enforcement
  - optional network restrictions for first-party servers

## References (informational)

- Codex MCP supports stdio and streamable HTTP servers, and tool allow/deny lists.
- AI SDK MCP client recommends HTTP transport for production and supports stdio only for local.
