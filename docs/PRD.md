# codex-toolloop

Product Requirements Document (PRD)

## 1) Product overview

AI Codex Agents is a local-first, Node.js-powered TypeScript system for building and running reusable, autonomous coding-agent workflows using OpenAI Codex (via your existing Codex CLI ChatGPT login) as the primary “engineering model.”

AI Codex Agents provides:

- Multi-agent orchestration (planner, researcher, implementer, reviewer) for end-to-end feature development.
- Dynamic tools and dynamic tool sets via MCP servers (both first-party and third-party).
- Codex-backed execution with safety controls (approvals, sandbox policies, allowlisted tools).
- High-fidelity event capture (JSONL) and run artifacts for debugging, auditing, and replays.
- A stable specification workflow: you feed a SPEC to Codex (gpt-5.2-high in your TUI) to implement code, then AI Codex Agents runs verification and reviews automatically.

This is designed for local CLI usage first, with an optional lightweight local Next.js UI later.

## 2) Target users and personas

Primary persona: “Power-user engineer using Codex daily”

- Heavy Codex CLI/TUI usage.
- Wants scalable workflows (feature dev, refactor, audit) with subagents and tool ecosystems.
- Cares about tool calling quality, approvals, and visibility into what happened.

Secondary persona: “Team engineer / reviewer”

- Wants deterministic review workflows, policy checks, and audit logs.
- Wants reproducibility and “what changed and why” at the end of runs.

## 3) Goals and non-goals

### Goals

1. Build a modular “agent runtime” that can:
   - Plan, research, implement, test, and review code changes autonomously.
   - Use dynamic tool sets delivered through MCP servers.
   - Perform deep code reviews and documentation gap analysis.

2. Use your existing Codex authentication:
   - Primary backend uses Codex CLI ChatGPT subscription login.
   - Support switching to API-key auth only if you explicitly choose.

3. Provide best-in-class local DX:
   - Node.js v24 LTS runtime for CLI and servers (required for AI SDK MCP STDIO support).
   - pnpm workspaces for package management (Corepack-enabled).
   - Type-safe Zod v4.3.6 schemas across tool inputs/outputs and structured outputs.
   - Vitest test setup for unit, integration, and type-level tests.

4. Provide end-to-end observability:
   - Run directory with artifacts, JSONL events, tool call records, diffs, and final summaries.
   - Deterministic “final report” output per run.

### Non-goals (for MVP)

- Cloud deployment / SaaS / multi-tenant hosting.
- Automatic GitHub PR creation (can be added later).
- Long-running background cloud agents.
- Perfect parity with Codex internal UI features (we integrate, not re-implement).

## 4) Key decisions (summary)

Codex ToolLoop will use a “two-layer” approach:

Layer A: Orchestration + UX

- Vercel AI SDK v6 for streaming, provider interoperability, and future UI integration.
- Codex App Server provider as the primary model backend because it supports persistent threads and mid-execution injection.

Layer B: Tool substrate (single source of truth)

- MCP servers are the only supported mechanism for custom tools used by Codex.
- Codex ToolLoop itself also connects to MCP servers for discovery and direct calling.

Complementary execution modes

- `codex exec --json` for full event streams and for piping in scripts.
- `codex exec --output-schema` for strict structured outputs.
- `@openai/codex-sdk` for programmatic thread control when needed.

## 5) Primary use cases

### UC1: Fully autonomous feature development (multi-agent)

Input:

- Feature brief (one paragraph to one page).
- Optional constraints (framework, coding standards, performance constraints).

Workflow:

1. Planner produces an execution plan with file-level intent.
2. Researcher gathers repository context and relevant external docs (through MCP tools).
3. Implementer applies changes, runs tests, iterates.
4. Reviewer performs deep audit and documentation gap analysis, produces final report.

Output:

- Code changes in working tree.
- Run report containing plan, actions taken, test results, and review findings.
- Optional structured outputs (JSON) for integration into other scripts.

