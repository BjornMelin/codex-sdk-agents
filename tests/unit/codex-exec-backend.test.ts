import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildCodexExecArgs,
  DEFAULT_CODEX_MODEL,
  ExecBackend,
} from "../../packages/codex/src/index.js";

async function makeMockCodexScript(): Promise<{
  dir: string;
  scriptPath: string;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "codex-mock-"));
  const scriptPath = path.join(dir, "mock-codex.js");

  const script = dedent(`
    // eslint-disable-next-line no-console
    const fs = require("node:fs");
    const path = require("node:path");

    function findFlag(flag) {
      const idx = process.argv.indexOf(flag);
      if (idx === -1) return undefined;
      return process.argv[idx + 1];
    }

    const outputPath = findFlag("--output-last-message") || findFlag("-o");
    const prompt = process.argv[process.argv.length - 1] || "";

    // Emit a minimal JSONL stream compatible with our parser.
    const lines = [
      { type: "thread.started", thread_id: "t-123" },
      { type: "turn.started", thread_id: "t-123", turn_id: "u-1" },
      { type: "item.started", thread_id: "t-123", turn_id: "u-1", item: { id: "i-1", type: "agent_message" } },
      { type: "item.updated", thread_id: "t-123", turn_id: "u-1", item: { id: "i-1", type: "agent_message", text: "Hello" } },
      { type: "item.updated", thread_id: "t-123", turn_id: "u-1", item: { id: "i-1", type: "agent_message", text: "Hello world" } },
      { type: "item.completed", thread_id: "t-123", turn_id: "u-1", item: { id: "i-1", type: "agent_message", text: "Hello world" } },
      { type: "turn.completed", thread_id: "t-123", turn_id: "u-1", usage: { input_tokens: 10, output_tokens: 20 } },
    ];

    for (const obj of lines) {
      process.stdout.write(JSON.stringify(obj) + "\\n");
    }

    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify({ ok: true, echo: prompt }));
    }

    process.exit(0);
  `);

  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);

  return { dir, scriptPath };
}

function dedent(str: string): string {
  return str.replace(/^\n/, "").replace(/^ {2}/gm, "");
}

describe("ExecBackend", () => {
  it("buildCodexExecArgs includes model, cwd, and JSON-encoded config overrides", () => {
    const args = buildCodexExecArgs("do thing", {
      cwd: "/tmp",
      reasoningEffort: "high",
      mcpServers: {
        local: { command: "node", args: ["server.js"], env: { FOO: "bar" } },
      },
    });

    expect(args).toContain("--cd");
    expect(args).toContain("/tmp");

    const modelIdx = args.indexOf("--model");
    expect(modelIdx).toBeGreaterThan(-1);
    expect(args[modelIdx + 1]).toBe(DEFAULT_CODEX_MODEL);

    const configEntries = args
      .map((a, idx) => (a === "--config" ? args[idx + 1] : undefined))
      .filter((v): v is string => typeof v === "string");

    expect(
      configEntries.some((v) => v.startsWith("model_reasoning_effort=")),
    ).toBe(true);
    expect(
      configEntries.some((v) => v.startsWith("mcp_servers.local.command=")),
    ).toBe(true);
    expect(
      configEntries.some((v) => v.startsWith("mcp_servers.local.args=")),
    ).toBe(true);
    expect(
      configEntries.some((v) => v.startsWith("mcp_servers.local.env=")),
    ).toBe(true);
  });

  it("runs a mock codex exec stream and returns text + structured output", async () => {
    const { dir, scriptPath } = await makeMockCodexScript();
    try {
      const backend = new ExecBackend({
        command: process.execPath,
        commandArgsPrefix: [scriptPath],
      });

      const events: string[] = [];
      const result = await backend.run(
        "say hello",
        {
          cwd: dir,
          outputSchemaJson: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
        (e) => {
          events.push(e.type);
        },
      );

      expect(result.backend).toBe("exec");
      expect(result.threadId).toBe("t-123");
      expect(result.turnId).toBe("u-1");
      expect(result.text).toBe("Hello world");
      expect(result.structured).toEqual({ ok: true, echo: "say hello" });

      expect(events).toContain("codex.thread.started");
      expect(events).toContain("codex.message.delta");
      expect(events).toContain("codex.message.completed");
      expect(events).toContain("codex.turn.completed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
