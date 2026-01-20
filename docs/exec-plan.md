# ExecPlan pattern (longer tasks)

For multi-hour or multi-day work (migrations, large refactors, modernization), treat planning as a first-class artifact.

## When to use an ExecPlan

Use an ExecPlan when:

- the task spans multiple PRs or releases
- correctness requires explicit parity/validation steps
- you need an auditable record of decisions and tradeoffs

## Minimal template

```md
# ExecPlan: <short name>

## Goal
What changes, and why.

## Scope
- In scope:
- Out of scope:

## Constraints
- Permissions / sandbox assumptions:
- Non-goals:

## Plan
1. Inventory (files, commands, diagrams)
2. Design/spec (interfaces, expected behavior)
3. Implementation
4. Verification (tests, comparison strategy)

## Validation
- How to prove correctness
- How to detect regressions

## Risks
- Highest-risk assumptions
- Rollback plan

## Decision log
- <date>: <decision> (reason)
```

## References

- `docs/reference/non-interactive.md` (automation patterns)
- Codex cookbook on modernization and planning (see OpenAI Cookbook “Modernizing your Codebase with Codex”)

