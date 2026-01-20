## codex-toolloop

This repo is a Bun + TypeScript workspace for building and testing agentic coding workflows with:

- `@openai/codex-sdk` (programmatic threads, streaming JSONL events, structured outputs)
- `codex exec` patterns (non-interactive automation, JSONL, `--output-schema`, session resume)
- `biome` (lint/format) + `vitest` (tests)

The `docs/reference/` directory contains snapshots of official Codex documentation and source-derived references. Treat those files as read-only and build your project docs on top.

## Requirements

- Bun (`bun --version`)
- Git
- Codex authentication (either `codex login` or `CODEX_API_KEY` for `codex exec` / SDK runs)

## Quickstart

```bash
bun install
cp .env.example .env
# Set CODEX_API_KEY in .env, or log in with `codex login`
```

Run a basic SDK call:

```bash
bun run examples:basic
```

Stream events:

```bash
bun run examples:stream
```

Structured output:

```bash
bun run examples:structured
```

## Code review example (structured output)

This example reads a Git diff and asks Codex for structured review findings:

```bash
REVIEW_BASE=main REVIEW_HEAD=HEAD bun run examples:review
```

Optional:

- `REVIEW_FOCUS="security regressions"`

## Common commands

- `bun run check`
- `bun run lint`
- `bun run format`
- `bun run test`
- `bun run typecheck`

## Repo layout

- `src/`: reusable utilities and workflow building blocks
- `examples/`: runnable scripts that call Codex
- `docs/`: project docs
- `docs/reference/`: upstream references (do not edit)

## Next docs

- `docs/getting-started.md`
- `docs/codex-sdk.md`
- `docs/codex-exec.md`
- `docs/event-streams.md`
- `docs/workflows.md`
- `docs/safety.md`
- `docs/mcp.md`
- `docs/exec-plan.md`
- `docs/structured-outputs.md`
- `docs/automation-recipes.md`
