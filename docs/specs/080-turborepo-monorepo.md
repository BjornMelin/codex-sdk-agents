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

Baseline configuration:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.json", "biome.json", ".env*"],
  "globalEnv": ["NODE_ENV", "VERCEL_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
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

### 4.2 Root Scripts (Required)

Update root `package.json` scripts to align with Turbo + Biome + Vitest:

- `build`: `turbo build`
- `dev`: `turbo dev`
- `lint`: `biome check .`
- `test`: `vitest run`

### 4.3 Turbo Dependency (Recommended)

Add `turbo` to root `devDependencies` so local and CI builds match Vercel behavior.

- Required version: `^2.7.5` (latest in registry).

### 4.4 Package Task Parity (Required)

Each workspace package must implement any task invoked by Turbo:

- `build` required for any package participating in `turbo build`.
- `test` and `lint` are root tasks unless explicitly added per-package.

### 4.5 Vercel Build Command (Required)

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
```