### UC2: Code review and audit against official docs

Input:

- Target scope: PR diff, a directory, or a set of modules.
- Rules: “must match official docs,” “no deprecated APIs,” “security posture check.”

Output:

- Structured audit report with findings, severity, references, and suggested fixes.
- Optional auto-fix branch (local) with patch set.

### UC3: Reusable orchestrations and subagents

Input:

- Workflow definition (YAML/TS).
- Tool set definition (MCP servers + enabled tools).
- Memory policy (what is persisted and how).

Output:

- A repeatable, parameterized workflow runnable as:
  - `codex-toolloop run workflow <name> --args ...`
  - `codex-toolloop run spec specs/<id>.md`

### UC4: Dynamic tooling

- Add/remove MCP servers at runtime based on task.
- Tool allowlist per workflow and per agent role.
- Support both:
  - “shared tool substrate” (same servers for all agents)
  - “role-specific tool substrate” (researcher has docs tools; implementer has repo and build tools)

## 6) Functional requirements

### FR1: CLI interface

- Commands:
  - `codex-toolloop doctor` (verify environment: node, pnpm, codex CLI, auth, MCP connectivity)
  - `codex-toolloop mcp start` (start first-party MCP servers)
  - `codex-toolloop run spec <path>` (execute a SPEC-driven run)
  - `codex-toolloop run workflow <name>` (execute a named workflow)
  - `codex-toolloop session list|resume|inspect` (manage Codex thread IDs and Codex ToolLoop run IDs)
  - `codex-toolloop review` (run review-only workflow on current repo state)
- Streaming output:
  - Live token stream (assistant text).
  - Live “events” stream (tool execution, file changes, commands).
  - End-of-run summary.

### FR2: Agent runtime

- Must support:
  - Multiple agents with distinct system instructions and constraints.
  - Handoffs: structured outputs from one agent feed into another.
  - Interrupt and inject: ability to send new instructions mid-run (when using app-server provider).
  - Cancellation: stop a run and persist partial artifacts.

### FR3: Tool substrate via MCP

- Support connecting to:
  - Local/remote streamable HTTP MCP servers (default path).
  - Local stdio MCP servers (optional, local-only; may require Node).
- AI SDK MCP integration:
  - Use `createMCPClient()` (`@ai-sdk/mcp`) to connect and convert MCP tools into AI SDK tool sets.
  - Use `dynamicTool()` for meta-tools and dynamic tool catalogs.
- Dynamic tool loading (context bloat control):
  - Group tools into bundles and load on-demand per workflow/role/step.
  - Avoid injecting all tool schemas into every model call.
  - Provide a meta-tool surface for huge catalogs (list tools → fetch schema → call tool).
- Security posture:
  - Never connect to MCP servers unless explicitly configured.
  - Provide a “trust registry” to mark servers as trusted/untrusted.
  - Enforce allowlist/denylist per workflow and role.
  - Separate “tool discovery” from “tool execution” where possible.

### FR4: Codex integration modes

Codex ToolLoop must support these execution modes:

Mode A: AI SDK Codex App Server Provider (default)

- Persistent threads.
- Tool streaming and mid-execution injection.
- Used for interactive multi-step runs.

Mode B: Codex SDK (TS)

- Use for programmatic integration when Codex ToolLoop needs direct thread control.
- Use `outputSchema` for strict final responses when helpful.

Mode C: Codex Exec (CLI)

- Use `--json` for event streaming and detailed logs.
- Use `--output-schema` for structured output when piping or scripting.

### FR5: Memory and context management

- Store run artifacts locally:
  - Prompts/specs
  - Plans and intermediate outputs
  - Tool logs and command outputs (with truncation policy)
  - Diffs and file change summaries
  - Final report
- Provide “context packs”:
  - A deterministic, bounded representation of repo state and run state.
  - Used for handoffs and resumptions.

### FR6: Testing

