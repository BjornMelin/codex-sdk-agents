# SPEC 060 (Optional): Local Next.js UI for monitoring runs and browsing artifacts

This spec is optional and should only be implemented after the CLI system is stable.

## Objectives

1. Add a local Next.js 16 app under `apps/ui`.
2. Provide read-only dashboards:
   - list runs
   - inspect a run (final report, events tail, step outputs)
3. Provide a “start run” form for:
   - selecting workflow
   - pasting a spec
4. Use Server Components by default, minimal client components.

## Hard requirements

- Next.js App Router.
- React 19.
- No deployment assumptions.
- Use filesystem reads from the Codex ToolLoop artifact store.

## Pages

- `/` list runs
- `/runs/[runId]` run detail
- `/new` create a run (calls a server action that spawns the CLI run)

## Implementation details

### Server Actions and process spawn safety

- `startRunAction(formData)` spawns `pnpm dev:cli -- run workflow ...` (dev only)
- **Spawn requirements**:
  - Use argument arrays (no shell strings) for process spawn to prevent shell injection
  - Validate and allowlist workflow names and spec inputs before spawning
  - Persist run metadata (PID, startTime, status, exitCode, logPaths) via a durable store (e.g., `.codex-toolloop/ui-runs.jsonl`)
- **Concurrency and backpressure**:
  - Define concurrency limits (e.g., max N simultaneous runs) to prevent resource exhaustion
  - Implement backpressure by rejecting new runs if limit is reached
- **Lifecycle management**:
  - Implement cleanup/timeouts: kill stale processes after a configurable timeout (default: 1 hour)
  - Support explicit cancel/kill semantics via a "stop run" button
  - Provide graceful shutdown: on server shutdown, signal all child processes to terminate and wait for cleanup
  - Avoid orphaned processes: poll process status periodically and mark as "orphaned" if process is gone but exit code is unknown
- **Streaming**: Initial version can poll `~/.codex-toolloop/index.jsonl` and events.jsonl for updates; WebSocket/SSE streaming is optional.

## Security

- UI is local only.
- Do not expose secrets.
- Read-only by default.

## Acceptance criteria

1. UI lists runs and displays run details.
2. Can start a workflow run.
3. Uses server components and server actions correctly.
