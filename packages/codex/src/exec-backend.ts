import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import type {
  CodexBackend,
  CodexEventHandler,
  CodexRunOptions,
  CodexRunResult,
} from "./backend.js";
import { CodexBackendError } from "./backend.js";
import { DEFAULT_CODEX_MODEL } from "./constants.js";
import type { CodexEvent } from "./events.js";
import {
  createThreadEventMapper,
  parseThreadEventLike,
} from "./exec-events.js";
import type { JsonValue } from "./types.js";
import { jsonStringify } from "./types.js";

/**
 * Configuration for the exec backend subprocess runner.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type ExecBackendConfig = {
  /**
   * Command used to launch codex. Defaults to "codex".
   * Tests can override this with `process.execPath` and `commandArgsPrefix`.
   */
  command?: string;

  /**
   * Extra args inserted before "exec" (useful for a node-based mock codex).
   */
  commandArgsPrefix?: readonly string[];
};

/**
 * Build the `codex exec` argument list for a run.
 *
 * @param prompt - User prompt passed to the CLI.
 * @param options - Run options converted to CLI flags.
 * @returns CLI argument vector for `codex exec --json`.
 * @see docs/specs/020-codex-backends.md
 */
export function buildCodexExecArgs(
  prompt: string,
  options: CodexRunOptions,
): readonly string[] {
  const cwd = options.cwd ?? process.cwd();
  const args: string[] = ["exec", "--json"];

  // Global flags should be placed after the subcommand (codex docs guidance).
  args.push("--cd", cwd);

  const modelId = options.model ?? DEFAULT_CODEX_MODEL;
  args.push("--model", modelId);

  if (options.approvalMode) {
    args.push("--ask-for-approval", options.approvalMode);
  }
  if (options.sandboxMode) {
    args.push("--sandbox", options.sandboxMode);
  }

  // Config overrides.
  const configOverrides: Record<string, JsonValue> = {
    ...(options.configOverrides ?? {}),
  };

  if (options.reasoningEffort) {
    configOverrides.model_reasoning_effort = options.reasoningEffort;
  }
  if (options.skipGitRepoCheck) {
    configOverrides.skip_git_repo_check = true;
  }

  if (options.mcpServers) {
    for (const [serverId, cfg] of Object.entries(options.mcpServers)) {
      const prefix = `mcp_servers.${serverId}.`;
      if (cfg.command) {
        configOverrides[`${prefix}command`] = cfg.command;
      }
      if (cfg.args) {
        configOverrides[`${prefix}args`] = [...cfg.args];
      }
      if (cfg.cwd) {
        configOverrides[`${prefix}cwd`] = cfg.cwd;
      }
      if (cfg.env) {
        configOverrides[`${prefix}env`] = cfg.env;
      }
      if (cfg.url) {
        configOverrides[`${prefix}url`] = cfg.url;
      }
      if (cfg.httpHeaders) {
        configOverrides[`${prefix}http_headers`] = cfg.httpHeaders;
      }
    }
  }

  for (const [key, value] of Object.entries(configOverrides)) {
    args.push("--config", `${key}=${jsonStringify(value)}`);
  }

  // Output schema / last message output.
  // These flags are appended by ExecBackend once it has written temp schema/output files.

  args.push(prompt);
  return args;
}

function createTimeoutSignal(
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  if (!timeoutMs || timeoutMs <= 0) {
    return undefined;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  return controller.signal;
}

function mergeSignals(
  a: AbortSignal | undefined,
  b: AbortSignal | undefined,
): AbortSignal | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      a.removeEventListener("abort", onAbort);
      b.removeEventListener("abort", onAbort);
    },
    { once: true },
  );
  if (a.aborted || b.aborted) {
    controller.abort();
  }
  return controller.signal;
}

function tail(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(text.length - maxChars);
}

/**
 * CLI-backed Codex runner that streams JSONL events.
 *
 * @see docs/specs/020-codex-backends.md
 */
export class ExecBackend implements CodexBackend {
  public readonly kind = "exec" as const;

  private readonly command: string;
  private readonly commandArgsPrefix: readonly string[];

  public constructor(config: ExecBackendConfig = {}) {
    this.command = config.command ?? "codex";
    this.commandArgsPrefix = config.commandArgsPrefix ?? [];
  }

