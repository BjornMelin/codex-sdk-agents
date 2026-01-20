This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: sdk/typescript/
- Files matching these patterns are excluded: sdk/typescript/tests/
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

</file_summary>

<directory_structure>
sdk/
  typescript/
    samples/
      basic_streaming.ts
      helpers.ts
      structured_output_zod.ts
      structured_output.ts
    src/
      codex.ts
      codexOptions.ts
      events.ts
      exec.ts
      index.ts
      items.ts
      outputSchemaFile.ts
      thread.ts
      threadOptions.ts
      turnOptions.ts
    .prettierignore
    .prettierrc
    eslint.config.js
    jest.config.cjs
    package.json
    README.md
    tsconfig.json
    tsup.config.ts
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path="sdk/typescript/samples/basic_streaming.ts">
#!/usr/bin/env -S NODE_NO_WARNINGS=1 pnpm ts-node-esm --files

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Codex } from "@openai/codex-sdk";
import type { ThreadEvent, ThreadItem } from "@openai/codex-sdk";
import { codexPathOverride } from "./helpers.ts";

const codex = new Codex({ codexPathOverride: codexPathOverride() });
const thread = codex.startThread();
const rl = createInterface({ input, output });

const handleItemCompleted = (item: ThreadItem): void => {
  switch (item.type) {
    case "agent_message":
      console.log(`Assistant: ${item.text}`);
      break;
    case "reasoning":
      console.log(`Reasoning: ${item.text}`);
      break;
    case "command_execution": {
      const exitText = item.exit_code !== undefined ? ` Exit code ${item.exit_code}.` : "";
      console.log(`Command ${item.command} ${item.status}.${exitText}`);
      break;
    }
    case "file_change": {
      for (const change of item.changes) {
        console.log(`File ${change.kind} ${change.path}`);
      }
      break;
    }
  }
};

const handleItemUpdated = (item: ThreadItem): void => {
  switch (item.type) {
    case "todo_list": {
      console.log(`Todo:`);
      for (const todo of item.items) {
        console.log(`\t ${todo.completed ? "x" : " "} ${todo.text}`);
      }
      break;
    }
  }
};

const handleEvent = (event: ThreadEvent): void => {
  switch (event.type) {
    case "item.completed":
      handleItemCompleted(event.item);
      break;
    case "item.updated":
    case "item.started":
      handleItemUpdated(event.item);
      break;
    case "turn.completed":
      console.log(
        `Used ${event.usage.input_tokens} input tokens, ${event.usage.cached_input_tokens} cached input tokens, ${event.usage.output_tokens} output tokens.`,
      );
      break;
    case "turn.failed":
      console.error(`Turn failed: ${event.error.message}`);
      break;
  }
};

