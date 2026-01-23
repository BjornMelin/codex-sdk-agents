# System Specifications (SPEC)

This directory contains the implementation specifications for the project. These specs define the detailed requirements and technical instructions for building each component of the system.

## Index

| ID | Title |
| :--- | :--- |
| 000 | [Bootstrap the Codex ToolLoop monorepo (Node v24 LTS + pnpm + TS strict + Zod v4.3.6 + Vitest)](000-bootstrap-monorepo.md) |
| 010 | [MCP platform (first-party MCP servers + client manager + dynamic tool registry)](010-mcp-platform.md) |
| 011 | [Dynamic tool loading (dynamicTool + on-demand MCP server tooling)](011-dynamic-tool-loading.md) |
| 020 | [Codex backends (app-server JSONL + exec JSONL + optional TS SDK)](020-codex-backends.md) |
| 021 | [SDK backend option fidelity](021-sdk-backend-option-fidelity.md) |
| 022 | [Codex app-server protocol schemas and upgrade workflow](022-codex-app-server-schemas.md) |
| 023 | [Codex app-server protocol types and upgrade workflow (TS-only artifacts)](023-codex-app-server-protocol.md) |
| 024 | [Codex app-server v2 endpoint coverage](024-codex-app-server-endpoints.md) |
| 025 | [Codex collaboration modes and collab tool calls](025-codex-collaboration.md) |
| 026 | [Codex approvals, execpolicy, and permissions UI](026-codex-approvals-permissions.md) |
| 027 | [Codex skills discovery, configuration, and invocation](027-codex-skills.md) |
| 028 | [Codex config layering, cwd resolution, and requirements](028-codex-config-layering.md) |
| 029 | [AI SDK UI message stream contract](029-ai-sdk-ui-stream-contract.md) |
| 030 | [Agent runtime and workflow engine (multi-agent, typed handoffs, context packs)](030-agent-runtime.md) |
| 040 | [Codex ToolLoop CLI (commands, streaming UX, sessions, run artifacts)](040-cli.md) |
| 050 | [Memory, context packs, and cross-run knowledge](050-memory-context.md) |
| 060 | [(Optional): Local Next.js UI for monitoring runs and browsing artifacts](060-optional-next-ui.md) |
| 070 | [Security, Code Quality, and Maintenance Infrastructure](070-security-and-maintenance.md) |
| 080 | [Turborepo monorepo configuration (Vercel-ready)](080-turborepo-monorepo.md) |

---

*Specs are typically implemented in order, with each step building upon the foundations laid by the previous one.*
