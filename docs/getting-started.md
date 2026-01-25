# Getting started

## Requirements

- Node.js v24 LTS (ADR 0001)
- pnpm (via Corepack)
- OpenAI Codex CLI (`codex`)

## Install

```bash
pnpm install
```

## Authenticate

Two common setups:

- Log in once for interactive use: `codex login`
- Provide an API key for automation (and for SDK runs that set an explicit key): set `CODEX_API_KEY` (or `OPENAI_API_KEY`) via `.env`

## Run examples

```bash
pnpm examples:basic
pnpm examples:stream
pnpm examples:structured
```

## Run checks

```bash
pnpm -s check
```
