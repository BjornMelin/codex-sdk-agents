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
- **Atomic writes and file-level locking**: All writes to shared repo files (memory.json, indexes/, and summaries.jsonl appends) must use atomic-write patterns or OS-level locks to prevent corruption. Use platform-specific durability primitives:
  - **POSIX systems (memory.json, index files, summaries.jsonl)**:
    - Write to a temporary file, call `fsync()` to persist file data to disk.
    - For index files and small binary data, `fdatasync()` may be used to skip metadata sync where inode updates are not critical.
    - Perform atomic `rename()` to move temp file into place; rename is atomic on POSIX.
    - For summaries.jsonl appends, prefer `open()` with `O_APPEND` flag (ensures append atomicity at kernel level), then write and `fsync()` or `fdatasync()`.
  - **Windows systems (memory.json, index files, summaries.jsonl)**:
    - Write to a temporary file, call `FlushFileBuffers()` to ensure data durability.
    - Use `MoveFileEx()` with `MOVEFILE_REPLACE_EXISTING` for atomic rename semantics (note: not fully atomic on all Windows versions; document this).
    - For summaries.jsonl appends, use `WriteFile()` with `FILE_FLAG_WRITE_THROUGH` to bypass the cache and write directly to disk; or use exclusive file locking and append-lock patterns.
  - **EXDEV fallback**: If atomic rename fails with EXDEV (cross-device or cross-filesystem move):
    - Fall back to copy (respecting sync calls above) -> verify checksum/size -> unlink old file.
    - If strong atomicity is required, fail fast with a clear error and avoid partial writes.
  - **Windows and lock-less platforms**: If POSIX advisory locks (`flock()`, `fcntl()`) are unavailable:
    - Use best-effort lock files (pid + timestamp + stale timeout, typically 5–30 seconds).
    - Document that locking is advisory and may not prevent all concurrent writers on certain NFS or network filesystems.
  - **Lock file fallback behavior**: Use a `.lock` file alongside the target (e.g., `memory.json.lock`) to serialize access; clean up stale locks based on age + process ID checks.

## Files and structure

Under `~/.codex-toolloop/repos/<repoHash>/` store:

- `memory.json`
- `summaries.jsonl`
- `indexes/` (repo map, optional symbol index summaries)

Repo identity:

