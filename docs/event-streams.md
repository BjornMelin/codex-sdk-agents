# Event streams (JSONL)

Codex emits newline-delimited JSON “thread events”. Each event has a `type` and, for item events, an `item` payload.

## Event types

Common top-level events:

- `thread.started`
- `turn.started`
- `turn.completed`
- `turn.failed`
- `item.started`
- `item.updated`
- `item.completed`
- `error`

## Item types you should handle

In practice, workflows usually care about:

- `agent_message` (final response)
- `command_execution` (command, output, exit code, status)
- `file_change` (what changed and whether apply succeeded)
- `mcp_tool_call` (server/tool, arguments, result/error)
- `web_search`
- `todo_list` (plan updates)

## In this repo

- Streaming example: `examples/stream.ts`
- Source-derived item definitions: `docs/reference/codex-exec.md`
- SDK item types: see `ThreadEvent` and `ThreadItem` in `@openai/codex-sdk`
