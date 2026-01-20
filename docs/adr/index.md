# Architecture Decision Records (ADR)

This directory contains records of significant architecture decisions made for the project. Each ADR describes the context, the decision, and its consequences.

## Index

| ID | Title | Status |
| :--- | :--- | :--- |
| 0001 | [Bun as primary runtime with Node compatibility fallback](0001-runtime-bun.md) | Accepted |
| 0002 | [Multi-backend Codex integration (AI SDK app-server default)](0002-model-backends.md) | Accepted |
| 0003 | [MCP as the single tool substrate for both Codex and Codex ToolLoop](0003-mcp-tooling.md) | Accepted |
| 0004 | [Multi-agent workflow engine with role-based steps and typed handoffs](0004-multi-agent-orchestration.md) | Accepted |
| 0005 | [Local-first artifacts + context packs + optional retrieval memory](0005-memory-context.md) | Accepted |
| 0006 | [Vitest standardization with Node execution invoked from Bun](0006-testing-vitest.md) | Accepted |
| 0007 | [JSONL-first observability with normalized events](0007-observability.md) | Accepted |
| 0008 | [Layered safety controls (Codex approvals + sandbox + tool allowlists)](0008-security.md) | Accepted |

---

*For more information on the ADR process, see [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).*
