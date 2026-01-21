# SPEC 011: Dynamic tool loading (bundle routing + direct/meta exposure)

Status: **Completed** ✅

## Problem

Tool catalogs can be large. Injecting every tool schema into every model call causes:

- context bloat (token waste)
- degraded tool selection accuracy (distractors)
- slower inference and higher cost

We need to:

- route **only** the tools needed for a given workflow step
- support large tool catalogs without prompt injection risk (meta-tool mode)
- preserve auditability and determinism (same step → same bundle IDs → same tool surface)

## Goals

1. Define and implement tool **bundles** (small, purpose-driven tool sets).
2. Implement deterministic **routing** from `(workflowId, roleId, stepId)` → `bundleIds`.
3. Implement **dynamic MCP loading**:
   - connect to MCP servers only when bundles referencing them are selected
4. Provide a stable interface for runtimes:
   - `resolveTools(bundleIds)` → AI SDK `ToolSet`
   - meta-tool surface: `mcp.listTools`, `mcp.getToolSchema`, `mcp.callTool`
5. Enforce trust boundaries:
   - untrusted servers require explicit allowlists
   - untrusted servers are meta-only (no direct injection of tool definitions)

## References

- AI SDK tool calling guide: <https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling>
- AI SDK MCP tools overview: <https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools>
- AI SDK `dynamicTool`: <https://ai-sdk.dev/docs/reference/ai-sdk-core/dynamic-tool>
- AI SDK `createMCPClient`: <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client>
- MCP tools (name constraints, schemas): <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
- MCP security best practices: <https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices>

## Bundle model

Bundles are defined in the MCP config (SPEC 010):

- `mode: "direct"`
  - tools are fetched from the MCP server
  - tools are filtered by allow/deny lists
  - tools are namespaced as `<serverId>.<toolName>` to avoid collisions
- `mode: "meta"`
  - do **not** inject tool schemas
  - instead inject a tiny, auditable meta surface:
    - `mcp.listTools({ serverId, offset?, limit? })`
    - `mcp.getToolSchema({ serverId, toolName })`
    - `mcp.callTool({ serverId, toolName, args })` (implemented via `dynamicTool`)

## Routing

Routing table ownership: `packages/workflows`.

- `ToolRoutingTable`: nested record
  - `workflowId` → `roleId` → `stepId` → `bundleIds[]`
- `resolveToolBundlesForStep(table, address)`:
  - deny-by-default (missing mapping → `[]`)
- `ToolRouter`:
  - merges runtime overrides (optional)
  - caches resolved bundle lists per step address

Runtimes can pass the resolved bundle IDs into MCP tool resolution.

## Tool resolution

Ownership: `packages/mcp`.

### `DynamicToolRegistry`

- `resolveTools(bundleIds)`:
  - lazy-loads MCP clients and tool catalogs as needed
  - merges namespaced tool sets for direct bundles
  - injects meta tools for any meta bundles
- `close()`:
  - deterministically closes all MCP clients via `McpClientManager.closeAll()`

### `McpStepTools`

A small adapter that joins a step router to the tool registry:

- `resolveToolsForStep({ workflowId, roleId, stepId })`:
  - resolves `bundleIds` via an injected resolver
  - resolves `tools` via `DynamicToolRegistry.resolveTools(bundleIds)`
  - returns `{ tools, bundleIds, servers }` for auditing and artifacts
- `close()`:
  - closes the underlying registry / clients

## Trust and security

This SPEC implements the v1 posture defined by ADR 0008:

- **untrusted servers are meta-only**:
  - direct bundles referencing untrusted servers are rejected at resolution time
- **untrusted servers require explicit allowTools**:
  - no “allow all” exposure for untrusted servers
- meta-tool policy merging is **restrictive**:
  - `allowTools`: intersection across selected bundles for the same server
  - `denyTools`: union across bundles

Additional safety bounds (meta tools):

- result size limits for schemas and tool outputs
- a default tool-call timeout using `AbortSignal` (best-effort)

## Testing

Vitest coverage (v1):

- routing correctness and deny-by-default behavior
- direct bundle resolution and namespacing
- meta bundle injection and `mcp.callTool` execution
- trust enforcement for untrusted servers
- deterministic cleanup via `DynamicToolRegistry.close()` / `McpClientManager.closeAll()`

## Implementation

Key modules:

- `packages/workflows/src/tool-routing.ts`
- `packages/mcp/src/registry/dynamic-tool-registry.ts`
- `packages/mcp/src/meta-tools.ts`
- `packages/mcp/src/step-tools.ts`
- tests in `tests/unit/*`

## Verification

Run in repo root:

1. `pnpm install`
2. `pnpm -s check`
3. `pnpm -s build`
