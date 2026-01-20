# MCP (Model Context Protocol)

Codex can both:

- **call MCP tools** (you’ll see `mcp_tool_call` items in JSONL streams), and
- **run as an MCP server** so other agents can invoke Codex as a tool.

## Manage MCP servers

Use `codex mcp` to list/add/remove MCP servers stored in `~/.codex/config.toml`.

See: `docs/reference/cli-options.md`

## Run Codex as an MCP server

Run:

```bash
codex mcp-server
```

This starts Codex over stdio so another process can connect and use it as a tool.

## Why this matters for workflows

This is the cleanest way to orchestrate multi-step development flows from an external runner:

- the runner coordinates “who does what” (planner/reviewer/executor roles)
- Codex handles scoped coding tasks inside each step
- you still get structured output + an audit trail (JSONL events)

## References

- OpenAI Cookbook: “Building Consistent Workflows with Codex CLI & Agents SDK”
- `docs/reference/codex-exec.md` (MCP tool calls appear as items)

