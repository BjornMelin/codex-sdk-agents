# SPEC 030: Agent runtime and workflow engine (multi-agent, typed handoffs, context packs)

You are implementing the Codex ToolLoop core runtime in `packages/codex-toolloop` and workflow definitions in `packages/workflows`.

## Objectives

1. Create a workflow engine that executes step sequences with typed inputs/outputs.
2. Implement a multi-agent feature-dev workflow:
   - plan -> research -> implement -> verify -> review -> finalize
3. Implement context pack builders that bound context size and provide deterministic inputs.
4. Integrate Codex backends through `packages/codex`.

## Hard requirements

- Zod v4.3.5 for all step IO schemas.
- Each step must validate its output before passing to next step.
- Every step must write artifacts through an `ArtifactStore`.
- Every run emits events through the normalized event bus.

## Core types

Implement in `packages/codex-toolloop/src`:

### RunContext

- runId
- workspaceRoot
- startedAt
- artifactStore
- eventBus
- mcpRegistry (from packages/mcp)
- codexBackend (from packages/codex)
- policy:
  - approvals/sandbox
  - tool allowlists
  - doc allowlist

### Step

```ts
interface Step<I, O> {
  readonly id: string;
  readonly title: string;
  readonly inputSchema: z.ZodType<I>;
  readonly outputSchema: z.ZodType<O>;
  run(ctx: RunContext, input: I): Promise<O>;
}
```

### Workflow

A workflow is a list of steps with a top-level input/output schema.

### ArtifactStore

- `writeText(path, content)`
- `writeJson(path, data)`
- `appendJsonl(path, event)`
- `readText(path)` (optional)
- Ensure safe paths inside the run directory.

### EventBus

- `emit(event)`
- `subscribe(handler)`
- Default implementation writes to artifacts as JSONL.

## Context packs

Implement `ContextPackBuilder`:

- Input: scope (paths, queries), budget (max chars or max tokens estimate)
- Output: markdown bundle that includes:
  - repo map
  - file excerpts
  - search results summaries
- Use MCP repo tools (repo.ripgrep, repo.readFile) to build packs.

## Multi-agent roles

Define role instructions as constants:

- Planner
- Researcher
- Implementer
- Verifier
- Reviewer

Each step should:

- build a prompt containing:
  - role instructions
  - relevant context pack
  - structured output request (if needed)
- call the codex backend with:
  - role-specific mcpServers allowlist
  - appropriate approvals/sandbox policy

## Structured outputs for handoffs

Use `codex exec --output-schema` mode only when:

- output must be reliably machine-readable and strongly typed

Otherwise:

- parse best-effort JSON blocks from text, validate with Zod
- on failure, ask Codex to re-emit in schema

Define per-step output schemas:

- PlanOutput:
  - filesToTouch: string[]
  - approach: string
  - risks: string[]
  - testPlan: string[]
- ResearchOutput:
  - keyFindings: string[]
  - repoFacts: { path: string; note: string }[]
  - externalRefs: { url: string; note: string }[]
- ImplementOutput:
  - changeSummary: string
  - commandsRun: string[]
  - testsRun: string[]
- VerifyOutput:
  - status: "pass" | "fail"
  - failingTests?: string[]
  - notes: string
- ReviewOutput:
  - findings: array of { severity, area, description, evidencePaths, suggestions }
  - docGaps: array of { docArea, gap, recommendation }
- FinalReport:
  - executiveSummary
  - whatChanged
  - howToVerify
  - risksRemaining

## Acceptance criteria

1. A workflow can be executed with mocked Codex backend and produces artifacts.
2. Each step validates outputs with Zod.
3. Context packs are built from MCP repo tools.
4. The workflow emits events into run artifacts.
