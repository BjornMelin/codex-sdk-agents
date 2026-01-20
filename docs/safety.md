# Safety

## Defaults

- Keep workflows read-only unless you need edits.
- Ask for the minimum permissions required for the task.

## Secrets

- Don’t pass secrets in prompts.
- Don’t commit `.env`.
- Prefer least-privilege CI runners and restrict who can trigger workflows that run Codex.

## Sandboxing and approvals

Treat these as separate controls:

- Sandbox controls *what the agent can do* (filesystem/network boundaries).
- Approval policy controls *when a human must confirm* before running a command.

In CI, use explicit flags and avoid “full access” unless the job is externally sandboxed.