  public async run(
    prompt: string,
    options: CodexRunOptions,
    onEvent?: CodexEventHandler,
  ): Promise<CodexRunResult> {
    const cwd = options.cwd ?? process.cwd();
    const env = { ...process.env, ...(options.env ?? {}) };
    const mapper = createThreadEventMapper(this.kind);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "codex-toolloop-"));
    let outputPath: string | undefined;

    const command = options.codexPath ?? this.command;
    const commandArgsPrefix = options.codexArgsPrefix ?? this.commandArgsPrefix;

    try {
      const baseArgs = buildCodexExecArgs(prompt, options);
      const args: string[] = [...commandArgsPrefix, ...baseArgs];

      // Exec-only schema + output path.
      if (options.outputSchemaJson) {
        const schemaPath = path.join(tmpDir, "output-schema.json");
        await writeFile(
          schemaPath,
          JSON.stringify(options.outputSchemaJson, null, 2),
          "utf8",
        );
        args.splice(args.length - 1, 0, "--output-schema", schemaPath);
      }

      if (options.outputSchemaJson || options.outputPath) {
        outputPath =
          options.outputPath ?? path.join(tmpDir, "output-last-message.json");
        // `--output-last-message` is also exposed as `-o`.
        args.splice(args.length - 1, 0, "--output-last-message", outputPath);
      }

      const timeoutSignal = createTimeoutSignal(options.timeoutMs);
      const signal = mergeSignals(options.signal, timeoutSignal);
      let child: ReturnType<typeof spawn> | undefined;

      const emit = async (event: CodexEvent) => {
        if (!onEvent) {
          return;
        }
        await onEvent(event);
      };

      const stop = async (reason: string) => {
        // Best-effort graceful stop.
        try {
          child?.kill("SIGTERM");
        } catch {
          // ignore
        }
        await emit({
          type: "codex.error",
          backend: this.kind,
          timestampMs: Date.now(),
          message: reason,
        });
      };

      if (signal) {
        if (signal.aborted) {
          await stop("Aborted before completion");
          return {
            backend: this.kind,
            model: options.model ?? DEFAULT_CODEX_MODEL,
            text: "",
          };
        } else {
          signal.addEventListener("abort", () => {
            void stop("Aborted");
          });
        }
      }

      child = spawn(command, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      if (!child.stdout || !child.stderr) {
        throw new CodexBackendError("codex exec did not provide stdio pipes");
      }

      const stdout = child.stdout;
      const stderr = child.stderr;

      let stdoutTail = "";
      let stderrTail = "";

      stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderrTail = tail(`${stderrTail}${text}`, 8_000);
        if (onEvent) {
          void emit({
            type: "codex.exec.stderr",
            backend: this.kind,
            timestampMs: Date.now(),
            line: text.trimEnd(),
          });
        }
      });

      const rl = createInterface({ input: stdout });

      let lastText = "";
      let threadId: string | undefined;
      let turnId: string | undefined;

      for await (const line of rl) {
        stdoutTail = tail(`${stdoutTail}\n${line}`, 8_000);

        const trimmed = line.trim();
        if (trimmed.length === 0) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed) as unknown;
        } catch {
          if (onEvent) {
            await emit({
              type: "codex.exec.stdout",
              backend: this.kind,
              timestampMs: Date.now(),
              line: trimmed,
            });
          }
          continue;
        }

        const threadEvent = parseThreadEventLike(parsed);
        if (!threadEvent) {
          continue;
        }

        if (threadEvent.thread_id) {
          threadId = threadEvent.thread_id;
        }
        if (threadEvent.turn_id) {
          turnId = threadEvent.turn_id;
        }

        const mapped = mapper(threadEvent);
        for (const e of mapped) {
          if (e.type === "codex.message.delta") {
            lastText += e.textDelta;
          }
          if (e.type === "codex.message.completed") {
            lastText = e.text;
          }
          await emit(e);
        }
      }

      const exitCode: number = await new Promise((resolve, reject) => {
        child.on("error", (err) => reject(err));
        child.on("close", (code) => resolve(code ?? 0));
      });

      let structured: JsonValue | undefined;
      if (outputPath) {
        const out = await readFile(outputPath, "utf8").catch(() => undefined);
        if (out !== undefined) {
          try {
            structured = JSON.parse(out) as JsonValue;
          } catch {
            // Not JSON, keep as a string.
            structured = out;
          }
        }
      }

      if (exitCode !== 0) {
        throw new CodexBackendError(`codex exec exited with code ${exitCode}`, {
          exitCode,
          stderrTail,
          stdoutTail,
        });
      }

      return {
        backend: this.kind,
        model: options.model ?? DEFAULT_CODEX_MODEL,
        text: lastText,
        exitCode,
        ...(threadId !== undefined ? { threadId } : {}),
        ...(turnId !== undefined ? { turnId } : {}),
        ...(structured !== undefined ? { structured } : {}),
      };
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}
