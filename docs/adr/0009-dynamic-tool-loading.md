# ADR 0009: Dynamic tool loading and MCP server routing (minimize context bloat)

## Status

Accepted (2026-01-20)

## Context

As the tool ecosystem grows, two constraints dominate real-world reliability:

1. **Context window pressure**
   - MCP servers often expose many tools. Including every tool definition in every model call inflates prompts and reduces quality.

2. **Tool selection quality**
   - The more tools the model sees at once, the more likely it is to choose a suboptimal tool or hallucinate arguments.

AI SDK v6 provides primitives that enable a dynamic approach:

- Agent / step-level call option configuration (e.g., controlling tools per step)
- `dynamicTool()` for tools whose I/O is not known statically
- `createMCPClient()` to fetch MCP tool sets on demand

## Decision

We will implement **dynamic tool loading** as the default behavior for all AI-powered workflows.

### 1. Tool bundles

Tools are grouped into **bundles**. A bundle is a small, purpose-driven tool set.

Examples:

- `repo.readonly` (repo.readFile, repo.listDir, repo.ripgrep)
- `docs.fetch` (docs.fetch, docs.search)
- `workspace.exec` (shell.run with strict allowlist)
- `thirdparty.github` (selected GitHub tools only)

Bundles may be backed by:

- a first-party MCP server
- a third-party MCP server
- a small number of local (non-MCP) tools, when explicitly allowed

### 2. Routing (select bundles before exposing tools)

Before any step that enables tool calling, we run a **tool routing** phase that selects which bundles are needed.

Routing inputs:

- workflow name
- agent role (planner / researcher / implementer / reviewer)
- current step
- user intent (goal + constraints)
- policy (allowlist/denylist, trust level)

Routing outputs:

- ordered list of bundle IDs
- optional justification / evidence

Routing strategies (implementation detail):

- **Deterministic default mapping** (fast path)
- **Model-based router** (structured output) for ambiguous tasks

### 3. Per-step toolset expansion (AI SDK prepareStep)

Tool sets can change between steps:

- Step 1: minimal tools (or none)
- Step 2: add repo tools
- Step 3: add docs tools
- Step 4: add build/test tools

We will prefer the AI SDK's per-step tool configuration hooks (agent-level `prepareStep`, or equivalent call-option configuration) to minimize tool exposure.

### 4. Large-toolset mode: MCP meta-tools via dynamicTool

For MCP servers that expose a large number of tools (or untrusted, fast-changing tool definitions), we avoid injecting all tool definitions by using **meta-tools**:

- `mcp.listTools(serverId)` → returns tool names and brief descriptions
- `mcp.getToolSchema(serverId, toolName)` → returns JSON Schema for a single tool
- `mcp.callTool(serverId, toolName, input)` → executes the tool (implemented as `dynamicTool()`)

This keeps the **tool list in the prompt tiny**, while still allowing access to the full ecosystem through a discovery + execute loop.

**Media result handling:** `mcp.callTool` results may include non-text media (images, audio, binary files) that, if serialized as base64 JSON blobs, inflate token usage and degrade model performance. To mitigate this:

- Wrap all `mcp.callTool` invocations with a media-conversion layer (e.g., using community utilities like `fixMCPTools` that leverage `toModelOutput`).
- Detect binary/image/audio results and convert them to proper AI SDK multimodal content types (`image-data`, `file-data`, etc.) instead of inline base64.
- Return lightweight references (URIs, artifact paths, or metadata objects with MIME type and SHA-256 hash) instead of full base64 payloads.
- Implement the converter at the `dynamicTool()` boundary so all MCP tool calls are normalized in one place.
- Record all converted outputs to observability logs: append converted metadata, artifact URIs, and hashes to `tool-calls.jsonl` (per ADR 0007) to preserve debugging and traceability until the upstream AI SDK media-serialization bug is fixed.

### 4.1 MCP transport choices

