# ADR 0004: Multi-agent workflow engine with role-based steps and typed handoffs

## Status

Accepted

## Context

Codex ToolLoop must support multi-agent systems that can:

- autonomously handle feature development end-to-end
- do deep research and context gathering
- run commands and tests
- perform code review and doc gap analysis
- manage cross-context handoffs and shared memory

Single monolithic agent loops tend to:

- bloat context
- mix concerns (planning vs executing)
- produce weaker reviews

We need stable boundaries with typed handoffs.

## Decision

Codex ToolLoop uses:

- A workflow engine defined as a sequence of steps.
- Each step is executed by a specific agent role:
  - Planner
  - Researcher
  - Implementer
  - Verifier
  - Reviewer

Handoffs between roles are strictly typed using Zod schemas:

- Each step produces a structured output.
- Next step receives that output plus a context pack.

Codex ToolLoop stores:

- step outputs (structured JSON)
- step transcripts (text)
- event logs (JSONL)
- diffs and test results

## Alternatives considered

1. Single agent with internal “phases”

- Pros: simplest
- Cons: harder to enforce boundaries and keep context small

1. Fully parallel agents always-on

- Pros: speed for some tasks
- Cons: coordination complexity and tool contention

1. External orchestrator framework (LangGraph, etc.)

- Pros: prebuilt graphs
- Cons: misaligned with Bun-first, and we want minimal abstractions

## Consequences

- More up-front schema work.
- Much better reliability, inspectability, and reproducibility.
- Enables targeted re-runs: re-run only reviewer, re-run only verifier, etc.

## Implementation notes

- Workflow definition in TS:
  - Step graph supports sequential for MVP; optional DAG later.
- Each agent role has:
  - system instructions
  - tool scope (MCP allowlist)
  - backend selection preference

## Acceptance criteria

- Can run `feature-dev` end-to-end.
- Can resume a workflow at a step boundary with the same artifacts.
- Outputs are typed and validated.
