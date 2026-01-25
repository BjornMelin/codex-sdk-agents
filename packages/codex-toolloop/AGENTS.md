# Repository Guidelines

## Project Structure & Module Organization

- Source lives in `src/` and is compiled to `dist/` by TypeScript.
- The public entry point is `src/index.ts`; export new modules from there.
- Package metadata and scripts are in `package.json`; TS config extends the repo root `tsconfig.json`.

## Build, Test, and Development Commands

- `pnpm build` (or `npm run build`): Type-checks and emits compiled output to `dist/` using `tsc -p tsconfig.json`.
- No local dev server or test script is defined in this package; use the repo root tooling when available.

## Coding Style & Naming Conventions

- TypeScript, ESM (`"type": "module"`). Keep imports/export syntax consistent with existing files.
- Prefer small, focused modules and named exports; wire them through `src/index.ts`.
- Match existing formatting in the file you touch (indentation, quotes). Avoid introducing new style tooling unless required.

## Testing Guidelines

- This package currently has no test scripts configured. If you add tests, align with the repo’s standard runner and add a script in `package.json`.
- Keep tests close to source (e.g., `src/__tests__/...`) and name files `*.test.ts`.

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits (e.g., `docs: ...`, `chore: ...`, `feat: ...`).
- PRs should include: a concise summary, relevant context/issue links, and how changes were verified (commands run).
- Add screenshots only when UI or output changes materially.

## Configuration & Safety Notes

- Outputs are emitted to `dist/`; avoid committing build artifacts unless the repo explicitly requires it.
- Keep changes minimal and backward-compatible unless a breaking change is intended and clearly documented.
