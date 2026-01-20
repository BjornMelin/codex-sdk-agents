# Automation recipes

This page collects copy/paste patterns that work well for agentic coding workflows.

## Non-interactive “analysis only” run (CLI)

```bash
codex exec --sandbox read-only --ask-for-approval never \
  "Summarize the repo and list top risks."
```

## Capture a full audit trail (JSONL)

```bash
codex exec --json --sandbox read-only --ask-for-approval never \
  "List the top 10 files to understand first." \
  | tee codex-events.jsonl
```

## Require a structured final output (CLI)

```bash
cat > schema.json <<'JSON'
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "risk_level": { "type": "string", "enum": ["low", "medium", "high"] }
  },
  "required": ["summary", "risk_level"],
  "additionalProperties": false
}
JSON

codex exec --output-schema ./schema.json -o ./result.json \
  "Assess this repo and output JSON."
```

## Two-stage pipelines (resume)

```bash
codex exec "Review the change for race conditions"
codex exec resume --last "Fix the issues you found"
```

## Programmatic (SDK) with streaming events

See `examples/stream.ts`.

## Programmatic (SDK) with structured output

See `examples/review.ts` and `docs/structured-outputs.md`.

