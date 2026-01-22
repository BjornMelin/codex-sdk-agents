# SPEC 050: Memory, context packs, and cross-run knowledge

You are implementing durable memory and context mechanisms that improve long-running and repeated workflows.

## Objectives

1. Implement a repo-scoped memory store:
   - stores “conventions,” “decisions,” and “notes” per repository
   - file-based and inspectable
2. Implement a context pack cache:
   - avoid re-computing repo map and symbol summaries
3. Implement a compaction strategy:
   - produce short summaries at step boundaries
   - keep cross-step context bounded

## Hard requirements

- Local-first.
- No external DB required.
- No secrets persisted by default.
- Fully typed.
- **Atomic writes and file-level locking**: All writes to shared repo files (memory.json, indexes/, and summaries.jsonl appends) must use atomic-write patterns or OS-level locks to prevent corruption:
  - For memory.json and index files: write to a temporary file, fsync, then atomic rename into place.
  - For summaries.jsonl appends: use either O_APPEND with an exclusive append-lock, or write-then-rename append strategy.
  - Fallback behavior: document how platforms lacking advisory locks are handled (e.g., Windows fallback or recommended workarounds).

## Files and structure

Under `~/.codex-toolloop/repos/<repoHash>/` store:

- `memory.json`
- `summaries.jsonl`
- `indexes/` (repo map, optional symbol index summaries)

Repo identity:

- compute stable `repoHash`:
  - hash of canonical workspace path + git remote URL (if present) + current branch name
  - if remote not present, path-only hash

## Memory data model

Define schemas:

- Convention:
  - id
  - title
  - content
  - tags
  - createdAt
  - updatedAt

- Decision:
  - id
  - summary
  - rationale
  - impactedPaths
  - createdAt

- Note:
  - id
  - content
  - source (manual|agent|tool)
  - createdAt

Expose APIs:

- `getRepoMemory(repoHash)`
- `upsertConvention(...)`
- `appendSummary(runId, stepId, summaryText)`
- `buildContextFromMemory(maxChars)`

## Compaction

At the end of each workflow step:

- produce a summary of:
  - what happened
  - important outputs
  - follow-up actions
- store in summaries.jsonl
- include a bounded number of latest summaries into the next step context pack

## Safety and redaction

- Implement redaction pipeline:
  - basic token-like patterns
  - env var name matches
  - optional user-supplied patterns in config

## Testing

- Unit tests for:
  - repoHash stability
  - memory CRUD
  - redaction behavior
- Integration tests:
  - run a mocked workflow and ensure summaries are persisted and used

## Acceptance criteria

1. Memory store persists and is used to build context packs.
2. Summaries are appended per step.
3. Redaction prevents obvious secrets from being written.
