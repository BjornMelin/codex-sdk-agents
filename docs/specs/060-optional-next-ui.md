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

- Server Actions:
  - `startRunAction(formData)` spawns `pnpm dev:cli -- run workflow ...` (dev)
  - store PID and return runId
- Streaming is optional; initial version can poll.

## Security

- UI is local only.
- Do not expose secrets.
- Read-only by default.

## Acceptance criteria

1. UI lists runs and displays run details.
2. Can start a workflow run.
3. Uses server components and server actions correctly.
