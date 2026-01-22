---
adr: ADR-0010
title: Standardize Turborepo configuration for the monorepo
spec: SPEC-080
status: Implemented (2026-01-22)
---

## Context

The repository is a pnpm workspace monorepo with multiple packages and apps. Builds are currently driven by root `tsc` and package-level scripts without a centralized task graph. This creates inconsistent build ordering, no shared cache, and no standard artifact discovery for Vercel deployments.

Vercel recommends running `turbo build` for Turborepo-based monorepos and requires explicit `outputs` in `turbo.json` so build artifacts are detected even on cache hits. For Next.js apps, `.next/cache/**` must be excluded from outputs to avoid bloated caches and redundant caching.

## Decision

Adopt Turborepo as the primary task orchestrator for the monorepo by:

- Adding a root `turbo.json` with explicit `tasks.build.outputs` and env hashing.
- Using Turbo for build and dev orchestration (`turbo build`, `turbo dev`).
- Using root tasks for Biome and Vitest (`//#lint`, `//#test`) to avoid per-package duplication.
- Setting the Vercel Build Command to `turbo build`.

## Consequences

- Faster, deterministic builds with shared caching across packages.
- Correct artifact discovery in Vercel, even when build outputs are served from cache.
- Requires consistent task definitions across all workspaces.

## References

```text
Vercel Turborepo monorepos: https://vercel.com/docs/monorepos/turborepo
Vercel Next.js cache exclusion rule: https://vercel.com/docs/conformance/rules/NEXTJS_NO_TURBO_CACHE
Turborepo config reference: https://turborepo.dev/schema.json
Turborepo configuration (tasks): https://turborepo.dev/docs/reference/configuration
Turborepo Biome guide: https://turbo.build/repo/docs/guides/tools/biome
```
