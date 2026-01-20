# AGENTS.md

This repository is a Bun + TypeScript workspace for developing Codex-based coding agents and automation workflows.

## Working agreements

- Use `bun` for installs and scripts.
- Keep changes small and testable; add a `vitest` test when you introduce new prompt builders, parsers, or schema helpers.
- Run `bun run check` before considering work “done”.
- Never commit secrets. Use `.env` locally and keep `.env.example` up to date.

## Safety defaults

- Prefer read-only analysis workflows by default (`sandboxMode: "read-only"`, `approvalPolicy: "never"`).
- Only grant write access when the workflow truly needs it; prefer `workspace-write` over `danger-full-access`.
- Avoid `--dangerously-bypass-approvals-and-sandbox` / `--yolo` except inside a dedicated, externally sandboxed runner.

## Where code goes

- `src/lib/`: small utilities (env handling, git helpers, parsing)
- `src/workflows/`: prompt builders, schemas, and workflow-specific glue
- `examples/`: runnable scripts that exercise workflows end-to-end
- `docs/`: repo documentation (file names must be kebab-case)
- `docs/reference/`: upstream snapshots (treat as read-only)

## Conventions for Codex SDK usage

- Use `createCodexFromEnv()` (`src/lib/create-codex-from-env.ts`) to avoid duplicating auth wiring.
- When you need machine-readable outputs, always pass an `outputSchema` and validate the final response before acting on it.
- When building streaming UIs or long-running flows, use `runStreamed()` and handle `turn.failed` / `error` explicitly.


<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->