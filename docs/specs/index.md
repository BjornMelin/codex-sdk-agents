# System Specifications (SPEC)

This directory contains the implementation specifications for the project. These specs define the detailed requirements and technical instructions for building each component of the system.

## Index

| ID | Title |
| :--- | :--- |
| 000 | [Bootstrap the Codex ToolLoop monorepo (Bun + TS strict + Zod v4.3.5 + Vitest)](000-bootstrap-monorepo.md) |
| 010 | [MCP platform (first-party MCP servers + client manager + dynamic tool registry)](010-mcp-platform.md) |
| 020 | [Codex backends (AI SDK app-server default + exec JSONL + optional TS SDK)](020-codex-backends.md) |
| 030 | [Agent runtime and workflow engine (multi-agent, typed handoffs, context packs)](030-agent-runtime.md) |
| 040 | [Codex ToolLoop CLI (commands, streaming UX, sessions, run artifacts)](040-cli.md) |
| 050 | [Memory, context packs, and cross-run knowledge](050-memory-context.md) |
| 060 | [(Optional): Local Next.js UI for monitoring runs and browsing artifacts](060-optional-next-ui.md) |

---

*Specs are typically implemented in order, with each step building upon the foundations laid by the previous one.*
