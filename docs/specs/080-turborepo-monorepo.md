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

## 3. Current State

- Root `turbo.json` uses schema v2 with explicit `build` outputs and shared env hashing.
- Root scripts delegate to `turbo run` for all repo-wide tasks.
- Repo-wide lint, typecheck, test, and fix tasks live in `@codex-toolloop/repo-tasks`.

## 4. Requirements

### 4.1 Root `turbo.json` (Required)

Create `turbo.json` at the repo root with:

- `tasks.build.outputs` set to framework artifact directories.
- `.next/cache/**` excluded from outputs when Next.js is present.
- `dependsOn: ["^build"]` for build to ensure dependency ordering.
- `env`/`globalEnv` to ensure cache keys reflect environment-specific builds.
- Repo-wide lint/test/typecheck handled via a dedicated `@codex-toolloop/repo-tasks` package.
- `globalDependencies` including lockfiles and `tsconfig.json` so dependency/config changes invalidate caches.
- Avoid `.env` in `globalDependencies`; list explicit vars in `globalEnv`.

Baseline configuration:

```json
{
  "$schema": "https://turborepo.dev/schema.v2.json",
  "globalDependencies": [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json"
  ],
  "globalEnv": ["NODE_ENV", "VERCEL_ENV", "CI"],
  "globalPassThroughEnv": ["CI", "GITHUB_TOKEN", "TURBO_TEAM", "TURBO_TOKEN"],
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
    "lint": { "outputs": [] },
    "typecheck": { "outputs": [] },
    "test": { "outputs": [] },
    "format": { "cache": false, "outputs": [] },
    "fix": { "cache": false, "outputs": [] },
    "codex:protocol:gen": { "outputs": [] },
    "codex:schema:gen": { "outputs": [] },
    "codex:gen": { "outputs": [] },
    "codex:gen:check": { "cache": false, "outputs": [] }
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

- `build`: `turbo run build`
- `dev`: `turbo run dev`
- `lint`: `turbo run lint`
- `typecheck`: `turbo run typecheck`
- `test`: `turbo run test`
- `format`: `turbo run format`
- `fix`: `turbo run fix`
- `codex:protocol:gen`: `turbo run codex:protocol:gen`
- `codex:schema:gen`: `turbo run codex:schema:gen`
- `codex:gen`: `turbo run codex:gen`
- `codex:gen:check`: `turbo run codex:gen:check`

### 4.3 Turbo Dependency (Recommended)

Add `turbo` to root `devDependencies` so local and CI builds match Vercel behavior.

- Required version: `^2.7.5`.

### 4.4 Remote Cache (Required)

Remote Caching is automatically enabled on Vercel for organizations with Turborepo enabled; team owners can toggle it in Vercel settings.

Enable signed remote cache uploads on Vercel and CI by setting:

```bash
vercel env add TURBO_REMOTE_CACHE_SIGNATURE_KEY
```

Ensure Remote Caching is enabled for the Vercel team, and configure CI secrets:

```bash
TURBO_TEAM
TURBO_TOKEN
```

Reference: [Vercel Remote Caching](https://vercel.com/docs/monorepos/remote-caching)

#### Local development setup

1) Enable Remote Caching in Vercel:
   - Vercel Dashboard → select team → Settings → Billing → Remote Caching → enable.
2) Authenticate and link from the repo root:

```bash
pnpm dlx turbo login
pnpm dlx turbo link
```

That is all that is required to use Vercel Remote Cache for local development.

If your team uses SSO, pass the team slug when logging in:

```bash
pnpm dlx turbo login --sso-team=team-slug
```

#### GitHub Actions setup

1) Create a Vercel Access Token and store it as a GitHub Actions secret:
   - Name: `TURBO_TOKEN`
   - Recommended: use a dedicated token for CI and rotate it periodically (UNVERIFIED).
2) Add your Vercel team slug as a GitHub Actions repository variable:
   - Name: `TURBO_TEAM`
   - Value: the slug after `vercel.com/` in your team URL (example: `vercel.com/acme` → `acme`)
3) Expose both variables to the Turbo job in `.github/workflows/ci.yml`:

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Reference: [Turborepo GitHub Actions](https://turborepo.dev/docs/guides/ci-vendors/github-actions)

### 4.5 Package Task Parity (Required)

Each workspace package must implement any task invoked by Turbo:

- `build` required for any package participating in `turbo run build`.
- `test`, `lint`, `typecheck`, `format`, `fix`, `codex:protocol:gen`, `codex:schema:gen`, `codex:gen`, and `codex:gen:check` are implemented in `@codex-toolloop/repo-tasks`.

### 4.6 Vercel Build Command (Required)

Set the Vercel Project Build Command to:

```bash
turbo run build
```

Root Directory should remain the monorepo root unless a subproject deploy is intended.

### 4.7 CI (Required)

- Run all repo-wide tasks via Turbo in a single CI job.
- On pull requests, use `--filter=...[origin/<base-branch>]` to skip unaffected packages and include dependents.
- Always run full tasks on `main` pushes.

## 5. Verification

- Local: `turbo run build` should populate cache in `node_modules/.cache/turbo`.
- Local: `turbo run lint` and `turbo run test` should execute the repo-tasks package.
- Local: `turbo run codex:gen:check` should pass with no diff.
- Vercel: build should succeed with correct outputs detected on cache hits.

## 6. References

- [Vercel Turborepo monorepos](https://vercel.com/docs/monorepos/turborepo)
- [Vercel Next.js cache exclusion rule](https://vercel.com/docs/conformance/rules/NEXTJS_NO_TURBO_CACHE)
- [Turborepo config reference](https://turborepo.dev/schema.v2.json)
- [Turborepo env hashing](https://github.com/vercel/turborepo/blob/main/docs/site/content/docs/crafting-your-repository/using-environment-variables.mdx)
- [Turborepo Biome guide](https://turbo.build/repo/docs/guides/tools/biome)
- [Turborepo config (tasks vs pipeline)](https://turborepo.dev/docs/reference/configuration)
- [Vercel remote caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Turborepo remote cache signature](https://docs.vercel.com/docs/rest-api/reference/endpoints/artifacts/upload-a-cache-artifact)
- [Vercel Remote Caching (setup)](https://vercel.com/docs/monorepos/remote-caching)
