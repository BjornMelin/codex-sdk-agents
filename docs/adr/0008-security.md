# ADR 0008: Layered safety controls (Codex approvals + sandbox + tool allowlists)

## Status

Accepted

## Context

Codex ToolLoop can execute commands and modify code. Safety is critical:

- Avoid accidental destructive actions.
- Avoid secrets leaking into logs.
- Avoid untrusted MCP servers.

Codex provides:

- sandbox policies
- approval policies

MCP introduces:

- tool servers that may access network or external systems.

## Decision

Codex ToolLoop implements layered controls:

1. Codex sandbox mode defaults to `workspace-write`.
2. Codex approval mode defaults to `on-failure`.
3. Codex ToolLoop enforces MCP tool allowlists per workflow and per role.
4. Codex ToolLoop includes a “dangerous operations policy”:
   - blocks certain commands by default (rm -rf, curl | sh, etc.)
   - requires explicit opt-in for network-crawling tools
5. Codex ToolLoop stores sensitive artifacts carefully:
   - never store env vars
   - redact known secret patterns and tokens
   - allow user-controlled “sensitive run” mode where logs are minimal

## Alternatives considered

1. Full auto, no restrictions

- Pros: fastest
- Cons: unacceptable safety risk

1. Always require approvals

- Pros: safest
- Cons: kills autonomy for long workflows

## Consequences

- Balanced autonomy with controlled risk.
- Clear, explicit opt-in for dangerous behaviors.

## Implementation notes

- Provide config profiles:
  - `safe` (read-only + approvals)
  - `balanced` (workspace-write + on-failure)
  - `autonomous` (workspace-write + never)
  - `danger` (danger-full-access + never, explicit flag required)
