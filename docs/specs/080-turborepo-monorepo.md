---
title: Turborepo Monorepo Configuration (Vercel-Ready)
spec: SPEC-080
adr: ADR-0010
status: Implemented (2026-01-22)
---

## 1. Purpose

Define the required Turborepo configuration and conventions so the monorepo builds reliably on Vercel and locally, with correct caching and artifact discovery.

## 2. Scope

Applies to the repository root and all workspace packages under `apps/*` and `packages/*`.

## 3. Current Gaps

- No `turbo.json` in repo root.
- Root scripts are not aligned with modern Turbo + Biome + Vitest guidance.
- No standard task outputs defined for build artifacts.
- No explicit environment hashing for cache correctness.

## 4. Requirements

### 4.1 Root `turbo.json` (Required)

Create `turbo.json` at the repo root with:

- `tasks.build.outputs` set to framework artifact directories.
- `.next/cache/**` excluded from outputs when Next.js is present.
- `dependsOn: ["^build"]` for build to ensure dependency ordering.
- `env`/`globalEnv` to ensure cache keys reflect environment-specific builds.
- Root tasks for Biome and Vitest to avoid per-package duplication.
- `globalDependencies` including lockfiles and config files so dependency/config changes invalidate caches.
- Avoid `.env` in `globalDependencies`; use `.env.example` and list explicit vars in `globalEnv`.

Baseline configuration:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "biome.json",
    ".env.example"
  ],
  "globalEnv": ["NODE_ENV", "VERCEL_ENV", "CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "interactive": true
    },
    "//#lint": { "outputs": [] },
    "//#fix": { "cache": false },
    "//#test": { "outputs": ["coverage/**"] },
    "//#typecheck": { "outputs": [] }
  }
}
```

Note: keep `.env.example` in sync with required environment variables and avoid
committing machine-specific `.env` changes that would invalidate caches.

If this repo adds a Next.js app, append:

```json
"outputs": ["dist/**", ".next/**", "!.next/cache/**"]
```

### 4.2 Root Scripts (Required)

Update root `package.json` scripts to align with Turbo + Biome + ESLint docs lint + Vitest:

- `build`: `turbo build`
- `dev`: `turbo dev`
- `lint`: `pnpm -s lint` (Biome + ESLint docs lint)
- `test`: `vitest run`

### 4.3 Turbo Dependency (Recommended)

Add `turbo` to root `devDependencies` so local and CI builds match Vercel behavior.

- Required version: `^2.7.5` (latest in registry).

### 4.4 Remote Cache (Optional, Recommended)

To enable signed remote cache uploads on Vercel, set:

```bash
vercel env add TURBO_REMOTE_CACHE_SIGNATURE_KEY
```

Ensure Remote Caching is enabled for the Vercel team.

### 4.5 Package Task Parity (Required)

Each workspace package must implement any task invoked by Turbo:

- `build` required for any package participating in `turbo build`.
- `test` and `lint` are root tasks unless explicitly added per-package.

### 4.6 Vercel Build Command (Required)

Set the Vercel Project Build Command to:

```bash
turbo build
```

Root Directory should remain the monorepo root unless a subproject deploy is intended.

## 5. Verification

- Local: `turbo run build` should populate cache in `node_modules/.cache/turbo`.
- Local: `turbo run lint` and `turbo run test` should execute root tasks.
- Vercel: build should succeed with correct outputs detected on cache hits.

## 6. References

```text
Vercel Turborepo monorepos: https://vercel.com/docs/monorepos/turborepo
Vercel Next.js cache exclusion rule: https://vercel.com/docs/conformance/rules/NEXTJS_NO_TURBO_CACHE
Turborepo config reference: https://turborepo.dev/schema.json
Turborepo env hashing: https://github.com/vercel/turborepo/blob/main/docs/site/content/docs/crafting-your-repository/using-environment-variables.mdx
Turborepo Biome guide: https://turbo.build/repo/docs/guides/tools/biome
Turborepo config (tasks vs pipeline): https://turborepo.dev/docs/reference/configuration
Vercel remote cache signature: https://vercel.com/docs/integrations/ecommerce/bigcommerce
```
