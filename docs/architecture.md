# Codex ToolLoop CLI Architecture

## 1. System diagram (high level)

Codex ToolLoop CLI is a local system composed of:

- A Bun-based CLI runner (apps/cli)
- A core runtime package (packages/codex-toolloop)
- MCP tool platform (packages/mcp)
- Codex backends (packages/codex)
- Workflows (packages/workflows)
- Optional UI (apps/ui)

ASCII diagram:

```text
+------------------------------+
| apps/cli (Bun)               |
|  - command parsing           |
|  - streaming UX              |
|  - run directory mgmt        |
+--------------+---------------+
               |
               v
+------------------------------+        +---------------------------+
| packages/codex-toolloop              |        | packages/mcp              |
|  - AgentRuntime              |<------>|  - MCP Client Manager     |
|  - Workflow Engine           |        |  - First-party MCP servers|
|  - Context Packs             |        |  - Tool registry          |
|  - Artifact Logger (JSONL)   |        +---------------------------+
+--------------+---------------+
               |
               v
+------------------------------+
| packages/codex               |
|  - Backend: AI SDK app-server|
|  - Backend: codex exec JSONL |
|  - Backend: @openai/codex-sdk|
+--------------+---------------+
               |
               v
+------------------------------+
| External: Codex CLI + Auth   |
|  - ChatGPT subscription login|
|  - MCP servers               |
|  - sandbox + approvals       |
+------------------------------+
```

## 2. Core concepts and data model

### Run

A Run is the top-level execution instance.

- runId: unique ID
- workspaceRoot: repo directory
- createdAt, finishedAt
- mode: workflow | spec
- backend: app-server | exec | sdk
- policy: approvals, sandbox, tool allowlist
- artifacts: path to run directory

### Agent

An Agent is a role-scoped execution unit.

- agentId, role
- instructions (system + developer constraints)
- tool scope (MCP servers, allowlists)
- inputs and outputs are schema-defined (Zod)

### Step

A Step is a state transition inside a Run:

- plan -> research -> implement -> verify -> review -> finalize

Each step emits events:

- step.started
- step.progress
- step.completed
- step.failed

### Event log

Codex ToolLoop writes JSONL logs for:

- Orchestrator events
- Codex backend events (parsed)
- Tool invocations (MCP calls)
- File diffs (summaries, not full file bodies by default)

## 3. Execution model

### Default execution path (recommended)

- Use AI SDK v6 streaming APIs with Codex App Server provider.
- Keep a single persistent Codex thread per Run (unless configured stateless).
- Use mid-execution injection to correct course:
  - Provide additional context packs
  - Clarify requirements
  - Narrow tool usage

### Complementary execution paths

- Exec mode:
  - Used for one-shot tasks or scripted pipelines.
  - Enables JSONL output capture and strict schema outputs.
- SDK mode:
  - Used for fine-grained programmatic integration or experiments.

## 4. Tool substrate strategy

All custom tools are MCP tools.

Why:

- Codex can call MCP servers directly.
- Codex ToolLoop can discover and call MCP servers directly.
- A single implementation of tools works for both humans and agents.

Default transport:

- Streamable HTTP MCP servers.
- Stdio MCP servers are permitted for local-only development, but not the default.

## 5. Context management strategy

Codex ToolLoop uses “context packs,” which are bounded data bundles that can be injected into:

- the planner
- the implementer
- the reviewer
- mid-execution as injections

A context pack may include:

- repo map (top-level structure)
- relevant file excerpts (bounded, token-aware)
- symbol index summaries
- last run artifacts and decisions
- docs snippets (via MCP docs server)

## 6. Safety controls

Safety controls are layered:

1. Codex sandbox policy (read-only, workspace-write, danger-full-access)
2. Codex approval policy (untrusted, on-request, on-failure, never)
3. MCP tool allowlist/denylist (per workflow and per agent role)
4. Codex ToolLoop-side “dangerous action guardrails”
   - refuse to run disallowed commands
   - block writing secrets into artifacts
   - require explicit opt-in for networked doc crawling tools

## 7. Repository layout (target)

```text
codex-toolloop/
  apps/
    cli/
    ui/                    (optional)
  packages/
    codex-toolloop/
    codex/
    mcp/
    workflows/
    testkit/
  docs/
    PRD.md
    ARCHITECTURE.md
    adr/
    specs/
```

## 8. What “done” looks like

- `codex-toolloop doctor` passes.
- `codex-toolloop mcp start` starts servers and `codex-toolloop doctor` can discover tools.
- `codex-toolloop run spec specs/040-cli.md` can implement a feature in a demo repo, run tests, and produce a report.
- Run directory contains:
  - events.jsonl
  - final-report.md
  - plan.md
  - diff-summary.md
  - tool-calls.jsonl
  - verify.json (structured)
