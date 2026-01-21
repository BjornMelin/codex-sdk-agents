# ADR 0001: Node.js v24 LTS runtime + pnpm workspaces

Status: **Accepted**

## Context

Codex ToolLoop integrates:

- Vercel AI SDK v6 MCP client (`createMCPClient()`) and dynamic tooling (`dynamicTool()`)
- Local and remote MCP servers
- OpenAI Codex CLI and Codex app-server provider

To provide **first-class MCP STDIO support**, the system must support the AI SDK's
`Experimental_StdioMCPTransport`. The official API reference describes this as a Node.js STDIO transport
for MCP servers (spawns a child process and communicates over stdin/stdout). (See: <https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-stdio-transport>.)

Because STDIO MCP requires Node's process APIs, the repo standardizes on:

- **Node.js v24 LTS** for runtime compatibility and long-term support.
- **pnpm** for workspace/package management.

Node 24 is currently in **Active LTS** status per Node.js' official release lifecycle listing. See:
<https://nodejs.org/en/about/previous-releases>.

## Decision

1. **Runtime:** Node.js **v24 LTS** (v24.x).
2. **Package manager:** pnpm (via Corepack), pinned via the root `packageManager` field.
3. **Workspace definition:** `pnpm-workspace.yaml` defines the monorepo packages.
4. **Supply-chain default (pnpm v10):** dependency lifecycle scripts are blocked by default; we maintain a
   minimal allowlist using `allowBuilds` in `pnpm-workspace.yaml`.

## Consequences

- All developer commands are run via `pnpm` scripts (root `package.json`).
- `codex-toolloop doctor` validates:
  - Node is installed and **>= 24**
  - pnpm is installed
  - the `codex` CLI is available
- MCP STDIO servers are now a first-class supported transport for local development.
- Production deployments should prefer **HTTP/SSE MCP servers** (see ADR 0003) because STDIO requires
  spawning a local process.

## References

- Node.js release lifecycle / LTS status: <https://nodejs.org/en/about/previous-releases>
- Node v24 transition announcement (LTS): <https://nodejs.org/en/blog/release/v24.11.0>
- pnpm installation (Corepack): <https://pnpm.io/installation>
- pnpm supply-chain security defaults (v10): <https://pnpm.io/supply-chain-security>
- pnpm `allowBuilds` release note (v10.26): <https://pnpm.io/blog/releases/10.26>
- AI SDK MCP stdio transport reference: <https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-stdio-transport>
