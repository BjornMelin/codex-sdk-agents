# Getting started

## Install

```bash
bun install
```

## Authenticate

Two common setups:

- Log in once for interactive use: `codex login`
- Provide an API key for automation (and for SDK runs that set an explicit key): set `CODEX_API_KEY` (or `OPENAI_API_KEY`) via `.env`

## Run examples

```bash
bun run examples:basic
bun run examples:stream
bun run examples:structured
```

## Run checks

```bash
bun run check
```
