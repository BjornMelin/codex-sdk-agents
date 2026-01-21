# codex exec (non-interactive automation)

Use `codex exec` when you need:

- a scriptable entry point for CI / cron jobs
- machine-readable progress (`--json` JSONL)
- structured final output (`--output-schema <file>`)
- the ability to resume sessions (`codex exec resume ...`)

## Key behavior

- In non-JSON mode, progress goes to `stderr` and only the final message goes to `stdout`.
- With `--json`, `stdout` becomes a JSONL event stream.

## Safety knobs (use least privilege)

- Default is read-only.
- For edits, prefer `--full-auto` (and/or `--sandbox workspace-write`) in a controlled environment.
- Avoid `danger-full-access` unless you are inside a dedicated sandbox runner or container.

## References

- `docs/reference/non-interactive.md`
- `docs/reference/cli-options.md`
- `docs/reference/codex-exec.md`