const main = async (): Promise<void> => {
  try {
    while (true) {
      const inputText = await rl.question(">");
      const trimmed = inputText.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const { events } = await thread.runStreamed(inputText);
      for await (const event of events) {
        handleEvent(event);
      }
    }
  } finally {
    rl.close();
  }
};

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Unexpected error: ${message}`);
  process.exit(1);
});
</file>

<file path="sdk/typescript/samples/helpers.ts">
import path from "node:path";

export function codexPathOverride() {
  return (
    process.env.CODEX_EXECUTABLE ??
    path.join(process.cwd(), "..", "..", "codex-rs", "target", "debug", "codex")
  );
}
</file>

<file path="sdk/typescript/samples/structured_output_zod.ts">
#!/usr/bin/env -S NODE_NO_WARNINGS=1 pnpm ts-node-esm --files

import { Codex } from "@openai/codex-sdk";
import { codexPathOverride } from "./helpers.ts";
import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const codex = new Codex({ codexPathOverride: codexPathOverride() });
const thread = codex.startThread();

const schema = z.object({
  summary: z.string(),
  status: z.enum(["ok", "action_required"]),
});

const turn = await thread.run("Summarize repository status", {
  outputSchema: zodToJsonSchema(schema, { target: "openAi" }),
});
console.log(turn.finalResponse);
</file>

<file path="sdk/typescript/samples/structured_output.ts">
#!/usr/bin/env -S NODE_NO_WARNINGS=1 pnpm ts-node-esm --files

import { Codex } from "@openai/codex-sdk";

import { codexPathOverride } from "./helpers.ts";

const codex = new Codex({ codexPathOverride: codexPathOverride() });

const thread = codex.startThread();

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
} as const;

const turn = await thread.run("Summarize repository status", { outputSchema: schema });
console.log(turn.finalResponse);
</file>

<file path="sdk/typescript/src/codex.ts">
import { CodexOptions } from "./codexOptions";
import { CodexExec } from "./exec";
import { Thread } from "./thread";
import { ThreadOptions } from "./threadOptions";

/**
 * Codex is the main class for interacting with the Codex agent.
 *
 * Use the `startThread()` method to start a new thread or `resumeThread()` to resume a previously started thread.
 */
export class Codex {
  private exec: CodexExec;
  private options: CodexOptions;

  constructor(options: CodexOptions = {}) {
    this.exec = new CodexExec(options.codexPathOverride, options.env);
    this.options = options;
  }

  /**
   * Starts a new conversation with an agent.
   * @returns A new thread instance.
   */
  startThread(options: ThreadOptions = {}): Thread {
    return new Thread(this.exec, this.options, options);
  }

  /**
   * Resumes a conversation with an agent based on the thread id.
   * Threads are persisted in ~/.codex/sessions.
   *
   * @param id The id of the thread to resume.
   * @returns A new thread instance.
   */
  resumeThread(id: string, options: ThreadOptions = {}): Thread {
    return new Thread(this.exec, this.options, options, id);
  }
}
</file>

<file path="sdk/typescript/src/codexOptions.ts">
export type CodexOptions = {
  codexPathOverride?: string;
  baseUrl?: string;
  apiKey?: string;
  /**
   * Environment variables passed to the Codex CLI process. When provided, the SDK
   * will not inherit variables from `process.env`.
   */
  env?: Record<string, string>;
};
</file>

<file path="sdk/typescript/src/events.ts">
// based on event types from codex-rs/exec/src/exec_events.rs

import type { ThreadItem } from "./items";

/** Emitted when a new thread is started as the first event. */
export type ThreadStartedEvent = {
  type: "thread.started";
  /** The identifier of the new thread. Can be used to resume the thread later. */
  thread_id: string;
};

/**
 * Emitted when a turn is started by sending a new prompt to the model.
 * A turn encompasses all events that happen while the agent is processing the prompt.
 */
export type TurnStartedEvent = {
  type: "turn.started";
};

/** Describes the usage of tokens during a turn. */
export type Usage = {
  /** The number of input tokens used during the turn. */
  input_tokens: number;
  /** The number of cached input tokens used during the turn. */
  cached_input_tokens: number;
  /** The number of output tokens used during the turn. */
  output_tokens: number;
};

/** Emitted when a turn is completed. Typically right after the assistant's response. */
export type TurnCompletedEvent = {
  type: "turn.completed";
  usage: Usage;
};

/** Indicates that a turn failed with an error. */
export type TurnFailedEvent = {
  type: "turn.failed";
  error: ThreadError;
};

/** Emitted when a new item is added to the thread. Typically the item is initially "in progress". */
export type ItemStartedEvent = {
  type: "item.started";
  item: ThreadItem;
};

/** Emitted when an item is updated. */
export type ItemUpdatedEvent = {
  type: "item.updated";
  item: ThreadItem;
};

/** Signals that an item has reached a terminal state—either success or failure. */
export type ItemCompletedEvent = {
  type: "item.completed";
  item: ThreadItem;
};

/** Fatal error emitted by the stream. */
export type ThreadError = {
  message: string;
};

/** Represents an unrecoverable error emitted directly by the event stream. */
export type ThreadErrorEvent = {
  type: "error";
  message: string;
};

/** Top-level JSONL events emitted by codex exec. */
export type ThreadEvent =
  | ThreadStartedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | ItemStartedEvent
  | ItemUpdatedEvent
  | ItemCompletedEvent
  | ThreadErrorEvent;
</file>

<file path="sdk/typescript/src/exec.ts">
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import {
  SandboxMode,
  ModelReasoningEffort,
  ApprovalMode,
  WebSearchMode,
} from "./threadOptions";

export type CodexExecArgs = {
  input: string;

  baseUrl?: string;
  apiKey?: string;
  threadId?: string | null;
  images?: string[];
  // --model
  model?: string;
  // --sandbox
  sandboxMode?: SandboxMode;
  // --cd
  workingDirectory?: string;
  // --add-dir
  additionalDirectories?: string[];
  // --skip-git-repo-check
  skipGitRepoCheck?: boolean;
  // --output-schema
  outputSchemaFile?: string;
  // --config model_reasoning_effort
  modelReasoningEffort?: ModelReasoningEffort;
  // AbortSignal to cancel the execution
  signal?: AbortSignal;
  // --config sandbox_workspace_write.network_access
  networkAccessEnabled?: boolean;
  // --config web_search
  webSearchMode?: WebSearchMode;
  // legacy --config features.web_search_request
  webSearchEnabled?: boolean;
  // --config approval_policy
  approvalPolicy?: ApprovalMode;
};

const INTERNAL_ORIGINATOR_ENV = "CODEX_INTERNAL_ORIGINATOR_OVERRIDE";
const TYPESCRIPT_SDK_ORIGINATOR = "codex_sdk_ts";

export class CodexExec {
  private executablePath: string;
  private envOverride?: Record<string, string>;

  constructor(executablePath: string | null = null, env?: Record<string, string>) {
    this.executablePath = executablePath || findCodexPath();
    this.envOverride = env;
  }

  async *run(args: CodexExecArgs): AsyncGenerator<string> {
    const commandArgs: string[] = ["exec", "--experimental-json"];

    if (args.model) {
      commandArgs.push("--model", args.model);
    }

    if (args.sandboxMode) {
      commandArgs.push("--sandbox", args.sandboxMode);
    }

    if (args.workingDirectory) {
      commandArgs.push("--cd", args.workingDirectory);
    }

    if (args.additionalDirectories?.length) {
      for (const dir of args.additionalDirectories) {
        commandArgs.push("--add-dir", dir);
      }
    }

    if (args.skipGitRepoCheck) {
      commandArgs.push("--skip-git-repo-check");
    }

    if (args.outputSchemaFile) {
      commandArgs.push("--output-schema", args.outputSchemaFile);
    }

    if (args.modelReasoningEffort) {
      commandArgs.push("--config", `model_reasoning_effort="${args.modelReasoningEffort}"`);
    }

    if (args.networkAccessEnabled !== undefined) {
      commandArgs.push(
        "--config",
        `sandbox_workspace_write.network_access=${args.networkAccessEnabled}`,
      );
    }

    if (args.webSearchMode) {
      commandArgs.push("--config", `web_search="${args.webSearchMode}"`);
    } else if (args.webSearchEnabled === true) {
      commandArgs.push("--config", `web_search="live"`);
    } else if (args.webSearchEnabled === false) {
      commandArgs.push("--config", `web_search="disabled"`);
    }

    if (args.approvalPolicy) {
      commandArgs.push("--config", `approval_policy="${args.approvalPolicy}"`);
    }

    if (args.images?.length) {
      for (const image of args.images) {
        commandArgs.push("--image", image);
      }
    }

    if (args.threadId) {
      commandArgs.push("resume", args.threadId);
    }

    const env: Record<string, string> = {};
    if (this.envOverride) {
      Object.assign(env, this.envOverride);
    } else {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
    }
    if (!env[INTERNAL_ORIGINATOR_ENV]) {
      env[INTERNAL_ORIGINATOR_ENV] = TYPESCRIPT_SDK_ORIGINATOR;
    }
    if (args.baseUrl) {
      env.OPENAI_BASE_URL = args.baseUrl;
    }
    if (args.apiKey) {
      env.CODEX_API_KEY = args.apiKey;
    }

    const child = spawn(this.executablePath, commandArgs, {
      env,
      signal: args.signal,
    });

    let spawnError: unknown | null = null;
    child.once("error", (err) => (spawnError = err));

    if (!child.stdin) {
      child.kill();
      throw new Error("Child process has no stdin");
    }
    child.stdin.write(args.input);
    child.stdin.end();

    if (!child.stdout) {
      child.kill();
      throw new Error("Child process has no stdout");
    }
    const stderrChunks: Buffer[] = [];

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        stderrChunks.push(data);
      });
    }

    const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.once("exit", (code, signal) => {
          resolve({ code, signal });
        });
      },
    );

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        // `line` is a string (Node sets default encoding to utf8 for readline)
        yield line as string;
      }

      if (spawnError) throw spawnError;
      const { code, signal } = await exitPromise;
      if (code !== 0 || signal) {
        const stderrBuffer = Buffer.concat(stderrChunks);
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        throw new Error(`Codex Exec exited with ${detail}: ${stderrBuffer.toString("utf8")}`);
      }
    } finally {
      rl.close();
      child.removeAllListeners();
      try {
        if (!child.killed) child.kill();
      } catch {
        // ignore
      }
    }
  }
}

const scriptFileName = fileURLToPath(import.meta.url);
const scriptDirName = path.dirname(scriptFileName);

function findCodexPath() {
  const { platform, arch } = process;

  let targetTriple = null;
  switch (platform) {
    case "linux":
    case "android":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-unknown-linux-musl";
          break;
        case "arm64":
          targetTriple = "aarch64-unknown-linux-musl";
          break;
        default:
          break;
      }
      break;
    case "darwin":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-apple-darwin";
          break;
        case "arm64":
          targetTriple = "aarch64-apple-darwin";
          break;
        default:
          break;
      }
      break;
    case "win32":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-pc-windows-msvc";
          break;
        case "arm64":
          targetTriple = "aarch64-pc-windows-msvc";
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }

  if (!targetTriple) {
    throw new Error(`Unsupported platform: ${platform} (${arch})`);
  }

  const vendorRoot = path.join(scriptDirName, "..", "vendor");
  const archRoot = path.join(vendorRoot, targetTriple);
  const codexBinaryName = process.platform === "win32" ? "codex.exe" : "codex";
  const binaryPath = path.join(archRoot, "codex", codexBinaryName);

  return binaryPath;
}
</file>

<file path="sdk/typescript/src/index.ts">
export type {
  ThreadEvent,
  ThreadStartedEvent,
  TurnStartedEvent,
  TurnCompletedEvent,
  TurnFailedEvent,
  ItemStartedEvent,
  ItemUpdatedEvent,
  ItemCompletedEvent,
  ThreadError,
  ThreadErrorEvent,
  Usage,
} from "./events";
export type {
  ThreadItem,
  AgentMessageItem,
  ReasoningItem,
  CommandExecutionItem,
  FileChangeItem,
  McpToolCallItem,
  WebSearchItem,
  TodoListItem,
  ErrorItem,
} from "./items";

export { Thread } from "./thread";
export type { RunResult, RunStreamedResult, Input, UserInput } from "./thread";

export { Codex } from "./codex";

export type { CodexOptions } from "./codexOptions";

export type {
  ThreadOptions,
  ApprovalMode,
  SandboxMode,
  ModelReasoningEffort,
  WebSearchMode,
} from "./threadOptions";
export type { TurnOptions } from "./turnOptions";
</file>

<file path="sdk/typescript/src/items.ts">
// based on item types from codex-rs/exec/src/exec_events.rs

import type { ContentBlock as McpContentBlock } from "@modelcontextprotocol/sdk/types.js";

/** The status of a command execution. */
export type CommandExecutionStatus = "in_progress" | "completed" | "failed";

/** A command executed by the agent. */
export type CommandExecutionItem = {
  id: string;
  type: "command_execution";
  /** The command line executed by the agent. */
  command: string;
  /** Aggregated stdout and stderr captured while the command was running. */
  aggregated_output: string;
  /** Set when the command exits; omitted while still running. */
  exit_code?: number;
  /** Current status of the command execution. */
  status: CommandExecutionStatus;
};

/** Indicates the type of the file change. */
export type PatchChangeKind = "add" | "delete" | "update";

/** A set of file changes by the agent. */
export type FileUpdateChange = {
  path: string;
  kind: PatchChangeKind;
};

/** The status of a file change. */
export type PatchApplyStatus = "completed" | "failed";

/** A set of file changes by the agent. Emitted once the patch succeeds or fails. */
export type FileChangeItem = {
  id: string;
  type: "file_change";
  /** Individual file changes that comprise the patch. */
  changes: FileUpdateChange[];
  /** Whether the patch ultimately succeeded or failed. */
  status: PatchApplyStatus;
};

/** The status of an MCP tool call. */
export type McpToolCallStatus = "in_progress" | "completed" | "failed";

/**
 * Represents a call to an MCP tool. The item starts when the invocation is dispatched
 * and completes when the MCP server reports success or failure.
 */
export type McpToolCallItem = {
  id: string;
  type: "mcp_tool_call";
  /** Name of the MCP server handling the request. */
  server: string;
  /** The tool invoked on the MCP server. */
  tool: string;
  /** Arguments forwarded to the tool invocation. */
  arguments: unknown;
  /** Result payload returned by the MCP server for successful calls. */
  result?: {
    content: McpContentBlock[];
    structured_content: unknown;
  };
  /** Error message reported for failed calls. */
  error?: {
    message: string;
  };
  /** Current status of the tool invocation. */
  status: McpToolCallStatus;
};

/** Response from the agent. Either natural-language text or JSON when structured output is requested. */
export type AgentMessageItem = {
  id: string;
  type: "agent_message";
  /** Either natural-language text or JSON when structured output is requested. */
  text: string;
};

/** Agent's reasoning summary. */
export type ReasoningItem = {
  id: string;
  type: "reasoning";
  text: string;
};

/** Captures a web search request. Completes when results are returned to the agent. */
export type WebSearchItem = {
  id: string;
  type: "web_search";
  query: string;
};

/** Describes a non-fatal error surfaced as an item. */
export type ErrorItem = {
  id: string;
  type: "error";
  message: string;
};

/** An item in the agent's to-do list. */
export type TodoItem = {
  text: string;
  completed: boolean;
};

/**
 * Tracks the agent's running to-do list. Starts when the plan is issued, updates as steps change,
 * and completes when the turn ends.
 */
export type TodoListItem = {
  id: string;
  type: "todo_list";
  items: TodoItem[];
};

/** Canonical union of thread items and their type-specific payloads. */
export type ThreadItem =
  | AgentMessageItem
  | ReasoningItem
  | CommandExecutionItem
  | FileChangeItem
  | McpToolCallItem
  | WebSearchItem
  | TodoListItem
  | ErrorItem;
</file>

<file path="sdk/typescript/src/outputSchemaFile.ts">
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type OutputSchemaFile = {
  schemaPath?: string;
  cleanup: () => Promise<void>;
};

export async function createOutputSchemaFile(schema: unknown): Promise<OutputSchemaFile> {
  if (schema === undefined) {
    return { cleanup: async () => {} };
  }

  if (!isJsonObject(schema)) {
    throw new Error("outputSchema must be a plain JSON object");
  }

  const schemaDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-output-schema-"));
  const schemaPath = path.join(schemaDir, "schema.json");
  const cleanup = async () => {
    try {
      await fs.rm(schemaDir, { recursive: true, force: true });
    } catch {
      // suppress
    }
  };

  try {
    await fs.writeFile(schemaPath, JSON.stringify(schema), "utf8");
    return { schemaPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
</file>

<file path="sdk/typescript/src/thread.ts">
import { CodexOptions } from "./codexOptions";
import { ThreadEvent, ThreadError, Usage } from "./events";
import { CodexExec } from "./exec";
import { ThreadItem } from "./items";
import { ThreadOptions } from "./threadOptions";
import { TurnOptions } from "./turnOptions";
import { createOutputSchemaFile } from "./outputSchemaFile";

/** Completed turn. */
export type Turn = {
  items: ThreadItem[];
  finalResponse: string;
  usage: Usage | null;
};

/** Alias for `Turn` to describe the result of `run()`. */
export type RunResult = Turn;

/** The result of the `runStreamed` method. */
export type StreamedTurn = {
  events: AsyncGenerator<ThreadEvent>;
};

/** Alias for `StreamedTurn` to describe the result of `runStreamed()`. */
export type RunStreamedResult = StreamedTurn;

/** An input to send to the agent. */
export type UserInput =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "local_image";
      path: string;
    };

export type Input = string | UserInput[];

/** Respesent a thread of conversation with the agent. One thread can have multiple consecutive turns. */
export class Thread {
  private _exec: CodexExec;
  private _options: CodexOptions;
  private _id: string | null;
  private _threadOptions: ThreadOptions;

  /** Returns the ID of the thread. Populated after the first turn starts. */
  public get id(): string | null {
    return this._id;
  }

  /* @internal */
  constructor(
    exec: CodexExec,
    options: CodexOptions,
    threadOptions: ThreadOptions,
    id: string | null = null,
  ) {
    this._exec = exec;
    this._options = options;
    this._id = id;
    this._threadOptions = threadOptions;
  }

  /** Provides the input to the agent and streams events as they are produced during the turn. */
  async runStreamed(input: Input, turnOptions: TurnOptions = {}): Promise<StreamedTurn> {
    return { events: this.runStreamedInternal(input, turnOptions) };
  }

  private async *runStreamedInternal(
    input: Input,
    turnOptions: TurnOptions = {},
  ): AsyncGenerator<ThreadEvent> {
    const { schemaPath, cleanup } = await createOutputSchemaFile(turnOptions.outputSchema);
    const options = this._threadOptions;
    const { prompt, images } = normalizeInput(input);
    const generator = this._exec.run({
      input: prompt,
      baseUrl: this._options.baseUrl,
      apiKey: this._options.apiKey,
      threadId: this._id,
      images,
      model: options?.model,
      sandboxMode: options?.sandboxMode,
      workingDirectory: options?.workingDirectory,
      skipGitRepoCheck: options?.skipGitRepoCheck,
      outputSchemaFile: schemaPath,
      modelReasoningEffort: options?.modelReasoningEffort,
      signal: turnOptions.signal,
      networkAccessEnabled: options?.networkAccessEnabled,
      webSearchMode: options?.webSearchMode,
      webSearchEnabled: options?.webSearchEnabled,
      approvalPolicy: options?.approvalPolicy,
      additionalDirectories: options?.additionalDirectories,
    });
    try {
      for await (const item of generator) {
        let parsed: ThreadEvent;
        try {
          parsed = JSON.parse(item) as ThreadEvent;
        } catch (error) {
          throw new Error(`Failed to parse item: ${item}`, { cause: error });
        }
        if (parsed.type === "thread.started") {
          this._id = parsed.thread_id;
        }
        yield parsed;
      }
    } finally {
      await cleanup();
    }
  }

  /** Provides the input to the agent and returns the completed turn. */
  async run(input: Input, turnOptions: TurnOptions = {}): Promise<Turn> {
    const generator = this.runStreamedInternal(input, turnOptions);
    const items: ThreadItem[] = [];
    let finalResponse: string = "";
    let usage: Usage | null = null;
    let turnFailure: ThreadError | null = null;
    for await (const event of generator) {
      if (event.type === "item.completed") {
        if (event.item.type === "agent_message") {
          finalResponse = event.item.text;
        }
        items.push(event.item);
      } else if (event.type === "turn.completed") {
        usage = event.usage;
      } else if (event.type === "turn.failed") {
        turnFailure = event.error;
        break;
      }
    }
    if (turnFailure) {
      throw new Error(turnFailure.message);
    }
    return { items, finalResponse, usage };
  }
}

function normalizeInput(input: Input): { prompt: string; images: string[] } {
  if (typeof input === "string") {
    return { prompt: input, images: [] };
  }
  const promptParts: string[] = [];
  const images: string[] = [];
  for (const item of input) {
    if (item.type === "text") {
      promptParts.push(item.text);
    } else if (item.type === "local_image") {
      images.push(item.path);
    }
  }
  return { prompt: promptParts.join("\n\n"), images };
}
</file>

<file path="sdk/typescript/src/threadOptions.ts">
export type ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted";

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type WebSearchMode = "disabled" | "cached" | "live";

export type ThreadOptions = {
  model?: string;
  sandboxMode?: SandboxMode;
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  modelReasoningEffort?: ModelReasoningEffort;
  networkAccessEnabled?: boolean;
  webSearchMode?: WebSearchMode;
  webSearchEnabled?: boolean;
  approvalPolicy?: ApprovalMode;
  additionalDirectories?: string[];
};
</file>

<file path="sdk/typescript/src/turnOptions.ts">
export type TurnOptions = {
  /** JSON schema describing the expected agent output. */
  outputSchema?: unknown;
  /** AbortSignal to cancel the turn. */
  signal?: AbortSignal;
};
</file>

<file path="sdk/typescript/.prettierignore">
dist
node_modules
coverage
</file>

<file path="sdk/typescript/.prettierrc">
{
  "printWidth": 100,
  "singleQuote": false,
  "trailingComma": "all"
}
</file>

<file path="sdk/typescript/eslint.config.js">
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import nodeImport from "eslint-plugin-node-import";

export default defineConfig(eslint.configs.recommended, tseslint.configs.recommended, {
  plugins: {
    "node-import": nodeImport,
  },

  rules: {
    "node-import/prefer-node-protocol": 2,
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
  },
});
</file>

<file path="sdk/typescript/jest.config.cjs">
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/tests/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
        diagnostics: {
          ignoreCodes: [1343],
        },
        astTransformers: {
          before: [
            {
              path: "ts-jest-mock-import-meta",
              // Workaround for meta.url not working in jest
              options: { metaObjectReplacement: { url: "file://" + __dirname + "/dist/index.js" } },
            },
          ],
        },
      },
    ],
  },
};
</file>

<file path="sdk/typescript/package.json">
{
  "name": "@openai/codex-sdk",
  "version": "0.0.0-dev",
  "description": "TypeScript SDK for Codex APIs.",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/openai/codex.git",
    "directory": "sdk/typescript"
  },
  "keywords": [
    "openai",
    "codex",
    "sdk",
    "typescript",
    "api"
  ],
  "license": "Apache-2.0",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "sideEffects": false,
  "scripts": {
    "clean": "rm -rf dist",
    "build": "tsup",
    "build:watch": "tsup --watch",
    "lint": "pnpm eslint \"src/**/*.ts\" \"tests/**/*.ts\"",
    "lint:fix": "pnpm eslint --fix \"src/**/*.ts\" \"tests/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "coverage": "jest --coverage",
    "format": "prettier --check .",
    "format:fix": "prettier --write .",
    "prepare": "pnpm run build"
  },
  "devDependencies": {
    "@modelcontextprotocol/sdk": "^1.24.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.19.18",
    "eslint": "^9.36.0",
    "eslint-config-prettier": "^9.1.2",
    "eslint-plugin-jest": "^29.0.1",
    "eslint-plugin-node-import": "^1.0.5",
    "jest": "^29.7.0",
    "prettier": "^3.6.2",
    "ts-jest": "^29.3.4",
    "ts-jest-mock-import-meta": "^1.3.1",
    "ts-node": "^10.9.2",
    "tsup": "^8.5.0",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.45.0",
    "zod": "^3.24.2",
    "zod-to-json-schema": "^3.24.6"
  }
}
</file>

<file path="sdk/typescript/README.md">
# Codex SDK

Embed the Codex agent in your workflows and apps.

The TypeScript SDK wraps the bundled `codex` binary. It spawns the CLI and exchanges JSONL events over stdin/stdout.

## Installation

```bash
npm install @openai/codex-sdk
```

Requires Node.js 18+.

## Quickstart

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
const turn = await thread.run("Diagnose the test failure and propose a fix");

console.log(turn.finalResponse);
console.log(turn.items);
```

