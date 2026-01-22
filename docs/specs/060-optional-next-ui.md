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

- `startRunAction(formData)` should spawn the CLI locally. In development it
  runs `pnpm dev:cli -- run workflow ...`; in production it should call a
  built/installed CLI entrypoint (for example `codex-toolloop run workflow ...`)
  or be disabled if the UI is distributed without a local CLI.
- **Spawn requirements**:
  - Use argument arrays (no shell strings) for process spawn to prevent shell injection
  - **Workflow validation**:
    - **Workflow name criteria:**
      - Must match regex `^[a-zA-Z0-9_-]+$` (alphanumerics, underscore, hyphen only)
      - Max length: 64 characters
      - Must resolve to a known workflow in the discovered project workflows
    - **Spec input validation:**
      - Max size: 1 MB (reject larger payloads)
      - Must be valid JSON or YAML (parse and validate before acceptance)
      - Must conform to any workflow-specific schema if defined (validate against workflow's schema if available)
    - **Allowlist configuration:**
      - Read `ui.allowedWorkflows` from `.codex-toolloop/config.json` if present
      - Allowed workflows format: `ui.allowedWorkflows: string[]` (array of workflow names)
      - Default behavior: if `ui.allowedWorkflows` is not set or empty, allow all discovered project workflows
      - If `ui.allowedWorkflows` is configured, only allow workflows in that list
    - **Validation failure handling:**
      - Return HTTP 400 Bad Request with a descriptive JSON error message (include field name, constraint violated, and expected format)
      - Log all validation failures to a security audit log (e.g., `.codex-toolloop/ui-validation-audit.jsonl`) with timestamp, source IP (loopback), workflow name, and error reason
      - Example error response: `{ "error": "Invalid workflow name", "details": "Workflow name must match ^[a-zA-Z0-9_-]+$, got 'my workflow!'" }`
  - Persist run metadata (PID, startTime, status, exitCode, logPaths) via a durable store (e.g., `.codex-toolloop/ui-runs.jsonl`)
- **Concurrency and backpressure**:
  - Define concurrency limits (e.g., max N simultaneous runs) to prevent resource exhaustion
  - Implement backpressure by rejecting new runs if limit is reached
- **Lifecycle management**:
  - Implement cleanup/timeouts: kill stale processes after a configurable timeout (default: 1 hour)
  - Support explicit cancel/kill semantics via a "stop run" button
  - Provide graceful shutdown: on server shutdown, signal all child processes to terminate and wait for cleanup
  - Avoid orphaned processes: poll process status periodically and mark as "orphaned" if process is gone but exit code is unknown

### Configuration

Configuration for concurrency, timeouts, and polling can be set via environment variables or config file (`.codex-toolloop/config.json`). Environment variables take precedence over config file settings.

**Concurrency and timeout settings:**

| Setting | Env Var | Config Key | Default | Description |
|---------|---------|-----------|---------|-------------|
| Max concurrent runs | `UI_MAX_CONCURRENT_RUNS` | `ui.maxConcurrentRuns` | 3 | Maximum number of simultaneous workflow runs allowed |
| Run timeout | `UI_RUN_TIMEOUT_MS` | `ui.runTimeoutMs` | 3600000 (1 hour) | Timeout in milliseconds; runs exceeding this are killed |
| Poll interval | `UI_POLL_INTERVAL_MS` | `ui.pollIntervalMs` | 1000 | Polling interval in milliseconds for status updates |

**Configuration file example** (`.codex-toolloop/config.json`):
```json
{
  "ui": {
    "maxConcurrentRuns": 5,
    "runTimeoutMs": 7200000,
    "pollIntervalMs": 2000
  }
}
```

**Precedence and overrides:**

- Environment variables override config file values; if both are set, env var wins.
- Workflow-level overrides: Workflows can declare `ui.*` metadata in their definition (e.g., `timeout: 1800000` in the workflow spec) to request non-default values.
- Precedence order (highest to lowest): workflow-level override → environment variable → config file → built-in default.
- Validation: UI must enforce a maximum timeout ceiling (e.g., 24 hours) to prevent runaway processes, and reject workflow-declared timeouts that exceed the ceiling.

- **Streaming**: Initial version can poll `~/.codex-toolloop/index.jsonl` and events.jsonl for updates; WebSocket/SSE streaming is optional.

### ui-runs.jsonl schema

Records are append-only JSON lines stored at `~/.codex-toolloop/ui-runs.jsonl`.
Each record provides UI-level run tracking and references the canonical run
artifacts by `runId`.

Required fields:
- `runId: string` -- run identifier, matches run directory name.
- `pid: number` -- spawned process ID.
- `startTime: string` -- ISO timestamp.
- `status: "running" | "completed" | "failed" | "killed" | "orphaned"` -- state of the run with the following semantics:
  - **Setting rules (CLI is authoritative unless otherwise noted):**
    - `running`: CLI sets on spawn; UI maintains until process terminates or orphan detection fires.
    - `completed`: CLI reports via exit code 0; record includes `exitCode: 0`.
    - `failed`: CLI reports via non-zero exit code; record includes `exitCode: N` (N > 0).
    - `killed`: CLI reports process killed by signal; record includes `signal: string` (e.g., "SIGTERM").
    - `orphaned`: UI sets after polling detects PID is gone and exit code was never captured.
  - **Valid state transitions:**
    - `running` → `completed` | `failed` | `killed` | `orphaned` (only valid progression from running)
    - `completed`, `failed`, `killed`, `orphaned` are terminal (no further transitions allowed)
  - **Orphaned detection logic (UI responsibility):**
    - UI polls active runs (those in `running` state) at intervals defined by `UI_POLL_INTERVAL_MS`.
    - Check if PID exists and process is still alive using OS-level checks (e.g., `kill -0 <pid>` on Unix).
    - If PID is gone and the record has no `exitCode` or `signal` (meaning CLI did not report termination), mark status as `orphaned`.
    - Log the orphaned detection with timestamp for debugging.
  - **Authority:** CLI sets all normal terminal states (`completed`, `failed`, `killed`) via exit codes/signals; UI may only set `orphaned` after process verification.

Optional fields:
- `exitCode?: number`
- `signal?: string`
- `workflowId?: string`
- `specId?: string`
- `logPaths?: { stdout?: string; stderr?: string }`
- `metadata?: Record<string, unknown>`

Relationship to other files:
- `ui-runs.jsonl` is UI-facing metadata only and references `runId`.
- `~/.codex-toolloop/index.jsonl` remains the canonical run index; the UI should
  reconcile state using `runId` and `meta.json` under each run directory.

Versioning:
- Include `schemaVersion?: number` in new records when fields change; maintain
  backward-compatible readers.

## Security

- **UI is local only:** The UI server must be bound exclusively to the loopback interface and must reject all non-local connections.
  - **Technical controls:**
    - Bind the HTTP server to `127.0.0.1:PORT` (never to `0.0.0.0` or other network interfaces).
    - **Socket-level IP check (primary enforcement):** Reject connections from non-loopback IP addresses at the socket level by verifying `req.socket.remoteAddress` is loopback (`127.0.0.1` or `::1`); return HTTP 403 Forbidden for any non-loopback connection.
    - **Origin header validation (defense-in-depth):** If an `Origin` header is present, reject requests whose Origin does not resolve to `127.0.0.1` or `localhost`; allow requests without an Origin header only if they pass the socket-level remote address check.
    - Document these enforcement points in the server startup logs for debugging.
  - **Rationale:** Prevents accidental or malicious network exposure of local run artifacts and sensitive data. Socket-level checks are authoritative; Origin header checks provide additional CORS-based defense for compatible clients.
- Do not expose secrets.
- Read-only by default.

## Acceptance criteria

1. UI lists runs and displays run details.
2. Can start a workflow run.
3. Uses server components and server actions correctly.
