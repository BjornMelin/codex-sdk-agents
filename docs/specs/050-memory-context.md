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
  - Windows and lock-less platforms: if POSIX advisory locks are unavailable, use
    best-effort lock files (pid + timestamp + stale timeout) or rely on atomic
    write/rename patterns; document that locking is advisory and may not
    prevent all concurrent writers.
  - EXDEV fallback: if atomic rename fails with EXDEV (cross-device move), fall
    back to copy -> fsync -> verify -> unlink old file; if strong atomicity is
    required, fail fast with a clear error and avoid partial writes.
  - summaries.jsonl append guidance: prefer O_APPEND where supported; otherwise
    write to a temp file and concatenate with verification, then rename, using a
    best-effort lock to avoid lost writes.

## Files and structure

Under `~/.codex-toolloop/repos/<repoHash>/` store:

- `memory.json`
- `summaries.jsonl`
- `indexes/` (repo map, optional symbol index summaries)

Repo identity:

- compute stable `repoHash`:
  - hash of canonical workspace path + git remote URL (if present) + current branch name
  - if remote not present, path-only hash

**Branch-scoping and edge case handling:**

- **Memory scope:** Memories are **branch-scoped**. Each branch maintains its own memory store at `~/.codex-toolloop/repos/<repoHash>/` where repoHash includes the branch name. This prevents workflows on different branches from polluting each other's context.
- **Branch renames and deletions:** When a branch is renamed or deleted:
  - The old memory store persists under the old branch-namespaced repoHash.
  - Tools should support an optional migration/deduplication policy: preserve old memories by copying them to the new branch's store, or leave as-is for audit purposes.
  - Recommend documenting this as a user-initiated operation rather than automatic.
- **Detached HEAD states:** When the repository is in a detached HEAD state:
  - Treat the branch name as optional and fall back to the commit hash (SHA-1) in the repoHash computation.
  - This prevents memory loss during detached HEAD operations (e.g., CI bisect or rebase workflows).
  - Example: `repoHash = hash(path + remoteUrl + sha)` instead of `hash(path + remoteUrl + branchName)`.
- **Remote-less repositories:** Repos without a configured remote (rare but possible in CI or standalone clones):
  - Use path-only hashing: `repoHash = hash(path)` or `hash(path + currentBranchName)`.
  - Document the limitation that path-based memories cannot be shared across machine clones (no cross-machine memory transfer).
- **Configurable policy:** Allow configuration to override branch-scoping behavior (e.g., share memories across all branches via a shared `<repoHash>` without branch component). This can be set in config for teams that prefer unified team memory.

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

- `getRepoMemory(repoHash: string): Promise<RepoMemory>`
  - Errors: throws on read/parse errors.
- `upsertConvention(
  repoHash: string,
  convention: Partial<Convention> & Pick<Convention, "title" | "content">,
): Promise<Convention>`
  - Errors: throws on validation errors or write failures.
- `appendSummary(
  runId: string,
  stepId: string,
  summaryText: string,
): Promise<void>`
  - Errors: throws on append/write failures.
- `buildContextFromMemory(
  repoHash: string,
  maxChars: number,
): Promise<string>`
  - Errors: throws on read/parse errors.

Example usage:

```ts
const memory = await getRepoMemory(repoHash);
const updated = await upsertConvention(repoHash, {
  title: "Use pnpm workspaces",
  content: "All packages live under packages/ with NodeNext ESM.",
});
await appendSummary(runId, stepId, "Added MCP tool caching.");
const context = await buildContextFromMemory(repoHash, 8_000);
```

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