The MCP transport choice directly affects CPU usage, latency, connection pooling, and observability. Transport selection must be explicit in `createMCPClient()` configuration.

#### Recommended default: HTTP/Streamable HTTP

- Use HTTP or Streamable HTTP as the default transport for all production deployments.
- Benefits: low CPU overhead, supports both local and remote MCP servers, superior connection lifecycle management, graceful error recovery.
- Suitable for all deployment contexts (local, containerized, cloud).

#### Stdio (local development only)

- Stdio transport is acceptable for local development workflows only.
- **Production prohibition:** do not use stdio in production. Stdio spawns a child process for each `createMCPClient()` call and requires manual process cleanup; it does not support remote servers and increases resource overhead.

#### SSE (legacy, not recommended)

- Server-Sent Events (SSE) is a legacy transport and is inefficient for production use.
- Drawback: maintains persistent connections indefinitely, preventing connection reuse and increasing memory footprint.

#### Transport implications for caching, connection pooling, and cleanup

The choice of transport affects:

- **Connection pooling:** HTTP/Streamable HTTP enable connection reuse; stdio does not support pooling.
- **Cache TTLs:** Schema and tool-list caches (per ADR 0009 § 5) have shorter TTLs for stdio (local servers may restart without notice) and longer TTLs for HTTP (stable remote endpoints).
- **Client lifecycle:** Always close MCP clients when a run ends. For HTTP, this releases connection handles; for stdio, this terminates the spawned process. Connection cleanup is critical to prevent resource exhaustion on long-running CI systems.

### 5. Caching

- Cache tool lists and schemas per server (TTL-based; see § 4.1 for transport-dependent TTL guidance).
- Cache tool bundle resolution for a run.
- Always close MCP clients when a run ends (critical for resource cleanup: HTTP connections are released, stdio processes are terminated).

### 6. Stability for production: vendored wrappers

When a server is used frequently or is security-sensitive, we vend (generate) stable wrappers:

- Use `mcp-to-ai-sdk` to generate AI SDK wrappers from MCP tools.
- Commit the generated wrappers and review them like normal code.

This reduces drift and prevents the model from being exposed to unreviewed tool descriptions.

## Alternatives considered

1. **Always load all tools from all servers**

   - Pros: simplest
   - Cons: context bloat, weaker tool selection, higher latency

2. **Only static tool generation (no dynamic discovery)**

   - Pros: stable, reviewable
   - Cons: loses the primary benefit of MCP (interoperability); slower iteration

3. **Provider-only tool search**

   - Pros: minimal prompt overhead when supported
   - Cons: provider-specific and not universally available

## Consequences

- The system adds an explicit routing layer, but gains:
  - bounded prompts
  - better tool selection
  - better security posture
- Tool usage becomes more observable: routing decisions are logged and auditable.

## Implementation notes

- Bundle definitions live in config (see SPEC 011).
- Routing output is a first-class artifact (logged to run directory).
- Tool schema and tool results are treated as untrusted input; apply the security posture in ADR 0008.

## References

AI SDK references:

- Dynamic tools: <https://ai-sdk.dev/docs/reference/ai-sdk-core/dynamic-tool>
- `dynamicTool()` reference: <https://ai-sdk.dev/docs/reference/ai-sdk-core/dynamic-tool#dynamictool>
- `createMCPClient()` reference: <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client>
- MCP tools overview: <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- Tool calling: <https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling>

Stability and safety:

- mcp-to-ai-sdk blog: <https://vercel.com/blog/mcp-to-ai-sdk>
- mcp-to-ai-sdk (repo): <https://github.com/vercel-labs/mcp-to-ai-sdk>
- MCP tools (name constraints, schemas): <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
- MCP security best practices: <https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices>

Provider-specific minimization (optional):

- Anthropic provider tool search: <https://ai-sdk.dev/providers/ai-sdk-providers/anthropic>
