---
adr: ADR-0010
title: Standardize Turborepo configuration for the monorepo
spec: SPEC-080
status: Implemented (2026-01-22)
---

## Context

The repository is a pnpm workspace monorepo with multiple packages and apps. Builds are currently driven by root `tsc` and package-level scripts without a centralized task graph. This creates inconsistent build ordering, no shared cache, and no standard artifact discovery for Vercel deployments.

Vercel recommends running `turbo run build` for Turborepo-based monorepos and requires explicit `outputs` in `turbo.json` so build artifacts are detected even on cache hits. For Next.js apps, `.next/cache/**` must be excluded from outputs to avoid bloated caches and redundant caching.

## Decision

Adopt Turborepo as the primary task orchestrator for the monorepo by:

- Adding a root `turbo.json` with explicit `tasks.build.outputs` and env hashing.
- Using Turbo for build and dev orchestration (`turbo run build`, `turbo run dev`).
- Centralizing repo-wide lint, typecheck, and test tasks in a dedicated `@codex-toolloop/repo-tasks` package to avoid root tasks.
- Running Codex protocol generation tasks through Turbo for cacheable, deterministic codegen.
- Setting the Vercel Build Command to `turbo run build`.
- Including lockfiles/configs in `globalDependencies` to invalidate caches on dependency changes.
- Enforcing Turbo Remote Cache for CI to share artifacts and speed up builds.

## Consequences

- Faster, deterministic builds with shared caching across packages.
- Correct artifact discovery in Vercel, even when build outputs are served from cache.
- Requires consistent task definitions across all workspaces.

## References

Vercel Turborepo monorepos: <https://vercel.com/docs/monorepos/turborepo>
Vercel Next.js cache exclusion rule: <https://vercel.com/docs/conformance/rules/NEXTJS_NO_TURBO_CACHE>
Turborepo config reference: <https://turborepo.dev/schema.v2.json>
Turborepo configuration (tasks): <https://turborepo.dev/docs/reference/configuration>
Turborepo Biome guide: <https://turbo.build/repo/docs/guides/tools/biome>
Vercel remote cache signature: <https://vercel.com/docs/integrations/ecommerce/bigcommerce>