Call `run()` repeatedly on the same `Thread` instance to continue that conversation.

```typescript
const nextTurn = await thread.run("Implement the fix");
```

### Streaming responses

`run()` buffers events until the turn finishes. To react to intermediate progress—tool calls, streaming responses, and file change notifications—use `runStreamed()` instead, which returns an async generator of structured events.

```typescript
const { events } = await thread.runStreamed("Diagnose the test failure and propose a fix");

for await (const event of events) {
  switch (event.type) {
    case "item.completed":
      console.log("item", event.item);
      break;
    case "turn.completed":
      console.log("usage", event.usage);
      break;
  }
}
```

### Structured output

The Codex agent can produce a JSON response that conforms to a specified schema. The schema can be provided for each turn as a plain JSON object.

```typescript
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
} as const;

const turn = await thread.run("Summarize repository status", { outputSchema: schema });
console.log(turn.finalResponse);
```

You can also create a JSON schema from a [Zod schema](https://github.com/colinhacks/zod) using the [`zod-to-json-schema`](https://www.npmjs.com/package/zod-to-json-schema) package and setting the `target` to `"openAi"`.

```typescript
const schema = z.object({
  summary: z.string(),
  status: z.enum(["ok", "action_required"]),
});

const turn = await thread.run("Summarize repository status", {
  outputSchema: zodToJsonSchema(schema, { target: "openAi" }),
});
console.log(turn.finalResponse);
```

### Attaching images

Provide structured input entries when you need to include images alongside text. Text entries are concatenated into the final prompt while image entries are passed to the Codex CLI via `--image`.

```typescript
const turn = await thread.run([
  { type: "text", text: "Describe these screenshots" },
  { type: "local_image", path: "./ui.png" },
  { type: "local_image", path: "./diagram.jpg" },
]);
```

### Resuming an existing thread

Threads are persisted in `~/.codex/sessions`. If you lose the in-memory `Thread` object, reconstruct it with `resumeThread()` and keep going.

```typescript
const savedThreadId = process.env.CODEX_THREAD_ID!;
const thread = codex.resumeThread(savedThreadId);
await thread.run("Implement the fix");
```

### Working directory controls

Codex runs in the current working directory by default. To avoid unrecoverable errors, Codex requires the working directory to be a Git repository. You can skip the Git repository check by passing the `skipGitRepoCheck` option when creating a thread.

```typescript
const thread = codex.startThread({
  workingDirectory: "/path/to/project",
  skipGitRepoCheck: true,
});
```

### Controlling the Codex CLI environment

By default, the Codex CLI inherits the Node.js process environment. Provide the optional `env` parameter when instantiating the
`Codex` client to fully control which variables the CLI receives—useful for sandboxed hosts like Electron apps.

```typescript
const codex = new Codex({
  env: {
    PATH: "/usr/local/bin",
  },
});
```

The SDK still injects its required variables (such as `OPENAI_BASE_URL` and `CODEX_API_KEY`) on top of the environment you
provide.
</file>

<file path="sdk/typescript/tsconfig.json">
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "lib": ["ES2022"],
    "types": ["node", "jest"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noImplicitAny": true,
    "outDir": "dist",
    "stripInternal": true
  },
  "include": ["src", "tests", "tsup.config.ts", "samples"],
  "exclude": ["dist", "node_modules"]
}
</file>

<file path="sdk/typescript/tsup.config.ts">
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  target: "node18",
  shims: false,
});
</file>

</files>
