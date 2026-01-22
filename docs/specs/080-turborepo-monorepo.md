---
title: Turborepo Monorepo Configuration (Vercel-Ready)
spec: SPEC-080
adr: ADR-0010
status: Accepted (2026-01-22)
---

## 1. Purpose

Define the required Turborepo configuration and conventions so the monorepo builds reliably on Vercel and locally, with correct caching and artifact discovery.

## 2. Scope

Applies to the repository root and all workspace packages under `apps/*` and `packages/*`.

## 3. Current Gaps

- No `turbo.json` in repo root.
- Root scripts do not use Turbo (`turbo build`, `turbo test`, `turbo lint`, `turbo dev`).
- No standard task outputs defined for build artifacts.
- No explicit environment hashing for cache correctness.

## 4. Requirements

### 4.1 Root `turbo.json` (Required)

Create `turbo.json` at the repo root with:

- `pipeline.build.outputs` set to framework artifact directories.
- `.next/cache/**` excluded from outputs when Next.js is present.
- `dependsOn: ["^build"]` for build to ensure dependency ordering.
- `env`/`globalEnv` to ensure cache keys reflect environment-specific builds.

Baseline configuration:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.json", ".env"],
  "globalEnv": ["NODE_ENV"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 4.2 Root Scripts (Required)

Update root `package.json` scripts to use Turbo:

- `build`: `turbo build`
- `test`: `turbo test`
- `lint`: `turbo lint`
- `dev`: `turbo dev`

### 4.3 Turbo Dependency (Recommended)

Add `turbo` to root `devDependencies` so local and CI builds match Vercel behavior.

### 4.4 Package Task Parity (Required)

Each workspace package must implement any task invoked by Turbo:

- `build` required for any package participating in `turbo build`.
- `test` and `lint` only required if `turbo test` / `turbo lint` will be used.

### 4.5 Vercel Build Command (Required)

Set the Vercel Project Build Command to:

```bash
turbo build
```

Root Directory should remain the monorepo root unless a subproject deploy is intended.

## 5. Verification

- Local: `turbo run build` should populate cache in `node_modules/.cache/turbo`.
- Vercel: build should succeed with correct outputs detected on cache hits.

## 6. References

```text
Vercel Turborepo monorepos: https://vercel.com/docs/monorepos/turborepo
Vercel Next.js cache exclusion rule: https://vercel.com/docs/conformance/rules/NEXTJS_NO_TURBO_CACHE
Turborepo config reference: https://turborepo.dev/schema.json
Turborepo env hashing: https://github.com/vercel/turborepo/blob/main/docs/site/content/docs/crafting-your-repository/using-environment-variables.mdx
```
