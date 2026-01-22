---
adr: ADR-0010
title: Standardize Turborepo configuration for the monorepo
spec: SPEC-080
status: Accepted (2026-01-22)
---

## Context

The repository is a pnpm workspace monorepo with multiple packages and apps. Builds are currently driven by root `tsc` and package-level scripts without a centralized task graph. This creates inconsistent build ordering, no shared cache, and no standard artifact discovery for Vercel deployments.

Vercel recommends running `turbo build` for Turborepo-based monorepos and requires explicit `outputs` in `turbo.json` so build artifacts are detected even on cache hits. For Next.js apps, `.next/cache/**` must be excluded from outputs to avoid bloated caches and redundant caching.

## Decision

Adopt Turborepo as the primary task orchestrator for the monorepo by:

- Adding a root `turbo.json` with explicit `pipeline.build.outputs` and env hashing.
- Standardizing root scripts to use Turbo (`turbo build`, `turbo test`, `turbo lint`, `turbo dev`).
- Aligning workspace package scripts with Turbo pipeline tasks.
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
```