- Vitest configured with:
  - Unit tests (pure TS).
  - Integration tests (mocked Codex backends; mocked MCP).
  - Type-level tests using `expectTypeOf`.
- Provide fixtures:
  - Tiny demo repos for safe tests.
  - Recorded event logs (goldens).

## 7) Non-functional requirements

- Local-first: no deployment required.
- Observability:
  - Every run has a run directory with JSONL event logs.
  - Provide stable “final report” formatting.
- Reliability:
  - Runs should fail fast on missing prerequisites.
  - Robust subprocess handling (timeouts, cancellation, partial artifacts).
- Security:
  - Default to safe Codex sandbox and approvals.
  - Never store secrets in run artifacts by default.
- Performance:
  - Avoid scanning entire repo repeatedly.
  - Cache repo indexes.
  - Use bounded log sizes and summaries.

## 8) Success metrics

- Time-to-first-run: from clone to `codex-toolloop doctor` passing in under 10 minutes (on a typical dev machine).
- Feature workflow success rate: > 70% “no human edits required” for well-scoped tasks in a mature repo.
- Review workflow quality:
  - Captures real issues and cites evidence (paths, symbols, logs).
  - Low false positives in repeated runs.

## 9) Risks and mitigations

Risk: Node.js version drift across team machines / CI.

- Mitigation:
  - Pin Node.js v24 LTS via `.nvmrc` and `package.json#engines`.
  - Require `codex-toolloop doctor` to pass before running workflows.

Risk: Tool security (MCP servers can exfiltrate data).

- Mitigation:
  - Explicit config required.
  - Server trust registry.
  - Default to local-first servers.
  - Tool allowlists and per-run tool constraints.

Risk: Overusing Codex context and hitting usage limits.

- Mitigation:
  - Context packs and compaction.
  - Smaller agent roles with bounded scopes.
  - Prefer structured reports and summaries at boundaries.

## 10) Phased delivery plan

### Phase 0: Bootstrap

- Repo scaffolding with pnpm workspaces, strict TS, Zod v4.3.6.
- Environment doctor.
- Minimal MCP server + client manager.
- Minimal Codex backend (exec mode).

### Phase 1: Default backend + event logs

- AI SDK Codex App Server backend.
- Run directories and JSONL logs.
- Basic single-agent workflows.

### Phase 2: Multi-agent workflows

- Planner, Researcher, Implementer, Reviewer.
- Handoff schema and context packs.
- Role-based MCP tool sets.

### Phase 3: Memory and review depth

- Persistent run memory, retrieval context packs.
- Deep audit and docs gap analysis workflows.

### Phase 4: Optional local UI

- Next.js UI for monitoring runs and browsing artifacts.

## 11) Appendix: scoring summary (condensed)

Options considered:

- O1: AI SDK v6 + Codex CLI provider (exec-based)
- O2: AI SDK v6 + Codex App Server provider (app-server)
- O3: Codex TypeScript SDK direct (no AI SDK)
- O4: Codex exec direct (no AI SDK)
- O5: AI SDK v6 + OpenAI provider (API key) + AI SDK tools

Key constraints:

- Must use ChatGPT Codex subscription auth for primary work.
- Tool calling must be extensible and dynamic.

Score scale: 1 (poor) to 10 (excellent). Weights in ADRs.

| Use case | Best option | Why |
| --- | --- | --- |
| Multi-step autonomous feature dev | O2 | Persistent threads + injection + tool streaming |
| Scriptable automation with structured output | O4 | Simple, stable, JSONL + output-schema |
| Deep integration into custom TS app | O2 + O3 | O2 for orchestration, O3 for programmatic controls |
| Custom tools and dynamic tools | O2 + MCP | MCP is the shared tool substrate for Codex |
| Cheapest path without API key usage | O2 | Uses ChatGPT subscription via Codex CLI login |

Overall recommendation:

- Default to O2, add O4 and O3 as complementary modes, and use MCP as the tool substrate across all modes.
