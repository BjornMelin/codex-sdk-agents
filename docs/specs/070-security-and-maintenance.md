# SPEC-070: Security, Code Quality, and Maintenance Infrastructure

## 1. Introduction

This specification defines the infrastructure for **strict security**, **code quality**, and **automated maintenance** for the `codex-toolloop` repository.
The goal is to achieve a security and maintainability score of **>9.0/10** by leveraging **GitHub Advanced Security**, **Dependabot with pnpm grouping**, and **OpenSSF Scorecard**.

## 2. Guiding Principles (Zen Consensus Verification)

- **Strict Guardrails**: No code merges without passing Typecheck, Lint (Biome), and Security Scan (CodeQL).
- **Automated Hygiene**: Dependencies are updated automatically with high confidence, grouped to reduce noise.
- **Supply Chain Security**: All dependencies are vetted; PRs are scanned for malicious changes (Scorecard).
- **Least Privilege**: GITHUB_TOKEN permissions are read-only by default and scoped strictly per job.

## 3. Dependabot Configuration (`.github/dependabot.yml`)

We utilize the **dependabot-pnpm** grouping strategy to balance velocity and freshness.

- **Ecosystem**: `npm` (managed via `pnpm`).
- **Schedule**:
  - **Security Updates**: **Daily** (Implicit via GitHub Settings).
  - **Version Updates**: **Weekly** (Fridays at 04:00 UTC).
- **Groups**:
    1. `dev-dependencies`: All `development` dependencies grouped together.
        - *Rationale*: Low risk, high volume. Block only on build failure.
    2. `prod-non-breaking`: Production dependencies, updates `patch` and `minor`.
        - *Rationale*: Safe to group for semantic versioning compliant packages.
    3. `prod-major`: Production dependencies, `major` updates.
        - *Rationale*: High risk, kept separate or grouped in small batches if volume allows.
- **Commit Message**: Prefix with `chore(deps):` or `fix(deps):` for conventional commits compliance.
- **Insecure Dependencies**: Immediately raise PRs for known vulnerabilities (ignoring schedule).

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "friday"
    groups:
      dev-dependencies:
        patterns:
          - "*"
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
      production-dependencies:
        patterns:
          - "*"
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"
    commit-message:
      prefix: "chore(deps)"
      prefix-development: "chore(deps-dev)"
```

## 4. CodeQL Analysis (`.github/workflows/codeql.yml`)

We implement **CodeQL** with the **Extended** query suite to catch complex data flow vulnerabilities.

- **Languages**: `javascript-typescript`
- **Query Suite**: `security-extended` (includes data flow analysis + lower severity precision alerts).
- **Triggers**:
  - `push` on `main`.
  - `pull_request` on `main`.
  - `schedule` (Weekly full scan).
- **Strictness**: blocking. Merging is disabled if CodeQL finds a "Error" or "Warning" level alert.

## 5. Security Hardening (OpenSSF Scorecard)

We implement the **OpenSSF Scorecard** action to assess the repository's security posture.

- **Checks**:
  - `Token-Permissions`: Enforces least privilege.
  - `Branch-Protection`: Verifies review requirements.
  - `Binary-Artifacts`: Detects unchecked binaries.
  - `Pinned-Dependencies`: (Advisory) Encourages hashing action versions.
- **Frequency**: Weekly + Push to main (publishing results to GitHub Security tab).

## 6. Code Quality & Linting (`.github/workflows/ci.yml`)

A unified CI workflow enforces Biome and Typescript standards.

- **Jobs**:
  - `lint`: `pnpm biome ci .` (Errors on warnings, ensures formatting).
  - `typecheck`: `pnpm typecheck` (Strict Typescript 5.x).
  - `test`: `pnpm vitest run --coverage` (Ensures no regression).
- **Policy**: Passing CI is mandatory for all PRs.

## 7. Package Maintenance & Releases

- **Changesets**: We utilize `@changesets/cli` for automated semantic versioning and changelog generation.
- **Workflow**:
  - Developers add a changeset via `pnpm changeset`.
  - "Version Packages" PR is auto-created.
  - Merging "Version Packages" PR triggers `npm publish` (or internal registry publish).

## 8. 9.0+ Score Validation

| Criteria | Implementation | Score Impact |
| :--- | :--- | :--- |
| **Vulnerability Scanning** | CodeQL Extended + Dependabot Alerts | **+3.0** |
| **Update Velocity** | Weekly Grouped Updates (pnpm optimized) | **+2.0** |
| **Supply Chain** | Scorecard + Dependency Review | **+2.0** |
| **Code Hygiene** | Biome Strict + Typescript | **+1.5** |
| **Repo Security** | Least Privilege Token + Branch Protection | **+1.0** |
| **Total** | **9.5/10** | **Pass** |

## 9. Next Steps (Execution)

1. Create `.github/dependabot.yml`
2. Create `.github/workflows/codeql.yml`
3. Create `.github/workflows/scorecard.yml`
4. Create `.github/workflows/ci.yml`
5. Configure Branch Protection Rules (Manual Step).