- compute stable `repoHash`:
  - hash of canonical workspace path + sanitized git remote URL (if present) + current branch name
  - **Remote URL sanitization (required to prevent credential leaks):**
    - **HTTPS and HTTP URLs:**
      - Strip userinfo credentials: remove `username[:password]@` prefix
      - Remove default ports (e.g., `:443` for HTTPS, `:80` for HTTP)
      - Normalize scheme to lowercase (e.g., `https://` not `HTTPS://`)
      - Remove query parameters and fragments
      - Remove trailing slashes
      - Example: `https://user:token@github.com:443/owner/repo/?foo=bar#section` → `https://github.com/owner/repo`
    - **SSH URLs (SCP-style and ssh://):**
      - Strip userinfo prefix (e.g., `git@`, `user@`)
      - Convert SCP-style `host:path` format to `host/path` (e.g., `git@github.com:owner/repo.git` → `github.com/owner/repo.git`)
      - Remove port specifiers (e.g., `:22`)
      - Remove `.git` suffix if present
      - Normalize scheme to `ssh://` (lowercase)
      - Remove query parameters and fragments
      - Remove trailing slashes
      - Example SCP: `git@github.com:owner/repo.git` → `ssh://github.com/owner/repo`
      - Example ssh://: `ssh://user@github.com:22/owner/repo.git?foo=bar` → `ssh://github.com/owner/repo`
  - Hash the canonical path + sanitized remote URL + current branch name
  - if remote not present, hash canonical path + current branch name only

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
- **Configurable branch-scoping policy:**
  - **Config key:** `memory.branchScope`
  - **Allowed values:** `"perBranch"` (default) | `"sharedRepo"`
  - **Environment variable:** `MEMORY_BRANCH_SCOPE` (overrides config)
  - **API parameter:** `branchScope` (per-request override of config)
  - **Behavior:**
    - `"perBranch"` (default): Include branch name in repoHash; each branch maintains separate memory. Example: `~/.codex-toolloop/repos/<repoHash-with-branch>/memory.json`
    - `"sharedRepo"`: Omit branch name from repoHash; all branches share the same memory store. Example: `~/.codex-toolloop/repos/<repoHash-no-branch>/memory.json`
  - **Use case:** Teams that prefer unified cross-branch memory (e.g., shared architectural decisions and conventions) can set `MEMORY_BRANCH_SCOPE=sharedRepo` or configure `memory.branchScope: "sharedRepo"` in the codex config file. Per-request overrides allow a single workflow to temporarily switch scope.

## Memory data model

Define schemas:

- Convention:
  - id: `string` (unique identifier, e.g., UUID)
  - title: `string` (brief convention name)
  - content: `string` (full convention documentation)
  - tags: `string[]` (category tags, e.g., ["style", "architecture"])
  - createdAt: `string` (ISO-8601 timestamp, e.g., "2025-01-22T10:30:00Z")
  - updatedAt: `string` (ISO-8601 timestamp, e.g., "2025-01-22T10:30:00Z")

- Decision:
  - id: `string` (unique identifier, e.g., UUID)
  - summary: `string` (one-line decision summary)
  - rationale: `string` (full explanation and reasoning)
  - impactedPaths: `string[]` (file/directory paths affected, e.g., ["src/", "docs/"])
  - createdAt: `string` (ISO-8601 timestamp, e.g., "2025-01-22T10:30:00Z")
  - updatedAt: `string` (ISO-8601 timestamp, e.g., "2025-01-22T10:30:00Z")

- Note:
  - id: `string` (unique identifier, e.g., UUID)
  - content: `string` (note text)
  - source: `"manual" | "agent" | "tool"` (origin of the note)
  - createdAt: `string` (ISO-8601 timestamp, e.g., "2025-01-22T10:30:00Z")
  - updatedAt: `string` (ISO-8601 timestamp, e.g., "2025-01-22T10:30:00Z")

Expose APIs:

- `getRepoMemory(repoHash: string): Promise<RepoMemory>`
  - **Concurrency**: Safe for concurrent readers. All readers and writers go through the file lock (see atomic write section, lines 22–38).
  - **Locking**: Internally acquires a read lock before accessing memory.json. Readers may block briefly if a writer is in progress.
  - **On missing repoHash**: Returns an empty RepoMemory object (with empty conventions, decisions, notes, summaries arrays) instead of throwing.
  - **Errors thrown**:
    - `LockAcquisitionError`: if lock cannot be acquired within timeout (default 5 seconds)
    - `ParseError`: if memory.json is malformed JSON
    - `IOError`: for file read errors

- `upsertConvention(
  repoHash: string,
  convention: Partial<Convention> & Pick<Convention, "title" | "content">,
): Promise<Convention>`
  - **Concurrency**: Safe for concurrent use. Writes use atomic file operations (write-to-temp, fsync, rename).
  - **Locking**: Internally acquires an exclusive write lock on memory.json before modifying. Blocks other readers/writers until lock is released.
  - **On contention**: If lock cannot be acquired within timeout (default 5 seconds), throws `LockAcquisitionError`. Caller should implement retry logic (exponential backoff recommended).
  - **Atomicity**: Either the entire upsert succeeds (Convention is created/updated and persisted) or fails with an error; no partial updates.
  - **Errors thrown**:
    - `LockAcquisitionError`: if exclusive lock cannot be acquired within timeout
    - `ValidationError`: if convention title/content fail schema validation
    - `ParseError`: if existing memory.json is malformed
    - `IOError`: for write/fsync failures
    - `RenameError` (with EXDEV fallback): if atomic rename fails

- `appendSummary(
  runId: string,
  stepId: string,
  summaryText: string,
): Promise<void>`
  - **Concurrency**: Safe for concurrent appends. Uses O_APPEND flag on POSIX or exclusive append-lock on Windows (see atomic write section, lines 32–34).
  - **Locking**: Acquires a brief exclusive append-lock before writing to summaries.jsonl. Lock is released immediately after append completes.
  - **On contention**: If lock cannot be acquired within timeout (default 1 second), throws `LockAcquisitionError`. Retry with exponential backoff is recommended.
  - **Atomicity**: Summary line is either fully written to summaries.jsonl or append fails; no partial lines.
  - **Errors thrown**:
    - `LockAcquisitionError`: if append lock cannot be acquired within timeout
    - `IOError`: for write failures
    - `ValidationError`: if summaryText is empty or exceeds max length (default 64 KB)

- `buildContextFromMemory(
  repoHash: string,
  maxChars: number,
): Promise<string>`
  - **Concurrency**: Safe for concurrent readers. Acquires a read lock (non-exclusive) to prevent inconsistent reads if writers are in progress.
  - **Locking**: Acquires a read lock. Multiple readers can hold the read lock simultaneously; writers block until all readers release.
  - **On contention**: Readers do not block writers indefinitely. If a writer is waiting, the lock manager may signal readers to release early (fair scheduling).
  - **Errors thrown**:
    - `LockAcquisitionError`: if read lock cannot be acquired within timeout
    - `ParseError`: if memory.json or summaries.jsonl is malformed
    - `IOError`: for read failures

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

- **Summary creation:** Produce a summary JSON object with the following schema:
  - `runId`: `string` (unique workflow run identifier)
  - `stepId`: `string` (step identifier within the run)
  - `timestamp`: `string` (ISO-8601 timestamp of summary creation)
  - `summary`: `string` (one-paragraph summary of: what happened, important outputs, follow-up actions)
  - `tags`: `string[]` (optional metadata tags for categorization)

- **Storage:** Append one JSON object per line to `~/.codex-toolloop/repos/<repoHash>/summaries.jsonl` (JSONL format). Use `appendSummary` API (which handles atomic append and file locking).

- **Pruning and limits (configurable)**:
  - Default: keep latest **N = 10** summaries (configurable via `memory.maxSummariesInContext`)
  - Max file entries: **100** (configurable via `memory.summariesMaxEntries`); prune oldest entries via FIFO when exceeded
  - Max file size: **1 MB** (configurable via `memory.summariesMaxBytes`); truncate oldest entries when file size is exceeded
  - Implementation: After appending a summary, check size/count; if limits exceeded, rewrite summaries.jsonl with oldest entries removed

- **Context inclusion:** When building the next step context pack via `buildContextFromMemory`, include the latest **N** summaries (by timestamp) in the context string. Summaries are inserted in reverse chronological order (newest first) to highlight recent progress.

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
