# ADR 0008: Layered safety controls (Codex approvals + sandbox + tool allowlists)

## Status

Accepted (updated 2026-01-20)

## Context

Codex ToolLoop executes code-modifying workflows with access to:

- repo contents
- local filesystem (optionally)
- networked documentation (optionally)
- external tools via MCP servers

This introduces material security risks:

- command execution and file modification
- data exfiltration via tools
- prompt injection via tool descriptions and tool outputs

## Decision

Codex ToolLoop uses layered controls:

1. **Codex sandbox policy**
   - `read-only` | `workspace-write` | `danger-full-access`

2. **Codex approval policy**
   - `untrusted` | `on-request` | `on-failure` | `never`

3. **Tool substrate policy (MCP)**
   - never connect to MCP servers unless explicitly configured
   - per-workflow and per-role tool allowlist/denylist
   - server trust registry (trusted/untrusted)

4. **ToolLoop-side guardrails**
   - block unsafe commands by default
   - redact secrets from artifacts
   - enforce allowlisted domains for network fetching tools

## MCP-specific threat model additions

### 1) Tool-definition prompt injection

MCP tool definitions include names and descriptions that are provided by the server. In many tool-calling systems these strings become part of the model's effective prompt. A malicious or compromised MCP server can:

- instruct the model to ignore system constraints
- request secrets or exfiltrate data
- bias tool selection toward unsafe tools

### 2) Tool-output prompt injection

Tool outputs are untrusted. A malicious tool can return text that attempts to override the agent's policy.

### 3) Dynamic tool discovery drift

If the runtime dynamically fetches tool definitions at execution time, a server can change definitions between runs (or even between steps), which reduces reproducibility and makes audits harder.

## Mitigations and requirements

1. **Trust registry + allowlists are mandatory**
   - servers must be explicitly configured and tagged as trusted/untrusted
   - untrusted servers are never enabled by default
   - v1 enforcement: untrusted servers are **meta-only** (no direct tool-definition injection) and require explicit `allowTools`

2. **Prefer minimal tool exposure (dynamic tool loading)**
   - do not inject large tool catalogs into every model call
   - only load tool definitions for the bundles needed for the current role/step
   - for large catalogs, use MCP meta-tools (ADR 0009) so the prompt only contains a tiny, auditable tool surface

3. **Vendored wrappers for high-risk / high-value tools**
   - use `mcp-to-ai-sdk` to generate reviewed, stable wrappers for frequently-used servers
   - commit generated wrappers and review changes like normal code

4. **Constrain tool outputs**
   - use output truncation policies and token budgeting
   - prefer structured tool outputs where possible; keep raw text minimal

5. **Dependency safety**
   - if we use the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`) for servers or transports, pin to a version that includes security fixes and track upstream advisories.

## Consequences

- Higher upfront configuration cost (trust + allowlists), but predictable and auditable behavior.
- Better safety posture in exchange for explicit policy enforcement.

## References

- ADR 0003: <./0003-mcp-tooling.md>
- ADR 0009: <./0009-dynamic-tool-loading.md>
- AI SDK MCP tools: <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- mcp-to-ai-sdk blog: <https://vercel.com/blog/mcp-to-ai-sdk>
- mcp-to-ai-sdk repo: <https://github.com/vercel-labs/mcp-to-ai-sdk>
- MCP specification (2025-11-25): <https://modelcontextprotocol.io/specification/2025-11-25/>
- MCP security best practices: <https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices>
- MCP authorization: <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>

## Amendments

- 2026-01-21: Clarified v1 enforcement for untrusted MCP servers (meta-only + allowlist required) to match SPEC 011 implementation.
