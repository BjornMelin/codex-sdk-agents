# `@codex-toolloop/codex-app-server-protocol`

This package provides TypeScript types and schemas for communication between Codex clients and the Codex app-server, enabling type-safe integration with the Codex code-generation platform. Types are automatically generated from the pinned Codex CLI version to ensure protocol compatibility. Use this package whenever you need to interact with app-server endpoints, validate JSON-RPC messages, or build client libraries on top of the Codex protocol.

## References

- ADR 0013: `docs/adr/0013-codex-app-server-protocol-types.md`
- SPEC 023: `docs/specs/023-codex-app-server-protocol.md`
- Guide: `docs/codex-app-server-protocol.md`

## Regenerate protocol types

From repo root:

```bash
pnpm install
pnpm codex:protocol:gen
```

Notes:

- Generated files live under `src/generated/`.
- Do not hand-edit generated files; regenerate instead.
